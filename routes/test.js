import mongoose from "mongoose";
import { Product } from "../models/base.admin.model.js"; // adjust path
import { config } from "dotenv";
config()
await mongoose.connect(process.env.DB_URI);
console.time("productFetch");
const products = await Product.find().lean();
console.log(products)
console.timeEnd("productFetch");
console.log(products.length);
process.exit();