/**
 * REZ DOOH Attribution - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const EVENT = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try { const r = await axios.get(`${AUTH}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN } }); return { valid: r.data.success }; }
  catch { return { valid: false }; }
}
export async function addCoins(userId: string, amount: number, reason: string) {
  try { await axios.post(`${WALLET}/api/wallet/add`, { userId, amount, reason }, { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export async function publishEvent(type: string, data: Record<string, any>) {
  try { await axios.post(`${EVENT}/api/events/publish`, { type: `dooh.${type}`, source: 'REZ-dooh-attribution', data }, { headers: { 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export const doohAttributionRABTUL = { verifyToken, addCoins, publishEvent };
export default doohAttributionRABTUL;
