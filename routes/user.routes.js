import { Router } from "express";
import { logger } from "../helpers/logger.js";
import { Customer, Product } from "../models/base.admin.model.js";
import { generateToken, verifyToken } from "../helpers/jwt.js";

const router = Router()
// user auth routes
router.post("/register",async(req,res)=>{
    try {
        const { name, email, password, role } = req.body;
        const user = await Customer.findOne({ email: email });
        if (user) {
          return res.status(400).json({ error: "User Already Exists" });
        }
        const newUser = new Customer({ name, email, password });
        const userObj = await newUser.save()
        const token = await generateToken(newUser);
        return res.status(201).json({ data: userObj ,token});
      } catch (err) {
        console.log(err.message);
        return res.status(500).json({ error: "Internal Server Error" });
      }
})
router.post("/login",async(req,res)=>{
     try {
        const { email, password } = req.body;
        const user = await Customer.findOne({ email: email });
        if (!user) {
          return res.status(400).json({ error: "User Not Found" });
        }
        const passMatch = await user.comparePassword(password);
        if (!passMatch) {
          return res.status(400).json({ error: "Incorrect Password" });
        }
        const token = await generateToken(user);
        return res.status(200).json({ data:user, token: token });
      } catch (err) {
        console.log(err.message);
        return res.status(500).json({ error: "Internal Server Error" });
      }
})
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await Customer.findOne({ _id: req.id });
    if (!user) {
      return res.status(400).json({ error: "User Not Found" });
    }
    const token = await generateToken(user);
    return res.status(200).json({ data: user, token: token });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
// router.post("/logout",async(req,res)=>{})
// router.patch("/update",async(req,res)=>{})
// router.post("/update-password",async(req,res)=>{})


// // user order routes
// router.post("/orders/",async(req,res)=>{}) //c
// router.get("/orders/",async(req,res)=>{}) //r
// router.get("/orders/:id",async(req,res)=>{}) //r
// router.delete("/orders/:id",async(req,res)=>{}) //d

// // user wishlist routes
// router.post("/wishlist/",async(req,res)=>{}) //c
// router.get("/wishlist/",async(req,res)=>{}) //r
// router.delete("/wishlist/:id",async(req,res)=>{}) //d



export default router