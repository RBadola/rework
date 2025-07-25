import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import {
  Admin,
  Banner,
  BaseUser,
  Category,
  Customer,
  Order,
  Product,
} from "../models/base.admin.model.js";
import {
  getAllReviews,
  deleteReviewById,
  deleteAllReviews,
  createMockReview,
  updateMockReview,
} from "../controllers/review.controller.js";
// import { performance } from "perf_hooks";
import { logger } from "../helpers/logger.js";
import { generateToken } from "../helpers/jwt.js";
import { isAdmin, verifyToken } from "../middleware/auth.middleware.js";
import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
import { uploadImageToCloudinary, uploadPDF } from "../helpers/cloud.js";
const router = Router();
const __fileName = import.meta.url;
const __dirName = fileURLToPath(__fileName);
cloudinary.config({
  cloud_name: "djtvn83lp",
  api_key: "389158573923714",
  api_secret: "nK6E7F-dpSaezIPQohVZhknU7V8",
  secure: true,
});

logger.log({ level: "info", message: __dirName });
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => {
//     // const ext = path.extname(file.originalname);
//     cb(
//       null,
//       `images-${Date.now()}-${Math.round(Math.random() * 1e9)}${
//         file.originalname
//       }`
//     );
//   },
// });

// const upload = multer({ storage: storage, limits: { fileSize: 5000000 } });
const storage = multer.memoryStorage();
const upload = multer({ storage });
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
    const data = await newUser.save();
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
    return res.status(200).json({ data: user, token: token });
  } catch (err) {
    console.log(err.message);
    return res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
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
router.post("/confirmpass", verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await Admin.findOne({ _id: req.id });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    const passMatch = await user.comparePassword(password);
    if (!passMatch) {
      return res.status(400).json({ error: "Incorrect Password" });
    }
    return res.status(200).json({ success: "true" });
  } catch (err) {
    console.log(err.message);
    return res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
});
router.post(
  "/products/",
  upload.fields([{ name: "images" }, { name: "labReport" }]),
  async (req, res) => {
    try {
      const { images = [], labReport = [] } = req.files;

      // Upload all images to Cloudinary
      const uploadedImages = [];

      for (const file of req.files.images) {
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `products/images`
        );
        uploadedImages.push(imageUrl);
      }

      // console.log(images);
      // Upload PDF
      const labReportUrls = [];
      for (const file of labReport) {
        const reportUrl = await await uploadPDF(file);
        labReportUrls.push(reportUrl);
      }

      const {
        name,
        category,
        description,
        discount,
        isActive,
        isFeatured,
        inStock,
        isBestSeller,
        variants,
        stocks,
        comboProduct,
        subHeading,
      } = req.body;
      const parsedProduct = {
        name,
        category,
        description,
        stocks: JSON.parse(stocks),
        discount: Number(discount),
        isActive: isActive === "true",
        isFeatured: isFeatured === "true",
        inStock: inStock === "true",
        isBestSeller: isBestSeller === "true",
        images: uploadedImages,
        labReport: labReportUrls,
        subHeading,
        comboProduct: JSON.parse(comboProduct),
        variants: JSON.parse(variants),
      };
      //   parsedProduct["comboProduct"] = JSON.parse(comboProduct);
      //  if (variants && ) {
      //     parsedProduct["variants"] = JSON.parse(variants);
      //   } else {
      //   }
      const newProduct = new Product(parsedProduct);
      const data = await newProduct.save();

      return res.status(200).json({ message: "Product created", data });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  }
);

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

