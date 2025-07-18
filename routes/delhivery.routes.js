import { Router } from "express";
import {
  createDelhiveryOrder,
  getDeliveryCost,
  getServiceability,
  getTat,
} from "../services/delhivery.js";

const router = Router();

router.get("/estimate/:id", async (req, res) => {
  const deliveryPincode = req.params.id;
  try {
    const result = await getServiceability(deliveryPincode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/tat/:id", async (req, res) => {
  const deliveryPincode = req.params.id;

  try {
    const result = await getTat(deliveryPincode);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/cost/:id", async (req, res) => {
  const deliveryPincode = req.params.id;

  try {
    const result = await getDeliveryCost(deliveryPincode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/create", async (req, res) => {
  const {
    userId,
    items,
    shippingAddress,
    totalAmount,
    finalAmount,
    couponCode,
    paymentMethod,
    paymentDetails,
  } = req.body;
   const user = await Admin.findOne({ _id: userId });
      if (!user) {
        return res.status(400).json({ error: "User Not Found" });
      }
  const shipment = {
    name:user.name,
    add: shippingAddress?.addressLine1+shippingAddress?.addressLine2+shippingAddress?.landmark,
    pin: shippingAddress?.pincode,
    city: shippingAddress?.city,
    state: shippingAddress?.state,
    country: "IN",
    phone: user?.phone || "0000000000",
    order: "Test Order 01",
    payment_mode: "Prepaid",
    return_pin: "110095",
    return_city: "Delhi",
    return_phone: "8882541082",
    return_add: "Dilshad Colony",
    return_state: "Delhi",
    return_country: "IN",
    products_desc: "Test",
    hsn_code: "",
    cod_amount: "",
    order_date: null,
    total_amount: finalAmount,
    seller_add: "",
    seller_name: "",
    seller_inv: "",
    quantity: "",
    waybill: "",
    shipment_width: "100",
    shipment_height: "100",
    weight: "500",
    shipping_mode: "Surface",
    address_type: "Home",
  };
  try {
    const result = await createDelhiveryOrder(shipment);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
