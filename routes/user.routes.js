import { Router } from "express";
import { logger } from "../helpers/logger.js";
import { Customer, Order, Product } from "../models/base.admin.model.js";
import { generateToken, verifyToken } from "../helpers/jwt.js";
import mongoose from "mongoose";
import { createDelhiveryOrder } from "../services/delhivery.js";

const router = Router();

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
    // const token = await generateToken(newUser);
    return res.status(201).json({ message: "pre registration successful" });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
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
    return res.status(200).json({ data: user, token: token });
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
router.patch("/update/cart", async (req, res) => {
  const { id, cart: newItems } = req.body;

  try {
    const user = await Customer.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // const existingItems = user.cart || [];

    // // Merge only new items (by product ID)
    // const mergedCart = [...existingItems];

    // newItems.items.forEach((newItem) => {
    //   const alreadyExists = existingItems.some(
    //     (item) => item.product.toString() === newItem.product.toString()
    //   );
    //   if (!alreadyExists) {
    //     mergedCart.push(newItem);
    //   }
    // });

    user.cart = newItems.items;

    const updated = await user.save({ validateBeforeSave: true });

    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to update cart" });
  }
});

router.patch("/update/address", async (req, res) => {
  const { id, address } = req.body;

  try {
    let updated;

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

router.post("/cart", async (req, res) => {
  try {
    const cart = req.body.cart; // [{ product, variantId, quantity }]
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart is empty or invalid" });
    }

    const productIds = cart.map((item) => item.product);

    // Fetch all products in one go
    const products = await Product.find({ _id: { $in: productIds } });

    let total = 0;
    const cartDetails = [];

    for (let cartItem of cart) {
      const product = products.find((p) => p.id == cartItem.product);
      if (!product) continue;

      const variant = product.variants.find(
        (v) => v._id.toString() === cartItem.variantId
      );
      if (!variant) continue;

      // Calculate price after discount
      const discountAmount =
        variant.variantPrice * (variant.variantDiscount / 100);
      const finalPrice =
        Math.floor(variant.variantPrice - discountAmount) + 0.99;

      const subtotal = finalPrice * cartItem.quantity;
      total += subtotal;

      cartDetails.push({
        product: {
          id: product._id,
          name: product.name,
          image: product.images[0],
          variant: {
            id: variant._id,
            name: variant.variantName,
            weight: variant.variantWeight,
            price: variant.variantPrice,
            discount: variant.variantDiscount,
            finalPrice,
          },
        },
        quantity: cartItem.quantity,
        subtotal,
      });
    }

    res.json({
      items: cartDetails,
      total,
      finalTotal: total, // optionally add coupon handling here
    });
  } catch (err) {
    console.error("Cart Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// router.post("/update-password",async(req,res)=>{})

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
      paymentMethod,
      paymentDetails,
    } = req.body;

    const user = await Customer.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    await decrementVariantStock(items, session);

    const order = new Order({
      userId,
      items,
      shippingAddress,
      totalAmount,
      discountAmount,
      couponCode,
      finalAmount,
      paymentMethod,
      paymentDetails,
      paymentStatus: paymentMethod === "COD" ? "pending" : "paid",
      orderStatus: "placed",
    });
     // 🟡 Call external API after transaction
    const shipment = {
      "name": user.name,
      "add": `${shippingAddress?.addressLine1} ${shippingAddress?.addressLine2} ${shippingAddress?.landmark}`,
      "pin": shippingAddress?.pincode,
      "city": shippingAddress?.city,
      "state": shippingAddress?.state,
      "country": "IN",
      "phone": user?.phone || "0000000000",
      "order": `Order-${order._id}`,
      "payment_mode": paymentMethod === "COD" ? "COD" : "Prepaid",
      "products_desc": "Mixed items",
      "total_amount": finalAmount,
      "shipment_width": "10",
      "shipment_height": "10",
      "shipment_length": "10",
      "weight": "500",
      "shipping_mode": "Surface",
      "address_type": "Home",
    };
    
    const deliveryResult = await createDelhiveryOrder(shipment);
    if (!deliveryResult.success) {
      throw new Error("Delhivery API failed to create shipment");
    }
    await order.save({ session });
    user.cart = [];
    user.orders.push(order._id);
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

   

    return res.status(201).json({
      message: "Order placed successfully",
      order,
      delivery: deliveryResult || null,
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
// router.get("/orders/:id",async(req,res)=>{}) //r
// router.delete("/orders/:id",async(req,res)=>{}) //d

// // user wishlist routes
// router.post("/wishlist/",async(req,res)=>{}) //c
// router.get("/wishlist/",async(req,res)=>{}) //r
// router.delete("/wishlist/:id",async(req,res)=>{}) //d

export default router;
