/**
 * Campaign/Advertising Knowledge Base
 * Handles all campaign and advertising related intents, entities, and responses
 * Includes reward types, attribution methods, claim processes, and common questions
 */

export interface RewardType {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  icon: string;
  requiresVerification?: boolean;
  expiresIn?: number; // days
}

export interface AttributionMethod {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  verification: string;
  icon: string;
}

export interface ClaimProcess {
  rewardType: string;
  steps: string[];
  verification: string;
  fulfillment: string;
  estimatedTime?: string;
}

export interface CampaignType {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  icon: string;
}

export interface CommonQuestion {
  id: string;
  keywords: string[];
  response: string;
  relatedTopics?: string[];
}

export interface CampaignAdsKB {
  rewardTypes: {
    types: RewardType[];
    responses: {
      rewardExplanation: string;
      earningInfo: string;
      claimingInfo: string;
      expirationInfo: string;
    };
  };

  attribution: {
    methods: AttributionMethod[];
    responses: {
      verificationProcess: string;
      gpsAccuracy: string;
      manualVerification: string;
    };
  };

  claimProcess: {
    processes: { [key: string]: ClaimProcess };
    responses: {
      generalProcess: string;
      automaticCrediting: string;
      manualClaim: string;
      verificationRequired: string;
    };
  };

  campaignTypes: {
    types: CampaignType[];
    responses: {
      campaignDescription: string;
      howToParticipate: string;
      termsApply: string;
    };
  };

  commonQuestions: CommonQuestion[];

  intents: {
    greetings: string[];
    rewards: string[];
    earning: string[];
    redeeming: string[];
    verification: string[];
    expiration: string[];
    complaints: string[];
    support: string[];
    campaignInfo: string[];
  };

  responses: {
    greeting: string;
    welcome: string;
    rewardInfo: string;
    howToEarn: string;
    howToRedeem: string;
    notUnderstood: string;
    supportTransfer: string;
  };

  contextSlots: {
    campaignId: boolean;
    rewardType: boolean;
    merchantId: boolean;
    userId: boolean;
    timestamp: boolean;
    locationVerified: boolean;
  };
}

// ====== REWARD TYPES ======
const rewardTypes: RewardType[] = [
  {
    id: 'coins',
    name: 'REZ Coins',
    keywords: ['coins', 'coin', 'rez coins', 'points', 'credit', 'balance', 'wallet', 'earning'],
    description: 'Earn REZ coins that can be used across all partner merchants. Coins are flexible currency within the REZ ecosystem.',
    icon: '🪙',
    requiresVerification: false,
    expiresIn: 90
  },
  {
    id: 'discount',
    name: 'Discount',
    keywords: ['discount', 'off', 'percentage', 'cashback', 'savings', 'deal', 'offer', 'reduce', 'promo'],
    description: 'Get percentage or fixed amount off your purchase. Discounts are applied at checkout.',
    icon: '🏷️',
    requiresVerification: true,
    expiresIn: 30
  },
  {
    id: 'sample',
    name: 'Free Sample',
    keywords: ['sample', 'free sample', 'try', 'test', 'demo', 'freebie', 'complimentary'],
    description: 'Claim a free sample at any partner location. Show your redemption code to claim.',
    icon: '🎁',
    requiresVerification: true,
    expiresIn: 7
  },
  {
    id: 'consultation',
    name: 'Free Consultation',
    keywords: ['consultation', 'consult', 'expert', 'advice', 'appointment', 'booking', 'session'],
    description: 'Book a free consultation with our experts. Valid for a one-time session on selected services.',
    icon: '👨‍💼',
    requiresVerification: true,
    expiresIn: 30
  },
  {
    id: 'contest',
    name: 'Contest Entry',
    keywords: ['contest', 'competition', 'win', 'prize', 'draw', 'lottery', 'entry', 'chance to win'],
    description: 'Enter to win exciting prizes. Winners are selected and notified based on contest terms.',
    icon: '🎯',
    requiresVerification: false,
    expiresIn: 0
  },
  {
    id: 'voucher',
    name: 'Voucher',
    keywords: ['voucher', 'coupon', 'gift certificate', 'gift card', 'credit note'],
    description: 'Receive a voucher valid for specific products or services. Vouchers have set denominations.',
    icon: '🎫',
    requiresVerification: true,
    expiresIn: 60
  },
  {
    id: 'upgrade',
    name: 'Free Upgrade',
    keywords: ['upgrade', 'premium', 'upgraded', 'better', 'enhance', 'premium access'],
    description: 'Get a complimentary upgrade to premium features, rooms, seats, or services.',
    icon: '⬆️',
    requiresVerification: true,
    expiresIn: 30
  },
  {
    id: 'loyalty_tier',
    name: 'Loyalty Tier Upgrade',
    keywords: ['tier', 'gold', 'silver', 'platinum', 'membership', 'level', 'status'],
    description: 'Advance to a higher loyalty tier with exclusive benefits and accelerated earning rates.',
    icon: '⭐',
    requiresVerification: false,
    expiresIn: 0
  }
];

