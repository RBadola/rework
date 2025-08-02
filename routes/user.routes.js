import { Router } from "express";
import { logger } from "../helpers/logger.js";
import { Customer, Order, Product } from "../models/base.admin.model.js";
import { generateToken, verifyToken } from "../helpers/jwt.js";
import mongoose from "mongoose";
import { createDelhiveryOrder } from "../services/delhivery.js";
import {
  createReview,
  getReviewsByProduct,
  updateReview,
  deleteReview,
} from "../controllers/review.controller.js";
import Razorpay from "razorpay";
import { DateTime } from "luxon";
import { config } from "dotenv";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config();
const router = Router();
const razorpay = new Razorpay({
  key_id: process.env.RAZOR_KEY_ID,
  key_secret: process.env.RAZOR_KEY_SECRET,
});
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 587,
  secure: false, // STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.use(
  "compile",
  hbs({
    viewEngine: {
      extname: ".hbs",
      partialsDir: path.resolve("./Mail/templates"),
      defaultLayout: false,
    },
    viewPath: path.resolve("./Mail/templates"),
    extName: ".hbs",
  })
);
async function decrementVariantStock(items, session) {
  for (const item of items) {
    const { productId, variantId, quantity } = item;

    if (!productId || !variantId) {
      throw new Error(
        "Each order item must have both productId and variantId."
      );
    }

    const product = await Product.findOne({ _id: productId }, null, {
      session,
    });

    if (!product) {
      throw new Error(`Product with ID ${productId} not found.`);
    }

    const variant = product.variants.find(
      (v) => v._id.toString() === variantId.toString()
    );

    if (!variant) {
      throw new Error(
        `Variant with ID ${variantId} not found in product ${productId}.`
      );
    }
    const stockItem = product.stocks.find(
      (p) => p.stockName === variant.variantWeight
    );

    if (!stockItem) {
      throw new Error(`No stock entry for ${variant.variantWeight}`);
    }

    if (stockItem.stockQuantity < quantity) {
      throw new Error(
        `Insufficient stock for '${variant.variantName}'. Requested: ${quantity}, Available: ${stockItem.stockQuantity}`
      );
    }

    // ✅ Decrement stock
    stockItem.stockQuantity -= quantity;

    // Save product with session
    await product.save({ session });
  }
}
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const user = await Customer.findOne({ email: email });
    if (user) {
      return res.status(400).json({ error: "User Already Exists" });
    }
    const newUser = new Customer({ name, email, password, phone });
    const userObj = await newUser.save();
    await transporter.sendMail({
      from: `"Refreshing Roots" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Welcome To Refreshing Roots ",
      template: "welcome",
      context: {
        companyName: "Refreshing Roots",
        userName: name,
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: "fullLogo.jpg",
          path: path.join(__dirname, "../fullLogo.jpg"),
          cid: "fullLogo",
        },
      ],
    });
    // const token = await generateToken(newUser);
    return res
      .status(201)
      .json({ message: "pre registration successful", status: "success" });
  } catch (err) {
    console.log(err.message);
    return res
      .status(500)
      .json({ error: "Internal Server Error", status: "failed" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Customer.findOne({ email: email });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    const passMatch = await user.comparePassword(password);
    if (!passMatch) {
      return res.status(400).json({ error: "Incorrect Password" });
    }
    const token = await generateToken(user);
    return res.status(200).json({
      data: user,
      token: token,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await Customer.findOne({ _id: req.id });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    const token = await generateToken(user);
    return res.status(200).json({ data: user, token: token });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
// router.post("/logout",async(req,res)=>{})
router.get("/cart", verifyToken, async (req, res) => {
  try {
    const user = await Customer.findOne({ _id: req.id });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    return res.status(200).json({ data: user?.cart });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
const calculateTotal = (items) => {
  let total = 0;

  for (const item of items) {
    const product = item.product;
    const quantity = item.quantity;
    if (!product || !quantity) continue;

    if (item.variantId && product.variants?.length > 0) {
      const variant = product.variants.find(
        (v) => v._id?.toString() === item.variantId
      );

      if (variant) {
        const price = variant.variantPrice || 0;
        const discount = variant.variantDiscount || 0;
        const discountedPrice = price - (price * discount) / 100;
        total += discountedPrice * quantity;
      }
    } else {
      const price = product.finalPrice || 0;
      const discount = product.discount || 0;
      const discountedPrice = price - (price * discount) / 100;
      total += discountedPrice * quantity;
    }
  }

  return Math.round(total);
};

// Update quantity of a cart item
router.patch("/cart/update-quantity", async (req, res) => {
  const { id, productId, variantId = null, quantity } = req.body;

  try {
    const user = await Customer.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    let updated = false;

    user.cart = user.cart.map((item) => {
      if (
        item.product?.toString() === productId &&
        (item.variantId || null)?.toString?.() === (variantId || null)?.toString?.()
      ) {
        updated = true;
        return { ...item, quantity };
      }
      return item;
    });

    if (!updated) return res.status(404).json({ error: "Item not found" });

    await user.save();
    return res.json({ cart: user.cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update quantity" });
  }
});

// Delete a cart item
router.delete("/cart/:userId/item", async (req, res) => {
  const { productId, variantId } = req.body;

  try {
    const user = await Customer.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = user.cart.filter((item) => {
      return !(
        item.product?.toString() === productId &&
        (item.variantId || null)?.toString?.() === (variantId || null)?.toString?.()
      );
    });

    await user.save();
    return res.json({ items: user.cart, total: calculateTotal(user.cart) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing cart item" });
  }
});

// Merge or replace items in cart
router.patch("/update/cart", async (req, res) => {
  const { id, cart: newItems } = req.body;

  try {
    const user = await Customer.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    let existingCart = user.cart || [];

    const areCombosEqual = (comboA, comboB) => {
      if (comboA.length !== comboB.length) return false;
      return comboA.every((a) =>
        comboB.some(
          (b) =>
            a.productId.toString() === b.productId.toString() &&
            (a.variantId || null)?.toString?.() === (b.variantId || null)?.toString?.()
        )
      );
    };

    newItems.forEach((newItem) => {
      const isCombo = !!newItem.comboProduct?.products?.length;

      const existingIndex = existingCart.findIndex((existingItem) => {
        const isExistingCombo = !!existingItem.comboProduct?.products?.length;

        if (isCombo && isExistingCombo) {
          return areCombosEqual(
            newItem.comboProduct.products,
            existingItem.comboProduct.products
          );
        }

        if (!isCombo && !isExistingCombo) {
          return (
            existingItem.product?.toString() === newItem.product?.toString() &&
            (existingItem.variantId || null)?.toString?.() === (newItem.variantId || null)?.toString?.()
          );
        }

        return false;
      });

      if (existingIndex !== -1) {
        existingCart[existingIndex] = newItem;
      } else {
        existingCart.push(newItem);
      }
    });

    user.cart = existingCart;
    const updatedUser = await user.save({ validateBeforeSave: true });

    return res.status(200).json({ data: updatedUser.cart });
  } catch (err) {
    console.error("Cart update error:", err.message);
    return res.status(400).json({ error: "Failed to update cart" });
  }
});

router.post("/cart/details", async (req, res) => {
  const { id, cart = [] } = req.body;

  try {
    let rawCart = cart;

    if (id) {
      const user = await Customer.findById(id).lean();
      if (user && user.cart?.length) {
        rawCart = user.cart;
      }
    }

    const enrichedCart = await Promise.all(
      rawCart.map(async (item) => {
        const product = await Product.findById(item.product).lean();
        if (!product) return null;

        let variant = null;
        if (item.variantId) {
          variant = product.variants?.find(
            (v) => v._id?.toString() === item.variantId
          );
        }

        let subtotal = 0;
        if (variant) {
          subtotal = variant.variantPrice * item.quantity;
        } else if (product.comboProduct?.comboPrice) {
          subtotal = product.comboProduct.comboPrice * item.quantity;
        } else {
          return null; // skip if neither variant nor comboPrice is present
        }

        // If it's a combo product, prepare the breakdown as well
        const comboDetails =
          product.comboProduct?.products?.length > 0
            ? await Promise.all(
                product.comboProduct.products.map(async (comboItem) => {
                  const subProduct = await Product.findById(comboItem.productId).lean();
                  if (!subProduct) return null;

                  const subVariant = comboItem.variantId
                    ? subProduct.variants?.find(
                        (v) => v._id?.toString() === comboItem.variantId
                      )
                    : null;

                  return {
                    id: subProduct._id,
                    name: subProduct.name,
                    image: subProduct.images?.[0] || null,
                    variant: subVariant
                      ? {
                          id: subVariant._id,
                          name: subVariant.variantName,
                          weight: subVariant.variantWeight,
                          price: subVariant.variantPrice,
                          discount: subVariant.variantDiscount,
                        }
                      : null,
                  };
                })
              )
            : null;

        return {
          quantity: item.quantity,
          product: {
            id: product._id,
            name: product.name,
            image: product.images?.[0] || null,
            category: product.category,
            variant: variant
              ? {
                  id: variant._id,
                  name: variant.variantName,
                  weight: variant.variantWeight,
                  price: variant.variantPrice,
                  discount: variant.variantDiscount,
                }
              : null,
            isCombo: !!comboDetails,
            comboPrice: product.comboProduct?.comboPrice || null,
            comboDetails: comboDetails?.filter(Boolean) || null,
          },
          subtotal,
        };
      })
    );

    const filtered = enrichedCart.filter(Boolean);
    const total = filtered.reduce((sum, i) => sum + (i?.subtotal || 0), 0);

    return res.status(200).json({ items: filtered, total });
  } catch (err) {
    console.error("Cart details error:", err.message);
    return res.status(400).json({ error: "Failed to fetch cart details" });
  }
});



router.patch("/update/wishlist", async (req, res) => {
  const { id, item } = req.body; // `item` can be an object or just an ID, adjust accordingly

  try {
    const user = await Customer.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Initialize wishlist if not present
    if (!Array.isArray(user.wishlist)) {
      user.wishlist = [];
    }

    const itemIndex = user.wishlist.findIndex(
      (w) => w.id?.toString?.() === item.id // assuming item has `id`
    );

    if (itemIndex >= 0) {
      // Item exists, remove it
      user.wishlist.splice(itemIndex, 1);
    } else {
      // Item doesn't exist, add it
      user.wishlist.push(item);
    }

    const updated = await user.save({ validateBeforeSave: true });

    console.log("Wishlist updated successfully");
    return res.status(200).json({ data: updated.wishlist });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to update wishlist" });
  }
});

router.post("/request-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await Customer.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "User with this email not found." });

    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    user.resetOTP = { otp, expiresAt: Date.now() + 10 * 60 * 1000 }; // 10 minutes validity
    await user.save();
    // Send Email
    await transporter.sendMail({
      from: `"Refreshing Roots" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Your OTP for Password Reset",
      template: "otp",
      context: {
        otp,
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: "fullLogo.jpg",
          path: path.join(__dirname, "../fullLogo.jpg"),
          cid: "fullLogo",
        },
      ],
    });

    res.json({ message: "OTP sent to your email.", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error.", status: "failed" });
  }
});

