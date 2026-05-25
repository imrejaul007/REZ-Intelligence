/**
 * REZ Demand Forecast - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const EVENT = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try { const r = await axios.get(`${AUTH}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN } }); return { valid: r.data.success }; }
  catch { return { valid: false }; }
}
export async function publishEvent(type: string, data: Record<string, unknown>) {
  try { await axios.post(`${EVENT}/api/events/publish`, { type: `demand.${type}`, source: 'REZ-demand-forecast', data }, { headers: { 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export const demandForecastRABTUL = { verifyToken, publishEvent };
export default demandForecastRABTUL;
