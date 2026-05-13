export enum ToneType {
  PROFESSIONAL = 'professional',
  ALERT = 'alert',
  CAUTIOUS = 'cautious',
  URGENT = 'urgent',
  REASSURING = 'reassuring',
}

export interface ToneConfig {
  type: ToneType;
  prefix: string;
  suffix: string;
  emoji?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export const TONE_CONFIGS: Record<ToneType, ToneConfig> = {
  [ToneType.PROFESSIONAL]: {
    type: ToneType.PROFESSIONAL,
    prefix: '',
    suffix: '.',
    urgency: 'low',
  },
  [ToneType.ALERT]: {
    type: ToneType.ALERT,
    prefix: '[ALERT] ',
    suffix: ' - Review required.',
    urgency: 'medium',
  },
  [ToneType.CAUTIOUS]: {
    type: ToneType.CAUTIOUS,
    prefix: '[CAUTION] ',
    suffix: ' - Proceeding with verification.',
    urgency: 'medium',
  },
  [ToneType.URGENT]: {
    type: ToneType.URGENT,
    prefix: '[URGENT] ',
    suffix: ' - Immediate action required.',
    urgency: 'high',
  },
  [ToneType.REASSURING]: {
    type: ToneType.REASSURING,
    prefix: '',
    suffix: ' - Transaction secured.',
    urgency: 'low',
  },
};

export function getToneForRiskScore(riskScore: number): ToneConfig {
  if (riskScore >= 90) {
    return TONE_CONFIGS[ToneType.URGENT];
  } else if (riskScore >= 75) {
    return TONE_CONFIGS[ToneType.ALERT];
  } else if (riskScore >= 50) {
    return TONE_CONFIGS[ToneType.CAUTIOUS];
  } else if (riskScore >= 25) {
    return TONE_CONFIGS[ToneType.PROFESSIONAL];
  } else {
    return TONE_CONFIGS[ToneType.REASSURING];
  }
}

export function formatMessageWithTone(
  message: string,
  tone: ToneConfig
): string {
  return `${tone.prefix}${message}${tone.suffix}`;
}

export function getUrgencyLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 90) return 'critical';
  if (riskScore >= 75) return 'high';
  if (riskScore >= 50) return 'medium';
  return 'low';
}