// ====== ATTRIBUTION METHODS ======
const attributionMethods: AttributionMethod[] = [
  {
    id: 'scan',
    name: 'QR Code Scan',
    keywords: ['scan', 'scanning', 'qr', 'qr code', 'code', 'scanned', 'scan qr'],
    description: 'Earn rewards by scanning QR codes at partner locations using the REZ app.',
    verification: 'Automatic verification via QR code scan with timestamp and location.',
    icon: '📱'
  },
  {
    id: 'visit',
    name: 'Store Visit',
    keywords: ['visit', 'visiting', 'store', 'location', 'in-store', 'arrived', 'entering', 'geofence'],
    description: 'Earn rewards by visiting a store location. Verified automatically via GPS.',
    verification: 'GPS verification using geofencing. Requires being within 100 meters of the store.',
    icon: '📍'
  },
  {
    id: 'purchase',
    name: 'Purchase',
    keywords: ['purchase', 'buy', 'transaction', 'order', 'paid', 'checkout', 'spending'],
    description: 'Earn rewards on qualifying purchases at partner stores.',
    verification: 'Verified through payment transaction records and merchant confirmation.',
    icon: '🛒'
  },
  {
    id: 'engagement',
    name: 'Digital Engagement',
    keywords: ['engagement', 'like', 'share', 'follow', 'review', 'rating', 'social', 'comment'],
    description: 'Earn rewards for engaging with partner brands on social media.',
    verification: 'Verified through social media API integration and activity tracking.',
    icon: '👍'
  },
  {
    id: 'referral',
    name: 'Referral',
    keywords: ['refer', 'referral', 'invite', 'friend', 'share code', 'referrer', 'invited'],
    description: 'Earn rewards by referring friends to join REZ or partner merchants.',
    verification: 'Verified when referred friend completes first qualifying action.',
    icon: '👥'
  },
  {
    id: 'quiz',
    name: 'Quiz/Feedback',
    keywords: ['quiz', 'survey', 'feedback', 'questionnaire', 'poll', 'answer', 'complete'],
    description: 'Earn rewards by completing quizzes or providing feedback.',
    verification: 'Verified upon completing all quiz questions or survey fields.',
    icon: '📝'
  }
];

// ====== CLAIM PROCESSES ======
const claimProcesses: { [key: string]: ClaimProcess } = {
  coins: {
    rewardType: 'coins',
    steps: [
      'Complete a qualifying action (scan, visit, or purchase)',
      'Wait for automatic verification (usually within 24 hours)',
      'Coins are credited automatically to your REZ wallet',
      'Check your wallet balance in the REZ app'
    ],
    verification: 'Automatic via system verification',
    fulfillment: 'Instant credit to wallet upon verification',
    estimatedTime: 'Within 24 hours'
  },
  discount: {
    rewardType: 'discount',
    steps: [
      'Complete qualifying action to earn discount',
      'Navigate to "My Rewards" in the REZ app',
      'Find the discount offer and tap "Redeem"',
      'Show the generated QR code at checkout',
      'The cashier will apply the discount'
    ],
    verification: 'Show redemption code at checkout',
    fulfillment: 'Applied at point of sale',
    estimatedTime: 'Immediate upon redemption'
  },
  sample: {
    rewardType: 'sample',
    steps: [
      'Earn the free sample reward',
      'Navigate to "My Rewards" in the REZ app',
      'Tap on the sample offer',
      'Show the redemption QR code at the store',
      'Present to staff to claim your sample'
    ],
    verification: 'Show QR code to staff member',
    fulfillment: 'Provided in-store upon verification',
    estimatedTime: 'Immediate upon claim'
  },
  consultation: {
    rewardType: 'consultation',
    steps: [
      'Earn the free consultation reward',
      'Navigate to "My Rewards" in the REZ app',
      'Tap "Book Now" on the consultation offer',
      'Select your preferred date and time',
      'Receive confirmation via email/SMS',
      'Visit the location at the scheduled time'
    ],
    verification: 'Booking confirmation serves as verification',
    fulfillment: 'Appointments scheduled through booking system',
    estimatedTime: 'Schedule within 30 days of earning'
  },
  contest: {
    rewardType: 'contest',
    steps: [
      'Earn contest entries by completing actions',
      'Contest entries are automatically added',
      'Wait for the contest end date',
      'Winners are selected randomly',
      'Winners receive notification via app/email',
      'Prizes are credited to winner accounts'
    ],
    verification: 'Automatic random selection by system',
    fulfillment: 'Credited to account within 7 days of winner announcement',
    estimatedTime: 'Up to 30 days after contest ends'
  },
  voucher: {
    rewardType: 'voucher',
    steps: [
      'Earn voucher reward',
      'Navigate to "My Rewards"',
      'Find and claim your voucher',
      'Note the voucher code or show QR at checkout',
      'Apply voucher code at checkout or show to cashier'
    ],
    verification: 'Show code or scan QR at partner location',
    fulfillment: 'Applied at point of sale',
    estimatedTime: 'Immediate upon redemption'
  },
  upgrade: {
    rewardType: 'upgrade',
    steps: [
      'Earn upgrade reward',
      'Navigate to "My Rewards"',
      'Claim your upgrade reward',
      'Show confirmation when booking or checking in',
      'Staff will apply the upgrade'
    ],
    verification: 'Show redemption confirmation',
    fulfillment: 'Applied by staff upon verification',
    estimatedTime: 'Immediate upon claim at location'
  }
};

