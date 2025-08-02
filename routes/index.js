import { Router } from "express";
import AdminRoutes from "./admin.routes.js";
import UserRouter from "./user.routes.js";
import {
  About,
  Banner,
  Category,
  Customer,
  NewLetter,
  Order,
  Product,
} from "../models/base.admin.model.js";
import { logger } from "../helpers/logger.js";
import DeliveryRoutes from "./delhivery.routes.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";

import dotenv from "dotenv";
import mongoose from "mongoose";
import { createDelhiveryOrder } from "../services/delhivery.js";
import { DateTime } from "luxon";
import { getReviewsByProduct } from "../controllers/review.controller.js";
const router = Router();
dotenv.config();
const razorpay = new Razorpay({
  key_id: process.env.RAZOR_KEY_ID,
  key_secret: process.env.RAZOR_KEY_SECRET,
});
router.use("/admin", AdminRoutes);
router.use("/user", UserRouter);
router.get("/products", async (req, res) => {
  try {
    const { category, isActive } = req.query;

    // Dynamically build the filter object
    const filter = {};

    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true"; // Convert to boolean

    const products = await Product.find(filter);
    res.status(200).json({ data: products });
  } catch (err) {
    logger.error("PRODUCT: Error occurred", err);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    // const product = await Product.findById(req.params.id);
    const product = await Product.findOne({ slug: req.params.id });

    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json({ data: product });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Invalid product ID" });
  }
});

router.use("/delivery", DeliveryRoutes);

router.get("/banners", async (req, res) => {
  try {
    const Banners = await Banner.find();
    res.status(200).json({ data: Banners });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Internal Server Error " });
  }
});

router.post("/verify", async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderId,
    userId,payment_mode
  } = req.body;

  const secret = process.env.RAZOR_KEY_SECRET;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    validatePaymentVerification(
      { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
      razorpay_signature,
      secret
    );
    const user = await Customer.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    // If valid, update order status in DB
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: "paid",
        paymentId: razorpay_payment_id,
      },
      { new: true, runValidators: true }
    ).session(session);
    // console.log(order);
    const shipment = {
      name: user.name,
      add: `${order.shippingAddress?.addressLine1} ${order.shippingAddress?.addressLine2} ${order.shippingAddress?.landmark}`,
      pin: order.shippingAddress?.pincode,
      city: order.shippingAddress?.city,
      state: order.shippingAddress?.state,
      country: "India",
      phone: user?.phone,
      order: `${order._id}`,
      payment_mode: payment_mode,
      total_amount: order.finalAmount,
      shipment_width: "10",
      shipment_height: "10",
      shipment_length: "10",
      weight: "500",
      shipping_mode: "Surface",
      address_type: "Home",
    };

    const deliveryResult = await createDelhiveryOrder(shipment);
    if (!deliveryResult.success) {
      throw new Error(deliveryResult);
    }
    await Order.findByIdAndUpdate(
      orderId,
      {
        orderStatus: "placed",
        deliveryDetails: {
          uploadWbn: deliveryResult?.upload_wbn,
          packages: deliveryResult?.packages,
        },
      },
      { new: true, runValidators: true }
    ).session(session);
    user.cart = [];
    user.orders.push(order._id);
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Verification failed:", err);
    res.status(400).json({ success: false, error: err });
  }
});
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    res.status(200).json({ data: categories });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to Fetch Categories" });
  }
});
router.get("/about", async (req, res) => {
  try {
    const Banners = await About.find().sort({ createdAt: 1 });
    res.status(200).json({ data: Banners });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Internal Server Error " });
  }
});
router.post("/contact", async (req, res) => {
  const { firstName, lastName, email, phone, message } = req.body;

  if (!firstName || !lastName || !email || !phone || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Create a transport
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

    // HTML template
    const mailTemplate = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f9f9f9; padding: 10px; border-left: 4px solid #4CAF50;">${message}</p>
      </div>
    `;

    // Send email
    await transporter.sendMail({
      from: `"Refreshing Roots" <${process.env.MAIL_USER}>`,
      to: email, // your receiving email
      subject: "Thank you for reaching out to Refreshing Roots.",
      html: mailTemplate,
    });

    return res.status(200).json({ message: "Message sent successfully!" });
  } catch (err) {
    console.error("Mail error:", err);
    return res.status(500).json({ error: "Failed to send message." });
  }
});
router.post("/newsletter",async(req,res)=>{
  const email = req.body.email
  try{
    if(!email){
      return res.status(400).json({ error: "Email is required." });
    }
    const pre = await NewLetter.findOne({email:email})
    if(pre){
      return res.status(400).json({ error: "Email already subscribed." });
    }
    await NewLetter.create({email})
    res.status(200).json({status:"success",message:"subscribed to newsletter"})
  }catch (err) {
    console.error("Mail error:", err);
    return res.status(500).json({ error: "Failed to send message." });
  }
})

router.get("/reviews/:productId", getReviewsByProduct); // GET /api/reviews/:productId


export default router;
