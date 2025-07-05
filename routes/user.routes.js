import { Router } from "express";
import { logger } from "../helpers/logger.js";
import { Customer, Product } from "../models/base.admin.model.js";
import { generateToken, verifyToken } from "../helpers/jwt.js";

const router = Router();
// user auth routes
function calculateCouponDiscount(code, total) {
  const coupon = "";
  if (!coupon || coupon.expiresAt < new Date()) return 0;

  if (coupon.minPurchase && total < coupon.minPurchase) return 0;

  if (coupon.discountType === "flat") return coupon.value;
  if (coupon.discountType === "percentage") return (coupon.value / 100) * total;

  return 0;
}


router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await Customer.findOne({ email: email });
    if (user) {
      return res.status(400).json({ error: "User Already Exists" });
    }
    const newUser = new Customer({ name, email, password });
    const userObj = await newUser.save();
    const token = await generateToken(newUser);
    return res.status(201).json({ data: userObj, token });
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
router.patch("/update/cart", async (req, res) => {
  const { id, cart: newItems } = req.body;

  try {
    const user = await Customer.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingItems = user.cart || [];

    // Merge only new items (by product ID)
    const mergedCart = [...existingItems];

    newItems.forEach((newItem) => {
      const alreadyExists = existingItems.some(
        (item) => item.product.toString() === newItem.product.toString()
      );
      if (!alreadyExists) {
        mergedCart.push(newItem);
      }
    });

    user.cart = mergedCart;

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

router.post("/cart",  async (req, res) => { 
  
  let productIds = []
  if(req.body.id){
    const user = await Customer.findById(req.body.id);
  }
    productIds = req.body.cart.map((item) => item.product);

  const products = await Product.find({ _id: { $in: productIds } });

  let total = 0;
  let cartDetails = [];

  for (let cartItem of req.body.cart) {
    const product = products.find((p) => p.id ==cartItem.product);
    const subtotal = product.finalPrice * cartItem.quantity;
    total += subtotal;

    cartDetails.push({
      product,
      quantity: cartItem.quantity,
      subtotal,
    });
  }

  // Optional: apply coupon
  // const discount = calculateCouponDiscount(req.query.couponCode, total);

  res.json({
    items: cartDetails,
    total,
    // discount,
    finalTotal: total ,
  });
});

// router.post("/update-password",async(req,res)=>{})

// // user order routes
// router.post("/orders/",async(req,res)=>{}) //c
// router.get("/orders/",async(req,res)=>{}) //r
// router.get("/orders/:id",async(req,res)=>{}) //r
// router.delete("/orders/:id",async(req,res)=>{}) //d

// // user wishlist routes
// router.post("/wishlist/",async(req,res)=>{}) //c
// router.get("/wishlist/",async(req,res)=>{}) //r
// router.delete("/wishlist/:id",async(req,res)=>{}) //d

export default router;