router.patch(
  "/products/:id",
  upload.fields([{ name: "images" }, { name: "labReport" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { images = [], labReport = [] } = req.files;
      const {
        name,
        subHeading,
        category,
        description,
        discount,
        isActive,
        isFeatured,
        inStock,
        isBestSeller,
        variants,
        stocks,
        comboProduct,
      } = req.body;
      const existingImages = Array.isArray(req.body.existingImages)
        ? req.body.existingImages
        : req.body.existingImages
        ? [req.body.existingImages]
        : [];
      const existingReports = Array.isArray(req.body.existingReports)
        ? req.body.existingReports
        : req.body.existingReports
        ? [req.body.existingReports]
        : [];
      // upload new images
      const uploadedImages = [];

      for (const file of images) {
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `products/${id}/images`
        );
        uploadedImages.push(imageUrl);
      }
      const labReportUrls = [];
      for (const file of labReport) {
        const reportUrl = await await uploadPDF(file);
        labReportUrls.push(reportUrl);
      }

      const finalImages = [...existingImages, ...uploadedImages];
      const finalReports = [...existingReports, ...labReportUrls];
      const parsedProduct = {
        name,
        subHeading,
        category,
        description,
        discount: Number(discount),
        isActive: isActive === "true",
        isFeatured: isFeatured === "true",
        inStock: inStock === "true",
        isBestSeller: isBestSeller === "true",
        stocks: JSON.parse(stocks),
        images: finalImages,
        labReport: finalReports,
        comboProduct: JSON.parse(comboProduct),
        variants: JSON.parse(variants),
      };
      // if (variants  && variants.length > 0) {
      //   parsedProduct["variants"] = JSON.parse(variants);
      // } else {
      //   parsedProduct["comboProduct"] = JSON.parse(comboProduct);
      // }
      const updated = await Product.findByIdAndUpdate(id, parsedProduct, {
        new: true,
        runValidators: true,
      });

      if (!updated) return res.status(404).json({ error: "Product not found" });

      return res.status(200).json({ data: updated });
    } catch (err) {
      console.error("Product update failed:", err);
      return res.status(400).json({ error: err.message });
    }
  }
);
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
router.post(
  "/category",
  upload.fields([{ name: "image" }]),
  async (req, res) => {
    try {
      const imageUrl = await uploadImageToCloudinary(
        req.files.image[0].buffer,
        `products/category`
      );
      const newCategory = await Category.create({
        name: req.body.name,
        image: imageUrl,
      });
      return res.status(201).json({ data: newCategory });
    } catch (err) {
      console.error(err.message);
      return res.status(400).json({ error: "Failed To Create Category" });
    }
  }
);
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ data: categories });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to Fetch Categories" });
  }
});

// admin customer routes
// router.post("/coupon/create", async (req, res) => {});
router.get("/customers", async (req, res) => {
  try {
    const customers = await Customer.find();
    if (!customers)
      return res.status(404).json({ error: "customers not found" });
    return res.status(200).json({ data: customers });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Invalid Request" });
  }
});

router.get("/banner", async (req, res) => {
  try {
    const Banners = await Banner.find();
    res.status(200).json({ data: Banners });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Internal Server Error " });
  }
});
router.post(
  "/banner",
  upload.fields([{ name: "images" }]),
  async (req, res) => {
    try {
      const uploadedImages = [];
      for (const file of req.files.images) {
        console.log(file);
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `products/banner`
        );
        uploadedImages.push({ image: imageUrl, name: file.originalname });
      }
      const banner = await Banner.insertMany(uploadedImages);
      // const data = await banner.save()
      return res.status(200).json({ data: banner });
    } catch (err) {
      console.error(err.message);
      return res.status(400).json({ error: "Invalid Request" });
    }
  }
);
// router.get("/coupon/:id", async (req, res) => {});
// router.patch("/coupon/:id", async (req, res) => {});
// router.delete("/coupon/:id", async (req, res) => {});

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
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find();
    if (!orders) return res.status(404).json({ error: "orders not found" });
    return res.status(200).json({ data: orders });
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ error: "Internal Server Error" });
  }
});
// router.get("/orders/:id", async (req, res) => {});
// router.patch("/orders/:id", async (req, res) => {});
// router.delete("/orders/:id", async (req, res) => {});

// // admin refund routes
// router.get("/refunds", async (req, res) => {});
// router.get("/refunds/:id", async (req, res) => {});
// router.post("/refunds", async (req, res) => {});
// router.patch("/refunds/:id", async (req, res) => {});
router.get("/reviews", verifyToken, isAdmin, getAllReviews);

// DELETE /api/admin/reviews/:id
router.delete("/:id", verifyToken, isAdmin, deleteReviewById);

// DELETE /api/admin/reviews?product=<productId>
router.delete("/", verifyToken, isAdmin, deleteAllReviews);

// POST /api/admin/reviews/mock
router.post("/mock", verifyToken, isAdmin, createMockReview);

// PUT /api/admin/reviews/mock/:id
router.put("/mock/:id", verifyToken, isAdmin, updateMockReview);
export default router;
