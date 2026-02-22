import axios from 'axios';
export async function sendToMT5(order) {
  const BRIDGE = process.env.MT5_BRIDGE_URL;
  if (!BRIDGE) return { mock: true, price: 2000 + Math.random() * 5 };
  const res = await axios.post(`${BRIDGE}/trade`, order);
  return res.data;
}
