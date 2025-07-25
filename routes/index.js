import { Router } from "express"
import AdminRoutes from "./admin.routes.js"
import UserRouter from "./user.routes.js"
import { Banner, Product } from "../models/base.admin.model.js"
import { logger } from "../helpers/logger.js"
import DeliveryRoutes from "./delhivery.routes.js"
const router = Router()

router.use("/admin",AdminRoutes)
router.use("/user",UserRouter)
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
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

router.use("/delivery",DeliveryRoutes)


router.get("/banners", async (req, res) => {
  try {
    const Banners = await Banner.find();
    res.status(200).json({ data: Banners });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Internal Server Error " });
  }
});
router.post("/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    res.send({ success: true, message: "Payment verified successfully" });
  } else {
    res.status(400).send({ success: false, message: "Invalid signature" });
  }
});

export default router