// 2. Verify OTP and Reset Password
router.post("/update-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await Customer.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "User with this email not found." });
    const record = user.resetOTP;

    if (!record || record.otp != otp)
      return res.status(400).json({ message: "Invalid or expired OTP." });

    if (Date.now() > record.expiresAt)
      return res.status(400).json({ message: "OTP has expired." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOTP = "";
    await user.save();

    res.json({ message: "Password updated successfully.", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error.", status: "failed" });
  }
});
// // user order routes
router.post("/orders", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      userId,
      items,
      shippingAddress,
      totalAmount,
      discountAmount,
      finalAmount,
      couponCode,
      paymentDetails,
      paymentMethod,
    } = req.body;

    const user = await Customer.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    await decrementVariantStock(items, session);
    const order_id = await razorpay.orders.create({
      amount: finalAmount * 100, // in paise
      currency: "INR",
      receipt: `receipt_${DateTime.now().setZone("Asia/Kolkata")}`,
    });
    const order = new Order({
      userId,
      items,
      shippingAddress,
      totalAmount,
      discountAmount,
      couponCode,
      finalAmount,
      paymentDetails,
      orderId: order_id.id,
      paymentStatus: "pending",
      orderStatus: "pending",
      paymentMethod,
    });
    //  Call external API after transaction
    // const shipment = {
    //   name: user.name,
    //   add: `${shippingAddress?.addressLine1} ${shippingAddress?.addressLine2} ${shippingAddress?.landmark}`,
    //   pin: shippingAddress?.pincode,
    //   city: shippingAddress?.city,
    //   state: shippingAddress?.state,
    //   country: "IN",
    //   phone: user?.phone || "0000000000",
    //   order: `${order._id}`,
    //   payment_mode: "Prepaid",
    //   products_desc: "Mixed items",
    //   total_amount: finalAmount,
    //   shipment_width: "10",
    //   shipment_height: "10",
    //   shipment_length: "10",
    //   weight: "500",
    //   shipping_mode: "Surface",
    //   address_type: "Home",
    // };

    // const deliveryResult = await createDelhiveryOrder(shipment);
    // if (!deliveryResult.success) {
    //   throw new Error("Delhivery API failed to create shipment");
    // }
    await order.save({ session });
    // user.cart = [];
    // user.orders.push(order._id);
    // await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: true,
      message: "Order placed successfully",
      order,
      // delivery: deliveryResult || null,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Order creation failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await Order.find({ userId: id });
    if (!orders) return res.status(404).json({ error: "orders not found" });
    return res.status(200).json({ data: orders });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Order creation failed:", error);
    return res
      .status(500)
      .json({ error: "Failed to place order", details: error.message });
  }
});

