import { Router } from "express";
import {
  Admin,
  BaseUser,
  Category,
  Product,
} from "../models/base.admin.model.js";
import { performance } from "perf_hooks";
import { logger } from "../helpers/logger.js";
import { generateToken } from "../helpers/jwt.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
const router = Router();
const __fileName = import.meta.url;
const __dirName = fileURLToPath(__fileName);
logger.log({ level: "info", message: __dirName });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    // const ext = path.extname(file.originalname);
    cb(
      null,
      `images-${Date.now()}-${Math.round(Math.random() * 1e9)}${
        file.originalname
      }`
    );
  },
});

const upload = multer({ storage: storage, limits: { fileSize: 5000000 } });
// admin account routes
router.post("/create", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await Admin.findOne({ email: email });
    if (user) {
      return res.status(400).json({ error: "User Already Exists" });
    }
    const allowedRoles = ["admin", "junior_admin", "super_admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const newUser = new Admin({ name, email, password, role });
    const data = await newUser.save()
    return res.status(201).json({ data });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Admin.findOne({ email: email });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    const passMatch = await user.comparePassword(password);
    if (!passMatch) {
      return res.status(400).json({ error: "Incorrect Password" });
    }
    const token = await generateToken(user);
    return res.status(200).json({ data, token: token });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await Admin.findOne({ _id: req.id });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    const token = await generateToken(user);
    const userObj = user.toJSON();
    return res.status(200).json({ data: userObj, token: token });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
// router.post("/logout", async (req, res) => {});
// router.patch("/update", async (req, res) => {});
// router.get("/", async (req, res) => {});
// router.get("/:id", async (req, res) => {});
// router.delete("/:id", async (req, res) => {});

//  admin product routes

router.post("/products/", upload.array("images"), async (req, res) => {
  try {
    const uploadedImagePaths = req.files.map((file) =>
      file.path.replace(/\\/g, "/")
    ); // optional: normalize path for UNIX-style

    const {
      name,
      category,
      description,
      price,
      stockQuantity,
      discount,
      isActive,
      isFeatured,
      inStock,
      variants,
      isBestSeller,
    } = req.body;
    const parsedProduct = {
      name,
      category,
      description,
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      discount: Number(discount),
      isActive: isActive === "true",
      isFeatured: isFeatured === "true",
      inStock: inStock === "true",
      isBestSeller: isBestSeller === "true",
      images: uploadedImagePaths,
      variants: JSON.parse(variants), // comes as a stringified array
    };
    const newProduct = new Product(parsedProduct);
    const data = await newProduct.save();
    return res.status(200).json({ message: "Product received", data });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.get("/products", async (req, res) => {
  logger.info("PRODUCT: Route entered");
  try {
    logger.info("PRODUCT: About to query database");
    const products = await Product.find();
    logger.info(`PRODUCT: Database query completed, found: ${products.length}`);
    res.status(200).json({ data: products });
    logger.info("PRODUCT: Response sent");
  } catch (err) {
    logger.error("PRODUCT: Error occurred", err);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json({ data: product });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Invalid product ID" });
  }
});
router.patch("/products/:id", upload.none(), async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name,
      category,
      description,
      price,
      stockQuantity,
      discount,
      isActive,
      isFeatured,
      inStock,
      variants,
      isBestSeller,
      images,
    } = req.body;
    const parsedProduct = {
      name,
      category,
      description,
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      discount: Number(discount),
      isActive: isActive === "true",
      isFeatured: isFeatured === "true",
      inStock: inStock === "true",
      isBestSeller: isBestSeller === "true",
      images,
      variants: JSON.parse(variants), // comes as a stringified array
    };
    console.log(req.body);
    const updated = await Product.findByIdAndUpdate(id, parsedProduct, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to update product" });
  }
});
router.delete("/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to delete product" });
  }
});

// admin category routes
router.post("/category/", async (req, res) => {
  try {
    const newCategory = await Product.create(req.body);
    return res.status(201).json({ data: newCategory });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to create product" });
  }
});
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ data: categories });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to Fetch Categories" });
  }
});

// admin coupon routes
// router.post("/coupon/create", async (req, res) => {});
// router.get("/coupon/", async (req, res) => {});
// router.get("/coupon/:id", async (req, res) => {});
// router.patch("/coupon/:id", async (req, res) => {});
// router.delete("/coupon/:id", async (req, res) => {});

// //  admin disconts routes
// router.post("/discount/create", async (req, res) => {});
// router.get("/discount/", async (req, res) => {});
// router.get("/discount/:id", async (req, res) => {});
// router.patch("/discount/update", async (req, res) => {});
// router.delete("/discount/:id", async (req, res) => {});

// // router.post("/create",async(req,res)=>{})
// router.get("/users", async (req, res) => {});
// router.get("/users/:id", async (req, res) => {});
// router.patch("/users/:id", async (req, res) => {});
// router.delete("/users/:id", async (req, res) => {});

// //  admin order management
// router.get("/orders", async (req, res) => {});
// router.get("/orders/:id", async (req, res) => {});
// router.patch("/orders/:id", async (req, res) => {});
// router.delete("/orders/:id", async (req, res) => {});

// // admin refund routes
// router.get("/refunds", async (req, res) => {});
// router.get("/refunds/:id", async (req, res) => {});
// router.post("/refunds", async (req, res) => {});
// router.patch("/refunds/:id", async (req, res) => {});

export default router;
