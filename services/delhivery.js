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
    if (!deliveryCodes || deliveryCodes.length === 0) {
      return false;
    }
    const remarks = deliveryCodes[0]?.postal_code?.remarks;
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
    // console.log(deliveryPincode);
    const response = await axios.get(
      `https://track.delhivery.com/api/kinko/v1/invoice/charges/.json?md=S&ss=Delivered&d_pin=${deliveryPincode}&o_pin=110042&cgm=500&pt=Pre-paid`,
      {
        headers,
      }
    );
    console.log("cost", response.data.total_amount);
    return response.data;
  } catch (error) {
    console.error(
      "Error Fetching Delivery Cost",
      error?.response?.data || error.message
    );
    throw error;
  }
}

export async function createDelhiveryOrder(shipments = []) {
  const innerPayload = {
    shipments: [shipments],
    pickup_location: { name: "Test" },
  };

  const jsonString = JSON.stringify(innerPayload);

  const params = new URLSearchParams();
  params.append("format", "json");
  params.append("data", jsonString);

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Token ${DELHIVERY_API_TOKEN}`,
  };

  try {
    const response = await axios.post(
      "https://track.delhivery.com/api/cmu/create.json",
      params,
      { headers }
    );

    const data = response.data;

    // If top-level success is false
    if (!data.success) {
      throw new Error(`Delhivery API returned success: false. Details: ${JSON.stringify(data)}`);
    }

    // If any of the individual packages failed
    const failedPackages = data.packages.filter(pkg => pkg.status !== "Success");

    if (failedPackages.length > 0) {
      const reasons = failedPackages.map(pkg => pkg.remarks?.join(", ") || "Unknown reason").join("; ");
      throw new Error(`One or more shipments failed: ${reasons}`);
    }

    return data;
  } catch (error) {
    console.error(
      "Delhivery order creation failed:",
      error?.response?.data || error.message
    );
    throw new Error(
      `Delhivery order creation failed: ${JSON.stringify(
        error?.response?.data || error.message
      )}`
    );
  }
}