// ====== CAMPAIGN TYPES ======
const campaignTypes: CampaignType[] = [
  {
    id: 'welcome',
    name: 'Welcome Offer',
    keywords: ['welcome', 'new user', 'new customer', 'first time', 'sign up', 'join', 'new member'],
    description: 'Special offers for new users joining REZ or visiting a merchant for the first time.',
    icon: '👋'
  },
  {
    id: 'seasonal',
    name: 'Seasonal Campaign',
    keywords: ['seasonal', 'season', 'holiday', 'festival', 'christmas', 'diwali', 'summer', 'winter'],
    description: 'Time-limited offers during holidays and seasons. Hurry before they expire!',
    icon: '🎄'
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale',
    keywords: ['flash sale', 'lightning deal', 'limited time', 'hurry', 'act fast', 'today only'],
    description: 'Extremely time-limited offers with deep discounts. Act fast!',
    icon: '⚡'
  },
  {
    id: 'loyalty',
    name: 'Loyalty Program',
    keywords: ['loyalty', 'repeat', 'regular', 'frequent', 'member', 'returning'],
    description: 'Rewards for loyal customers who frequently engage with merchants.',
    icon: '💎'
  },
  {
    id: 'referral',
    name: 'Referral Campaign',
    keywords: ['refer', 'invite', 'friend', 'share', 'tell a friend', 'recommend'],
    description: 'Earn rewards by inviting friends to join REZ or partner merchants.',
    icon: '🤝'
  },
  {
    id: 'gamification',
    name: 'Gamification',
    keywords: ['game', 'spin', 'wheel', 'scratch', 'challenge', 'mission', 'achievement'],
    description: 'Interactive campaigns with games, challenges, and achievements.',
    icon: '🎮'
  },
  {
    id: 'social',
    name: 'Social Media Campaign',
    keywords: ['social', 'instagram', 'facebook', 'twitter', 'share', 'like', 'follow', 'post'],
    description: 'Rewards for engaging with brands on social media platforms.',
    icon: '📲'
  },
  {
    id: 'product_launch',
    name: 'Product Launch',
    keywords: ['new', 'launch', 'launching', 'new arrival', 'new product', 'introducing'],
    description: 'Special offers accompanying new product or service launches.',
    icon: '🚀'
  }
];

