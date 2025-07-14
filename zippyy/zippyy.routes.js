import express from "express";
import {
  createShipmentHandler,
  trackShipmentHandler,
  cancelShipmentHandler,
  invoiceHandler,
} from "./zippyy.controller.js";

const router = express.Router();

router.post("/zippyy/create", createShipmentHandler);
router.get("/zippyy/track/:orderId", trackShipmentHandler);
router.put("/zippyy/cancel/:orderId", cancelShipmentHandler);
router.get("/zippyy/invoice/:orderId", invoiceHandler);

export default router;
