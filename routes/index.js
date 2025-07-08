import { Router } from "express"
import AdminRoutes from "./admin.routes.js"
import UserRouter from "./user.routes.js"
import { Product } from "../models/base.admin.model.js"
import { logger } from "../helpers/logger.js"

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
export default router