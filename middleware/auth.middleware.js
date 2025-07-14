
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import { logger } from "../helpers/logger.js";
dotenv.config()

export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  // const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }
  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);


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