// ====== COMMON QUESTIONS ======
const commonQuestions: CommonQuestion[] = [
  {
    id: 'how_to_earn',
    keywords: ['earn', 'how earn', 'earning', 'how to earn', 'get coins', 'get rewards', 'gain'],
    response: 'You can earn REZ rewards by: 1) Scanning QR codes at partner locations, 2) Visiting stores (GPS verified), 3) Making purchases, 4) Referring friends, 5) Participating in campaigns. Check the app for available earning opportunities!',
    relatedTopics: ['scan', 'visit', 'purchase', 'referral']
  },
  {
    id: 'how_to_redeem',
    keywords: ['redeem', 'how redeem', 'claim', 'how claim', 'use', 'how use', 'spend', 'convert'],
    response: 'To redeem rewards: 1) Open the REZ app and go to "My Rewards", 2) Find the reward you want to claim, 3) Tap "Redeem" and follow the instructions. Some rewards auto-apply at checkout, others require showing a QR code.',
    relatedTopics: ['discount', 'voucher', 'coins']
  },
  {
    id: 'expiry',
    keywords: ['expiry', 'expire', 'expired', 'valid', 'validity', 'deadline', 'how long', 'until when'],
    response: 'Reward validity varies: Coins expire in 90 days, discounts in 30 days, samples in 7 days, vouchers in 60 days. Check individual rewards for exact expiry dates. You will receive reminders before rewards expire.',
    relatedTopics: ['coins', 'discount', 'sample']
  },
  {
    id: 'verification',
    keywords: ['verify', 'verification', 'gps', 'location', 'check', 'confirm', 'authentic'],
    response: 'Some rewards require in-store verification via GPS to ensure you visited the location. The app automatically verifies your location when you scan QR codes. Please enable location services for accurate verification.',
    relatedTopics: ['visit', 'scan', 'purchase']
  },
  {
    id: 'minimum_purchase',
    keywords: ['minimum', 'purchase requirement', 'minimum spend', 'qualifying', 'conditions', 'terms'],
    response: 'Some rewards may have minimum purchase requirements. Check the reward details for specific terms and conditions. Any applicable minimums will be clearly stated when you view the reward.',
    relatedTopics: ['purchase', 'discount']
  },
  {
    id: 'already_claimed',
    keywords: ['already', 'claimed', 'already claimed', 'duplicate', 'already used', 'used'],
    response: 'Each reward can typically be claimed once per user unless specified otherwise. If you have already claimed a reward, it will show as "Claimed" in your rewards history. Check other available rewards!',
    relatedTopics: ['redeem', 'claim']
  },
  {
    id: 'combine_rewards',
    keywords: ['combine', 'stack', 'multiple', 'use together', 'add', 'accumulate'],
    response: 'In most cases, you can only use one discount/offer per transaction. Coins and other rewards may be combinable - check the individual reward terms. Some merchant-specific offers may be combined with general REZ rewards.',
    relatedTopics: ['discount', 'coins']
  },
  {
    id: 'not_received',
    keywords: ['not received', 'not credited', 'missing', 'did not get', 'where', 'where is'],
    response: 'If you have not received your reward: 1) Check if verification is still pending (up to 24 hours), 2) Ensure you completed all required actions, 3) Check your reward history for any errors. Contact support if the issue persists.',
    relatedTopics: ['verification', 'coins']
  },
  {
    id: 'location_issues',
    keywords: ['location', 'gps', 'not detected', 'location error', 'unable to verify', 'wrong location'],
    response: 'Location verification requires GPS and internet connection. If verification fails: 1) Ensure location services are enabled, 2) Move to an area with better GPS signal, 3) Wait a moment and retry. Some indoor locations may have reduced GPS accuracy.',
    relatedTopics: ['verification', 'visit']
  },
  {
    id: 'merchant_not_participating',
    keywords: ['not participating', 'not eligible', 'merchant', 'location', 'wrong store', 'which stores'],
    response: 'Rewards are only valid at participating merchants. Look for the REZ logo or QR code display at participating locations. Not all branches may participate - check the merchant list in the app.',
    relatedTopics: ['scan', 'visit', 'purchase']
  },
  {
    id: 'cancel_reward',
    keywords: ['cancel', 'undo', 'mistake', 'wrong', 'accidental', 'delete'],
    response: 'Once a reward is claimed, it cannot be cancelled or reversed. For accidental claims, please contact support as soon as possible with your reward details. We will assist on a best-effort basis.',
    relatedTopics: ['redeem', 'claim']
  },
  {
    id: 'transfer_rewards',
    keywords: ['transfer', 'give', 'share', 'gift', 'send to', 'transfer to'],
    response: 'Currently, REZ rewards cannot be transferred to other users. Each reward is linked to the earning account and is non-transferable. Coins in your wallet can only be used by the account holder.',
    relatedTopics: ['coins', 'voucher']
  }
];

