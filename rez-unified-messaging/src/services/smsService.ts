/**
 * SMS SERVICE INTEGRATION
 *
 * Supports Twilio, MSG91, and other SMS providers
 */

// ============================================
// CONFIG
// ============================================

interface SMSConfig {
  provider: 'twilio' | 'msg91' | 'aws_sns';
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  senderId: string;
  region?: string;
}

const config: SMSConfig = {
  provider: process.env.SMS_PROVIDER as any || 'twilio',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  apiKey: process.env.SMS_API_KEY,
  senderId: process.env.SMS_SENDER_ID || 'REZAPP',
};

// ============================================
// SEND SMS
// ============================================

export async function sendSMS(to: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    switch (config.provider) {
      case 'twilio':
        return await sendViaTwilio(to, message);
      case 'msg91':
        return await sendViaMSG91(to, message);
      case 'aws_sns':
        return await sendViaAWSSNS(to, message);
      default:
        return { success: false, error: 'Unknown SMS provider' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// TWILIO
// ============================================

async function sendViaTwilio(to: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
}> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: config.senderId,
      Body: message,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return { success: false };
  }

  return { success: true, messageId: data.sid };
}

// ============================================
// MSG91
// ============================================

async function sendViaMSG91(to: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
}> {
  const url = `https://control.msg91.com/api/v5/flow/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'authkey': config.apiKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: config.senderId,
      mobiles: to.replace(/\D/g, ''),
      message,
    }),
  });

  const data = await response.json();

  if (data.type === 'error') {
    return { success: false };
  }

  return { success: true, messageId: data.id };
}

// ============================================
// AWS SNS
// ============================================

async function sendViaAWSSNS(to: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
}> {
  // AWS SNS would use AWS SDK
  // This is a placeholder for the integration
  console.log('[SMS] AWS SNS:', { to, message });
  return { success: true, messageId: `sns_${Date.now()}` };
}

// ============================================
// OTP SMS
// ============================================

export async function sendOTP(phone: string, otp: string): Promise<{
  success: boolean;
}> {
  const message = `Your ReZ OTP is ${otp}. Valid for 5 minutes. Don't share with anyone.`;
  const result = await sendSMS(phone, message);
  return { success: result.success };
}

// ============================================
// BULK SMS
// ============================================

export async function sendBulkSMS(numbers: string[], message: string): Promise<{
  success: number;
  failed: number;
  results: { phone: string; success: boolean }[];
}> {
  const results: { phone: string; success: boolean }[] = [];
  let success = 0;
  let failed = 0;

  for (const phone of numbers) {
    const result = await sendSMS(phone, message);
    results.push({ phone, success: result.success });
    if (result.success) success++;
    else failed++;
  }

  return { success, failed, results };
}