router.patch("/update/address", async (req, res) => {
  const { id, address } = req.body;

  try {
    let updated;

    // Step 1: If default is true, unset default from all other addresses
    if (address.default === true) {
      await Customer.updateOne(
        { _id: id },
        { $set: { "addresses.$[].default": false } }
      );
    }

    // Step 2: Add or update address
    if (!address._id) {
      // No _id means it's a new address → ADD it
      updated = await Customer.findByIdAndUpdate(
        id,
        { $push: { addresses: address } },
        { new: true, runValidators: true }
      );
    } else {
      // Update existing address using positional operator
      updated = await Customer.findOneAndUpdate(
        { _id: id, "addresses._id": address._id },
        {
          $set: {
            "addresses.$": address, // Replace matched address entirely
          },
        },
        { new: true, runValidators: true }
      );
    }

    if (!updated)
      return res.status(404).json({ error: "Could not update or add address" });

    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to update address" });
  }
});
// router.get("/orders/:id",async(req,res)=>{}) //r
// router.delete("/orders/:id",async(req,res)=>{}) //d

// // user wishlist routes
// router.post("/wishlist/",async(req,res)=>{}) //c
// router.get("/wishlist/",async(req,res)=>{}) //r
// router.delete("/wishlist/:id",async(req,res)=>{}) //d

router.post("/review", verifyToken, createReview); // POST /api/reviews
router.get("/:productId", getReviewsByProduct); // GET /api/reviews/:productId
router.put("/:reviewId", verifyToken, updateReview); // PUT /api/reviews/:reviewId
router.delete("/:reviewId", verifyToken, deleteReview); // DELETE /api/reviews/:reviewId
router.patch("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    const allowedFields = [
      "phone",
      "addresses",
      "firstLogin",
      "profileCompleted",
      "loyaltyPoints",
      "cart",
      "wishlist",
    ];

    const sanitizedUpdate = {};
    for (const key of Object.keys(updateFields)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdate[key] = updateFields[key];
      }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { $set: sanitizedUpdate },
      { new: true }
    );

    if (!updatedCustomer) {
      return res
        .status(404)
        .json({ message: "Customer not found", result: "failed" });
    }

    res.json({ data: updatedCustomer, result: "success" });
  } catch (err) {
    console.error("Error updating customer:", err);
    res
      .status(500)
      .json({ message: "Internal server error", result: "failed" });
  }
});
export default router;
