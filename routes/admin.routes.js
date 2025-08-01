import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import {
  About,
  Admin,
  Banner,
  BaseUser,
  Category,
  Coupon,
  Customer,
  Order,
  Product,
  SaleOffer,
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
import {
  deleteFromCloudinary,
  uploadImageToCloudinary,
  uploadPDF,
} from "../helpers/cloud.js";
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

const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 500MB
  },
  storage: multer.memoryStorage(), // or diskStorage
});
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
  upload.fields([{ name: "images" }, { name: "labReport" }, { name: "video" }]),
  async (req, res) => {
    try {
      const {
        images = [],
        labReport = [],
        video: [],
      } = req.files;

      // Upload all images to Cloudinary
      const uploadedImages = [];

      for (const file of req.files.images) {
        const imageUrl = await uploadImageToCloudinary(
          file.buffer,
          `products/images`
        );
        uploadedImages.push(imageUrl);
      }
      let videoUrl = null;

      if (video.length > 0) {
        videoUrl = await uploadVideoToCloudinary(video[0].buffer);
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
        gst,
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
        gst,
        comboProduct: JSON.parse(comboProduct),
        variants: JSON.parse(variants),video: videoUrl,
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

// DELETE /category/:id
router.delete("/category/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(category.image);

    // Delete category from DB
    await Category.findByIdAndDelete(req.params.id);

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to delete category" });
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
  upload.fields([
    { name: "deskimage", maxCount: 1 },
    { name: "mobimage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const deskImageFile = req.files?.deskimage?.[0];
      const mobImageFile = req.files?.mobimage?.[0];

      if (!deskImageFile || !mobImageFile) {
        return res.status(400).json({ error: "Both images are required" });
      }

      const deskImageUrl = await uploadImageToCloudinary(
        deskImageFile.buffer,
        `banners/desktop`
      );

      const mobImageUrl = await uploadImageToCloudinary(
        mobImageFile.buffer,
        `banners/mobile`
      );

      const banner = new Banner({
        deskimage: deskImageUrl,
        mobimage: mobImageUrl,
        name: deskImageFile.originalname || "New Banner",
        url: req.body.url,
        status: "inactive",
      });

      const savedBanner = await banner.save();

      return res.status(200).json({ data: savedBanner });
    } catch (err) {
      console.error("Banner upload error:", err.message);
      return res.status(500).json({ error: "Failed to upload banner" });
    }
  }
);

// PATCH /banner/:id/status
router.patch("/banner/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedBanner) {
      return res.status(404).json({ error: "Banner not found" });
    }

    res.status(200).json({ data: updatedBanner });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.delete("/banner/:id", async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: "Banner not found" });
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(banner.image);

    // Remove from DB
    await Banner.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Banner deleted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to delete banner" });
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
router.post("/about", upload.fields([{ name: "images" }]), async (req, res) => {
  try {
    const uploadedImages = [];
    for (const file of req.files.images) {
      console.log(file);
      const imageUrl = await uploadImageToCloudinary(file.buffer, `about`);
      uploadedImages.push({ image: imageUrl, name: file.originalname });
    }
    const banner = await About.insertMany(uploadedImages);
    // const data = await banner.save()
    return res.status(200).json({ data: banner });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Invalid Request" });
  }
});
router.delete("/about/:id", async (req, res) => {
  try {
    const banner = await About.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: "About not found" });
    }
    console.log("To Be Deleted Banner:", banner);

    // Delete image from Cloudinary
    await deleteFromCloudinary(banner.image);

    // Remove from DB
    const deleted = await About.findByIdAndDelete(req.params.id);
    console.log("Deleted Banner:", deleted, req.params.id);
    res.status(200).json({ message: "About deleted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to delete about" });
  }
});

router.post("/offer", async (req, res) => {
  try {
    const offer = req.body.offer;
    const saleOffer = await SaleOffer.create(offer);
    res.status(200).json({ data: saleOffer });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Invalid Request" });
  }
});
router.get("/offer", async (req, res) => {
  try {
    const offer = req.body.offer;
    const saleOffer = await SaleOffer.find();
    res.status(200).json({ data: saleOffer });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Invalid Request" });
  }
});
router.post("/coupon", async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    return res.status(201).json({ data: coupon });
  } catch (err) {
    console.error(err.message);
    return res.status(400).json({ error: "Failed to create coupon" });
  }
});
router.get("/coupons", async (req, res) => {
  try {
    const coupons = await Coupon.find();
    return res.status(200).json({ data: coupons });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to fetch coupons" });
  }
});
router.patch("/coupon/:id", async (req, res) => {
  try {
    const updated = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "Coupon not found" });
    return res.status(200).json({ data: updated });
  } catch (err) {
    return res.status(400).json({ error: "Failed to update coupon" });
  }
});
router.delete("/coupon/:id", async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Coupon not found" });
    return res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (err) {
    return res.status(400).json({ error: "Failed to delete coupon" });
  }
});
router.get("/analytics/summary", async (req, res) => {
  try {
    const [totalUsers, totalOrders, totalProducts, totalRevenue] =
      await Promise.all([
        Customer.countDocuments(),
        Order.countDocuments(),
        Product.countDocuments(),
        Order.aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]),
      ]);

    return res.status(200).json({
      users: totalUsers,
      orders: totalOrders,
      products: totalProducts,
      revenue: totalRevenue?.[0]?.total || 0,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to fetch summary" });
  }
});
router.get("/analytics/orders/daily", async (req, res) => {
  try {
    const data = await Order.aggregate([
      {
        $match: { paymentStatus: "paid" },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$finalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({ data });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to fetch daily analytics" });
  }
});
router.get("/analytics/products/top", async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]);
    return res.status(200).json({ data: topProducts });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to fetch top products" });
  }
});

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

// Coupon model structure
