// utils/jwt.js
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
dotenv.config();

const secret = process.env.JWT_SECRET;
// console.log("secret:",secret)
export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.__t },
    secret,
    { expiresIn: "24h" }
  );
};
export const generateRefershToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.__t },
    secret,
    { expiresIn: "7d" }
  );
};
export const verifyToken = (req,res,next) => {
  try {
      const token = req.headers.authorization?.split(" ")[1];
  
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });
      }  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);       
      req.id = decoded.id;      
  
      next();
    } catch (error) {
      logger.error("Auth middleware error:", error);
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
};