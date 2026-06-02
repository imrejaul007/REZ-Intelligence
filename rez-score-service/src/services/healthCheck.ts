/**
 * Health Check
 */

import mongoose from 'mongoose';

export async function healthCheck() {
  const mongoOk = mongoose.connection.readyState === 1;
  return {
    healthy: mongoOk,
    mongodb: mongoOk,
    timestamp: new Date().toISOString(),
  };
}
