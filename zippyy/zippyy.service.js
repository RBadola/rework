import axios from "axios";
import { getZippyyToken } from "./zippyHelper";
import dotenv from "dotenv"
dotenv.config()
const BASE_URL = process.env.NODE_ENV === "development"?process.env.ZIPPYY_SANDBOX_URL : process.env.ZIPPYY_PRODUCTION_URL
export async function createShipment(payload) {
  const token = await getZippyyToken();

  const { data } = await axios.post(`${BASE_URL}/v1/external/shipments/forward-shipment`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return data;
}

export async function trackShipment(orderId) {
  const token = await getZippyyToken();

  const { data } = await axios.get(`${BASE_URL}/v1/external/shipments?orderIds=${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data;
}

export async function cancelShipment(orderId) {
  const token = await getZippyyToken();

  const { data } = await axios.put(`${BASE_URL}/v1/external/shipments/${orderId}/cancel`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data;
}

export async function getInvoice(orderId) {
  const token = await getZippyyToken();

  const { data } = await axios.get(`${BASE_URL}/v1/external/shipments/${orderId}/invoice`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
    responseType: "arraybuffer",
  });

  return data; // You can store this as PDF or return base64 to frontend
}
