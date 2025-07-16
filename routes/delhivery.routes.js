import { Router } from "express";
import { getServiceability, getTat } from "../services/delhivery.js";

const router = Router();

router.get("/estimate/:id", async (req, res) => {
   const  deliveryPincode  = req.params.id;
  try {
    const result = await getServiceability(deliveryPincode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/tat/:id", async (req, res) => {
  const  deliveryPincode  = req.params.id;

  try {
    const result = await getTat(deliveryPincode);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
