/**
 * REZ Delivery Intelligence - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFY = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try { const r = await axios.get(`${AUTH}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN } }); return { valid: r.data.success }; }
  catch { return { valid: false }; }
}
export async function addCoins(userId: string, amount: number, reason: string) {
  try { await axios.post(`${WALLET}/api/wallet/add`, { userId, amount, reason }, { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export async function notifyUser(userId: string, title: string, body: string) {
  try { await axios.post(`${NOTIFY}/api/notifications/push`, { userId, title, body }, { headers: { 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export const deliveryIntelligenceRABTUL = { verifyToken, addCoins, notifyUser };
export default deliveryIntelligenceRABTUL;