// ====== COMPLETE CAMPAIGN ADS KB ======
export const campaignAdsKB: CampaignAdsKB = {
  rewardTypes: {
    types: rewardTypes,
    responses: {
      rewardExplanation: 'REZ offers various reward types including coins, discounts, free samples, consultations, and more. Each reward type has its own claiming process and validity period.',
      earningInfo: 'You can earn rewards by scanning QR codes, visiting stores, making purchases, referring friends, and participating in campaigns. Different actions earn different reward types.',
      claimingInfo: 'Most rewards can be claimed from "My Rewards" in the app. Some rewards are automatically credited (like coins), while others require you to show a redemption code.',
      expirationInfo: 'Rewards expire if not used within their validity period. Coins expire in 90 days, discounts in 30 days, samples in 7 days, and vouchers in 60 days.'
    }
  },

  attribution: {
    methods: attributionMethods,
    responses: {
      verificationProcess: 'Rewards are verified through: 1) QR code scans (automatic), 2) GPS location (geofence), 3) Transaction records. Verification may take up to 24 hours.',
      gpsAccuracy: 'GPS verification uses your device location within approximately 100 meters of the store. For best results, ensure location services are enabled and you are near the store.',
      manualVerification: 'In some cases, manual verification by staff may be required. Show your REZ app and proof of visit if asked.'
    }
  },

  claimProcess: {
    processes: claimProcesses,
    responses: {
      generalProcess: 'To claim rewards: Go to "My Rewards" > Select reward > Tap "Redeem" > Follow instructions. Show QR code if required.',
      automaticCrediting: 'Coins are automatically credited to your wallet upon verification. No action needed from you.',
      manualClaim: 'Discounts, samples, and vouchers require manual redemption. Open the app, find the reward, and show the QR code at checkout.',
      verificationRequired: 'Some rewards require in-store verification via GPS or staff confirmation. Ensure you are at the participating location when claiming.'
    }
  },

  campaignTypes: {
    types: campaignTypes,
    responses: {
      campaignDescription: 'This campaign offers [campaign description]. Earn rewards by [action required]. Limited time only!',
      howToParticipate: 'To participate: 1) [Step 1], 2) [Step 2], 3) [Step 3]. Complete all steps to earn your reward.',
      termsApply: 'Terms and conditions apply. Please review the campaign details for eligibility requirements, validity period, and any restrictions.'
    }
  },

  commonQuestions: commonQuestions,

  intents: {
    greetings: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'how do i', 'what can i', 'i want to'],
    rewards: ['reward', 'rewards', 'earn', 'earning', 'claim', 'redeem', 'get', 'win', 'prize'],
    earning: ['earn', 'how earn', 'earning', 'get reward', 'how to get', 'how do i earn', 'where earn'],
    redeeming: ['redeem', 'claim', 'use', 'spend', 'how redeem', 'how claim', 'use reward', 'apply'],
    verification: ['verify', 'verification', 'gps', 'location', 'confirm', 'check', 'detected'],
    expiration: ['expiry', 'expire', 'expired', 'valid', 'deadline', 'how long', 'valid until'],
    complaints: ['not received', 'missing', 'issue', 'problem', 'wrong', 'error', 'did not get', 'failed'],
    support: ['help', 'support', 'assist', 'human', 'agent', 'customer service', 'speak to someone'],
    campaignInfo: ['campaign', 'offer', 'deal', 'promotion', 'what is', 'tell me about', 'explain']
  },

  responses: {
    greeting: 'Hello! Welcome to REZ Rewards! I can help you understand how to earn and redeem rewards, explain campaign details, and answer any questions about your rewards. How may I assist you today?',
    welcome: 'Welcome! You have [number] rewards available. Would you like to know how to earn more, how to redeem your current rewards, or do you have questions about a specific campaign?',
    rewardInfo: 'You have [reward type] worth [value]. This reward is valid until [date]. Would you like to redeem it now?',
    howToEarn: 'You can earn rewards by: 1) Scanning QR codes at partner locations, 2) Visiting stores (GPS verified), 3) Making purchases, 4) Referring friends, 5) Participating in campaigns. Open the app to see available earning opportunities near you!',
    howToRedeem: 'To redeem your reward: 1) Go to "My Rewards" in the REZ app, 2) Select the reward you want to claim, 3) Tap "Redeem", 4) Show the generated code at checkout. Some rewards credit automatically!',
    notUnderstood: 'I am not quite sure I understood that. Could you please rephrase? Are you asking about earning rewards, redeeming rewards, or campaign details?',
    supportTransfer: 'I would like to connect you with our support team who can better assist with your specific issue. Please hold for a moment.'
  },

  contextSlots: {
    campaignId: true,
    rewardType: true,
    merchantId: true,
    userId: true,
    timestamp: true,
    locationVerified: true
  }
};

export default campaignAdsKB;
