/**
 * REZ WhatsApp Orchestrator Bridge - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const NOTIFY = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try { const r = await axios.get(`${AUTH}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN } }); return { valid: r.data.success }; }
  catch { return { valid: false }; }
}
export async function sendWhatsApp(phone: string, message: string) {
  try { await axios.post(`${NOTIFY}/api/notifications/whatsapp`, { phone, message }, { headers: { 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export const whatsappOrchestratorBridgeRABTUL = { verifyToken, sendWhatsApp };
export default whatsappOrchestratorBridgeRABTUL;
