/**
 * REZ MCP Logs - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try { const r = await axios.get(`${AUTH}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN } }); return { valid: r.data.success }; }
  catch { return { valid: false }; }
}
export const mcpLogsRABTUL = { verifyToken };
export default mcpLogsRABTUL;
