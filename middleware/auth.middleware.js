
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import { logger } from "../helpers/logger.js";
dotenv.config()

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user based on type
    // let user;
    // switch (decoded.userType) {
    //   case "SuperAdmin":
    //     user = await SuperAdmin.findById(decoded.id).select("-password");
    //     break;
    //   case "ProductAdmin":
    //     user = await ProductAdmin.findById(decoded.id).select("-password");
    //     break;
    //   case "SupportAdmin":
    //     user = await SupportAdmin.findById(decoded.id).select("-password");
    //     break;
    //   default:
    //     return res.status(401).json({
    //       success: false,
    //       message: "Invalid user type",
    //     });
    // }
    // if (!user) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "User not found",
    //   });
    // }

    // if (!user.isApproved) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Account pending approval",
    //   });
    // }

    // if (user.status !== "active") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Account is not active",
    //   });
    // }

    // req.user = user;
    req.id = decoded.id; // optional, if you still want the id separately
    req.role = decoded.role; // optional, if you still want the id separately
    // logger.info("User:", user); // this will now print

    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};
