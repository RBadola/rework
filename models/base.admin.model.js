import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
import { DateTime } from "luxon";

// Get current time in IST
const istNow = DateTime.now().setZone("Asia/Kolkata");

// import { logger } from "../helpers/logger.js";
import bcrypt from "bcrypt";
import slugify from "slugify";
const BaseUserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
    firstLogin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
BaseUserSchema.set("toJSON", {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});
BaseUserSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      const pass = this.password;
      this.password = await bcrypt.hash(pass, 10);
    }
    next();
  } catch (err) {
    console.log(err.message);
    next(err);
  }
});
BaseUserSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};
export const BaseUser = models?.User || model("User", BaseUserSchema);

const AdminSchema = new Schema({
  role: {
    type: String,
    enum: ["super_admin", "admin", "junior_admin"],
    default: "junior_admin",
    required: true,
  },
});
export const Admin = BaseUser.discriminator("Admin", AdminSchema);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true }, // URL-friendly name
    description: { type: String },
    category: { type: String, required: true },
    // price: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // percentage
    finalPrice: { type: Number },
    images: [{ type: String }],
    labReport: String,
    inStock: { type: Boolean, default: true },
    // stockQuantity: { type: Number, default: 0 },
    tags: [{ type: String }], // for search
    stocks: [
      {
        stockName: String,
        stockQuantity: Number,
      },
    ],
    variants: [
      {
        variantName: String,
        variantWeight: String,
        variantPrice: Number,
        variantDiscount: Number,
      },
    ],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBestSeller: { type: Boolean, default: false },
    // deliveryDetails:{
    //    weight:{type: Number, default: 0,required:true},
    //    dimensions:{
    //     width:{type: Number, default: 0,required:true},
    //     height:{type: Number, default: 0,required:true},
    //     length:{type: Number, default: 0,required:true}
    //    },
    //    fragile:{type: Boolean, default: false,required:true}
    // }
  },
  { timestamps: true }
);
productSchema.set("toJSON", {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
productSchema.pre("save", async function (next) {
  try {
    if (this.isModified("name")) {
      this.slug = slugify(this.name, { lower: true, strict: true, trim: true });
    }
    next();
  } catch (err) {
    console.error("Error", err.message);
    console.log(err.message);
    next(err);
  }
});
productSchema.index({ category: 1 });

export const Product = models?.Product || model("Product", productSchema);

const address = new mongoose.Schema(
  {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String }, // Optional
    landmark: { type: String }, // Optional
    city: { type: String, required: true },
    state: {
      type: String,
      required: true,
      enum: [
        "Andhra Pradesh",
        "Arunachal Pradesh",
        "Assam",
        "Bihar",
        "Chhattisgarh",
        "Goa",
        "Gujarat",
        "Haryana",
        "Himachal Pradesh",
        "Jharkhand",
        "Karnataka",
        "Kerala",
        "Madhya Pradesh",
        "Maharashtra",
        "Manipur",
        "Meghalaya",
        "Mizoram",
        "Nagaland",
        "Odisha",
        "Punjab",
        "Rajasthan",
        "Sikkim",
        "Tamil Nadu",
        "Telangana",
        "Tripura",
        "Uttar Pradesh",
        "Uttarakhand",
        "West Bengal",
        "Delhi",
        "Jammu and Kashmir",
        "Ladakh",
      ],
    },
    pincode: {
      type: String,
      required: true,
      match: /^\d{6}$/, // 6-digit Indian PIN code
    },
    country: {
      type: String,
      default: "India",
    },
    type: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const CustomerSchema = new Schema({
  addresses: [address],
  phone: String,
  loyaltyPoints: Number,
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  cart: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      variantId: { type: String, required: true },
      quantity: { type: Number, default: 1 },
    },
  ],

  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
});

export const Customer = BaseUser.discriminator("Customer", CustomerSchema);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    items: [orderItemSchema],

    shippingAddress: address,

    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    couponCode: { type: String },
    finalAmount: { type: Number, required: true },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "UPI", "Card", "Netbanking", "Wallet"],
      default: "COD",
    },
    paymentDetails: {
      transactionId: String,
      provider: String,
      paymentTime: Date,
    },

    orderStatus: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "placed",
    },

    refundStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "processed"],
      default: "none",
    },

    deliveryDate: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    returnWindow: Number, // days allowed for return
    orderId: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

orderSchema.set("toJSON", {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
orderSchema.pre("save", async function (next) {
  try {
    const istNow = DateTime.now().setZone("Asia/Kolkata");
    const datePart = istNow.toFormat("HHmmyyyyLLdd");
  
    this.orderId = `ORD-${Math.random() * 9000}-${datePart}`;
    next();
  } catch (err) {
    console.error("Error", err.message);
    console.log(err.message);
    next(err);
  }
});
export const Order = models?.Order || model("Order", orderSchema);

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    image: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

categorySchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Category = models?.Category || model("Category", categorySchema);
