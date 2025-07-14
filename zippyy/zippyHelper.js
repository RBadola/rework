import axios from 'axios';
import dotenv from "dotenv"
dotenv.config()
let cachedToken = null;
let tokenExpiresAt = 0;
const BASE_URL = process.env.NODE_ENV === "development"?process.env.ZIPPYY_SANDBOX_URL : process.env.ZIPPYY_PRODUCTION_URL
export async function getZippyyToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await axios.post(`${BASE_URL}/v1/external/auth/login`, {
    emailAddress: process.env.ZIPPYY_EMAIL,
    password: process.env.ZIPPYY_PASSWORD,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': '1',
    },
  });

  cachedToken = response.data.accessToken;
  tokenExpiresAt = now + 4.5 * 60 * 1000; // 4.5 mins buffer

  return cachedToken;
}
