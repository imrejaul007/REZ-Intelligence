/**
 * Finance-specific nudge campaigns
 * Triggers targeted actions based on user financial behavior
 */
import axios from 'axios';

const FINANCE_SERVICE_URL = process.env.FINANCE_SERVICE_URL || 'https://rez-finance-service.onrender.com';
const PUSH_SERVICE_URL = process.env.PUSH_SERVICE_URL || 'https://rez-notification-service.onrender.com';

export interface FinanceNudge {
  id: string;
  trigger: 'dormant_finance' | 'emi_due' | 'score_check' | 'loan_ready' | 'bnpl_reminder';
  condition: (user) => boolean;
  action: 'push' | 'whatsapp' | 'both';
  templates: {
    title: string;
    body: string;
    cta?: string;
  };
  priority: 'low' | 'medium' | 'high';
}

export const financeNudges: FinanceNudge[] = [
  {
    id: 'dormant_finance_interest',
    trigger: 'dormant_finance',
    condition: (user) =>
      user.becameDormant &&
      (user.lastIntent.includes('loan') ||
       user.lastIntent.includes('credit') ||
       user.lastIntent.includes('finance')),
    action: 'both',
    priority: 'high',
    templates: {
      title: "Your loan offer is waiting!",
      body: "Complete your application - you pre-qualify for ₹{{amount}}",
      cta: "Apply Now"
    }
  },
  {
    id: 'emi_reminder_3_days',
    trigger: 'emi_due',
    condition: (user) => user.emiDueInDays === 3,
    action: 'push',
    priority: 'high',
    templates: {
      title: "EMI due in 3 days",
      body: "Pay ₹{{emiAmount}} before {{dueDate}} to maintain your REZ Score",
      cta: "Pay Now"
    }
  },
  {
    id: 'emi_reminder_1_day',
    trigger: 'emi_due',
    condition: (user) => user.emiDueInDays === 1,
    action: 'both',
    priority: 'high',
    templates: {
      title: "EMI due tomorrow!",
      body: "Don't let your REZ Score drop - pay ₹{{emiAmount}} today",
      cta: "Pay Now"
    }
  },
  {
    id: 'score_check_reminder',
    trigger: 'score_check',
    condition: (user) =>
      user.financialSignals?.creditScoreChecks > 0 &&
      user.financialSignals?.approvals === 0 &&
      user.lastScoreCheckDaysAgo > 14,
    action: 'push',
    priority: 'medium',
    templates: {
      title: "Check your updated REZ Score",
      body: "Your score may have improved! See your new credit eligibility",
      cta: "Check Score"
    }
  },
  {
    id: 'loan_ready_high_engagement',
    trigger: 'loan_ready',
    condition: (user) =>
      user.intentStrength > 0.7 &&
      user.financialSignals?.approvals === 0 &&
      user.financialSignals?.loanApplications < 2,
    action: 'both',
    priority: 'medium',
    templates: {
      title: "You're pre-approved!",
      body: "Based on your activity, you qualify for a ₹{{amount}} loan @ {{rate}}% interest",
      cta: "Apply Now"
    }
  },
  {
    id: 'bnpl_usage_reminder',
    trigger: 'bnpl_reminder',
    condition: (user) =>
      user.financialSignals?.bnplUsage > 0 &&
      user.daysSinceLastBNPL > 14,
    action: 'push',
    priority: 'low',
    templates: {
      title: "BNPL waiting for you",
      body: "Your ₹{{bnplLimit}} BNPL limit is ready. Use it on your next purchase!",
      cta: "Shop Now"
    }
  }
];

/**
 * Process finance nudges for a user
 */
export async function processFinanceNudge(user): Promise<void> {
  for (const nudge of financeNudges) {
    if (nudge.condition(user)) {
      await sendFinanceNudge(user, nudge);
    }
  }
}

/**
 * Send finance nudge via push/whatsapp
 */
async function sendFinanceNudge(user, nudge: FinanceNudge): Promise<void> {
  // Personalize message
  const message = personalizeTemplate(nudge.templates, user);

  if (nudge.action === 'push' || nudge.action === 'both') {
    await sendPush(user.userId, message, nudge.id);
  }

  if (nudge.action === 'whatsapp' || nudge.action === 'both') {
    await sendWhatsApp(user.userId, message);
  }
}

function personalizeTemplate(template, user): unknown {
  const personalized = { ...template };

  // Replace placeholders with user data
  for (const key of Object.keys(personalized)) {
    if (typeof personalized[key] === 'string') {
      personalized[key] = personalized[key]
        .replace('{{amount}}', user.qualifyingAmount || '50,000')
        .replace('{{rate}}', user.bestRate || '12')
        .replace('{{emiAmount}}', user.nextEMIAmount || '5,000')
        .replace('{{dueDate}}', user.nextEMIDueDate || 'March 15')
        .replace('{{bnplLimit}}', user.bnplLimit || '10,000')
        .replace('{{score}}', user.reqScore || '700');
    }
  }

  return personalized;
}

async function sendPush(userId: string, message, nudgeId: string): Promise<void> {
  try {
    await axios.post(`${PUSH_SERVICE_URL}/api/push/send`, {
      userId,
      title: message.title,
      body: message.body,
      data: { nudgeId },
    });
  } catch (error) {
    console.error('[FinanceNudge] Push failed:', error);
  }
}

async function sendWhatsApp(userId: string, message): Promise<void> {
  try {
    await axios.post(`${PUSH_SERVICE_URL}/api/whatsapp/send`, {
      userId,
      template: 'finance_reminder',
      params: { title: message.title, body: message.body },
    });
  } catch (error) {
    console.error('[FinanceNudge] WhatsApp failed:', error);
  }
}
