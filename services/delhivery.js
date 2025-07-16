import axios from "axios";
import { DateTime } from "luxon";
import { config } from "dotenv";
config();
const DELHIVERY_API_TOKEN = process.env.DELHIVERY_API_TOKEN; // keep it in .env

const headers = {
  "Content-Type": "application/json",
  Authorization: `Token ${DELHIVERY_API_TOKEN}`,
  Accept: "application/json",
};
export async function getTat(deliveryPincode) {
  try {
    const pickupDate = DateTime.now()
      .plus({ days: 1 })
      .toFormat("yyyy-MM-dd hh:mm");
    console.log(pickupDate);
    const response = await axios.get(
      `https://track.delhivery.com/api/dc/expected_tat?origin_pin=110095&destination_pin=${deliveryPincode}&mot=S&pdt=B2C&expected_pickup_date=${pickupDate}`,
      {
        headers,
      }
    );

    const data = response.data;

    if (!data.success) {
      throw new Error(data.error || "Delhivery TAT lookup failed");
    }

    return {
      data,
    };
  } catch (error) {
    console.error("Error fetching TAT", error?.response?.data || error.message);
    throw error;
  }
}

export async function getServiceability(deliveryPincode) {
  try {
    console.log(deliveryPincode);
    const response = await axios.get(
      `https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${deliveryPincode}`,
      {
        headers,
      }
    );

    const deliveryCodes = response.data?.delivery_codes;

    // If response is empty or malformed, return false
    if (!deliveryCodes || deliveryCodes.length === 0) {
      return false;
    }

    const remarks = deliveryCodes[0]?.postal_code?.remarks;

    // ✅ Only serviceable if remarks is exactly "" (empty string or undefined)
    if (!remarks || remarks.trim() === "") {
      return await getTat(deliveryPincode);
    }
  } catch (error) {
    console.error(
      "Error fetching Servicability",
      error?.response?.data || error.message
    );
    throw error;
  }
}

export async function getDeliveryCost(deliveryPincode) {
  try {
    console.log(deliveryPincode);
    const response = await axios.get(
      `https://track.delhivery.com/api/kinko/v1/invoice/charges/.json?md=S&ss=Delivered&d_pin=${deliveryPincode}&o_pin=110042&cgm=10&pt=Pre-paid`,
      {
        headers,
      }
    );

    const deliveryCodes = response.data?.delivery_codes;

    
    // If response is empty or malformed, return false
    if (!deliveryCodes || deliveryCodes.length === 0) {
      return false;
    }

    const remarks = deliveryCodes[0]?.postal_code?.remarks;

    // ✅ Only serviceable if remarks is exactly "" (empty string or undefined)
    if (!remarks || remarks.trim() === "") {
      return await getTat(deliveryPincode);
    }
  } catch (error) {
    console.error(
      "Error fetching Servicability",
      error?.response?.data || error.message
    );
    throw error;
  }
}

