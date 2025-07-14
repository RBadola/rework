import {
  createShipment,
  trackShipment,
  cancelShipment,
  getInvoice,
} from "./zippyy.service.js";

export const createShipmentHandler = async (req, res) => {
  try {
    const shipment = await createShipment(req.body);
    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create shipment" });
  }
};

export const trackShipmentHandler = async (req, res) => {
  try {
    const tracking = await trackShipment(req.params.orderId);
    res.json(tracking);
  } catch (err) {
    res.status(500).json({ message: "Failed to track shipment" });
  }
};

export const cancelShipmentHandler = async (req, res) => {
  try {
    const result = await cancelShipment(req.params.orderId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to cancel shipment" });
  }
};

export const invoiceHandler = async (req, res) => {
  try {
    const pdfBuffer = await getInvoice(req.params.orderId);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ message: "Failed to get invoice" });
  }
};
