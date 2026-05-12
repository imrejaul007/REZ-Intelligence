/**
 * Twilio Voice Configuration
 * Handles all Twilio-related configuration and initialization
 */

import twilio, { Twilio } from 'twilio';
import { logger } from '../utils/logger';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  applicationSid?: string;
  callRecordingEnabled: boolean;
  transcriptionEnabled: boolean;
  maxCallDurationSeconds: number;
  webhookBaseUrl: string;
}

let twilioClient: Twilio | null = null;

export function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const applicationSid = process.env.TWILIO_APPLICATION_SID;
  const callRecordingEnabled = process.env.TWILIO_RECORDING_ENABLED !== 'false';
  const transcriptionEnabled = process.env.TWILIO_TRANSCRIPTION_ENABLED !== 'false';
  const maxCallDurationSeconds = parseInt(process.env.TWILIO_MAX_CALL_DURATION || '14400', 10);
  const webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || 'https://your-domain.com';

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error('Missing required Twilio configuration: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
  }

  return {
    accountSid,
    authToken,
    phoneNumber,
    applicationSid,
    callRecordingEnabled,
    transcriptionEnabled,
    maxCallDurationSeconds,
    webhookBaseUrl
  };
}

export function getTwilioClient(): Twilio {
  if (!twilioClient) {
    const config = getTwilioConfig();
    twilioClient = twilio(config.accountSid, config.authToken);
    logger.info('Twilio client initialized', { accountSid: config.accountSid });
  }
  return twilioClient;
}

export function generateTwiMLResponse(response: string, config?: {
  voice?: 'alice' | 'man' | 'woman';
  language?: string;
  loop?: number;
}): string {
  const voice = config?.voice || 'alice';
  const language = config?.language || 'en-US';
  const loop = config?.loop || 1;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}" loop="${loop}">${escapeXml(response)}</Say>
</Response>`;
}

export function generateGatherTwiML(options: {
  prompt: string;
  numDigits: number;
  timeout: number;
  action: string;
  method?: 'POST' | 'GET';
  voice?: 'alice' | 'man' | 'woman';
  language?: string;
  partialPrompt?: string;
}): string {
  const method = options.method || 'POST';
  const voice = options.voice || 'alice';
  const language = options.language || 'en-US';
  const partialPrompt = options.partialPrompt || options.prompt;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="${options.numDigits}" timeout="${options.timeout}" action="${options.action}" method="${method}">
    <Say voice="${voice}" language="${language}">${escapeXml(options.prompt)}</Say>
    <Pause length="1"/>
    <Say voice="${voice}" language="${language}">${escapeXml(partialPrompt)}</Say>
  </Gather>
  <Redirect method="POST">${options.action}</Redirect>
</Response>`;
}

export function generateStreamTwiML(wsUrl: string, streamName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream name="${streamName}" url="${wsUrl}" track="inbound_track">
      <Parameter name="type" value="speech"/>
    </Stream>
  </Start>
  <Say voice="alice" language="en-US">Connecting you now.</Say>
  <Pause length="3600"/>
</Response>`;
}

export function generateDialTwiML(number: string, config?: {
  callerId?: string;
  timeout?: number;
  record?: boolean;
  recordingChannels?: 'mono' | 'dual';
}): string {
  const callerId = config?.callerId || getTwilioConfig().phoneNumber;
  const timeout = config?.timeout || 30;
  const record = config?.record ? 'record-from-ringing' : false;
  const recordingChannels = config?.recordingChannels || 'mono';

  let dialContent = `<Number>${escapeXml(number)}</Number>`;

  if (record) {
    dialContent = `<Number>${escapeXml(number)}</Number>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="${timeout}" record="${record}" recordingChannels="${recordingChannels}">
    ${dialContent}
  </Dial>
</Response>`;
}

export function generateRecordTwiML(action: string, config?: {
  maxLength?: number;
  timeout?: number;
  transcribe?: boolean;
  playBeep?: boolean;
}): string {
  const maxLength = config?.maxLength || 3600;
  const timeout = config?.timeout || 5;
  const transcribe = config?.transcribe !== false;
  const playBeep = config?.playBeep !== false;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record
    maxLength="${maxLength}"
    timeout="${timeout}"
    transcribe="${transcribe}"
    playBeep="${playBeep}"
    action="${action}"
    method="POST"
    recordingStatusCallback="${action}"
  />
  <Say voice="alice" language="en-US">No voicemail received. Goodbye.</Say>
</Response>`;
}

export function generateRejectTwiML(reason?: 'busy' | 'rejected'): string {
  const reasonAttr = reason ? ` reason="${reason}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject${reasonAttr}/>
</Response>`;
}

export function generatePauseTwiML(length: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="${length}"/>
</Response>`;
}

export function generateConferenceTwiML(
  conferenceName: string,
  config?: {
    muted?: boolean;
    beep?: boolean;
    startOnEnter?: boolean;
    endOnExit?: boolean;
    maxParticipants?: number;
    record?: 'record-from-start' | 'do-not-record';
    coach?: boolean;
  }
): string {
  const muted = config?.muted ? 'true' : 'false';
  const beep = config?.beep !== false ? 'true' : 'false';
  const startOnEnter = config?.startOnEnter !== false ? 'true' : 'false';
  const endOnExit = config?.endOnExit ? 'true' : 'false';
  const maxParticipants = config?.maxParticipants || 10;
  const record = config?.record || 'do-not-record';
  const coach = config?.coach ? 'true' : 'false';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      muted="${muted}"
      beep="${beep}"
      startOnEnter="${startOnEnter}"
      endOnExit="${endOnExit}"
      maxParticipants="${maxParticipants}"
      record="${record}"
      coach="${coach}"
    >${escapeXml(conferenceName)}</Conference>
  </Dial>
</Response>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function initiateOutboundCall(params: {
  to: string;
  from?: string;
  url: string;
  statusCallback?: string;
  timeout?: number;
}): Promise<{ callSid: string; status: string }> {
  const client = getTwilioClient();
  const config = getTwilioConfig();

  try {
    const call = await client.calls.create({
      to: params.to,
      from: params.from || config.phoneNumber,
      url: params.url,
      statusCallback: params.statusCallback,
      timeout: params.timeout || 30,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    logger.info('Outbound call initiated', {
      callSid: call.sid,
      to: params.to,
      from: params.from || config.phoneNumber
    });

    return { callSid: call.sid, status: call.status };
  } catch (error) {
    logger.error('Failed to initiate outbound call', { error, params });
    throw error;
  }
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.warn('TWILIO_AUTH_TOKEN not set, skipping signature validation');
    return true;
  }
  return twilio.validateRequest(authToken, signature, url, params);
}
