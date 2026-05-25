/**
 * REZ Customer Intelligence Hub - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PROFILE = process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com';
const WALLET = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try { const r = await axios.get(`${AUTH}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN } }); return { valid: r.data.success }; }
  catch { return { valid: false }; }
}
export async function getProfile(userId: string) {
  try { const r = await axios.get(`${PROFILE}/api/profiles/${userId}`, { headers: { 'X-Internal-Token': TOKEN } }); return { profile: r.data }; }
  catch { return { profile: null }; }
}
export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  try { await axios.patch(`${PROFILE}/api/profiles/${userId}`, updates, { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TOKEN } }); return { success: true }; }
  catch { return { success: false }; }
}
export async function getWallet(userId: string) {
  try { const r = await axios.get(`${WALLET}/api/wallet/${userId}/balance`, { headers: { 'X-Internal-Token': TOKEN } }); return { wallet: r.data }; }
  catch { return { wallet: null }; }
}
export const customerIntelligenceHubRABTUL = { verifyToken, getProfile, updateProfile, getWallet };
export default customerIntelligenceHubRABTUL;
