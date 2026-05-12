import { v4 as uuidv4 } from 'uuid';
import {
  InfoCategory,
  FAQ,
  Policy,
  PolicySection,
  Article,
  Guide,
  GuideStep
} from './infoAgent';

const FAQ_DATABASE: FAQ[] = [
  {
    id: 'faq_001',
    question: 'How do I book a trip on REZ?',
    answer: 'Booking on REZ is easy! Simply: 1) Search for your desired destination and dates, 2) Browse available accommodations, flights, and activities, 3) Select your choices and add them to your cart, 4) Review your selections and apply any promo codes, 5) Enter your payment details and complete the booking. You will receive a confirmation email with all your booking details immediately after successful payment.',
    category: InfoCategory.BOOKING,
    tags: ['booking', 'how to', 'tutorial', 'steps'],
    relatedFaqs: ['faq_002', 'faq_003', 'faq_010'],
    viewCount: 15420,
    helpfulCount: 14200,
    lastUpdated: new Date('2026-01-15')
  },
  {
    id: 'faq_002',
    question: 'What payment methods are accepted?',
    answer: 'We accept the following payment methods:\n\n• Credit Cards: Visa, MasterCard, American Express, Discover\n• Debit Cards: Visa and MasterCard debit\n• Digital Wallets: Apple Pay, Google Pay, PayPal\n• Bank Transfers: ACH (US) and SEPA (Europe)\n• REZ Credits: Store credit from cancellations or refunds\n\nAll transactions are secured with industry-standard encryption. Payment is processed at the time of booking.',
    category: InfoCategory.PAYMENT,
    tags: ['payment', 'credit card', 'paypal', 'methods'],
    relatedFaqs: ['faq_003', 'faq_004', 'faq_011'],
    viewCount: 12350,
    helpfulCount: 11800,
    lastUpdated: new Date('2026-02-01')
  },
  {
    id: 'faq_003',
    question: 'How do I cancel my booking?',
    answer: 'To cancel your booking:\n\n1. Log into your REZ account\n2. Go to "My Trips" section\n3. Select the booking you want to cancel\n4. Click "Cancel Booking"\n5. Review the cancellation policy\n6. Confirm the cancellation\n\nCancellation fees may apply based on the timing and type of booking. Standard cancellation policies allow free cancellation within 24 hours of booking, or up to 48 hours before check-in for accommodations.',
    category: InfoCategory.CANCELLATION,
    tags: ['cancel', 'cancellation', 'booking', 'how to'],
    relatedFaqs: ['faq_004', 'faq_005', 'faq_006'],
    viewCount: 18900,
    helpfulCount: 17200,
    lastUpdated: new Date('2026-01-20')
  },
  {
    id: 'faq_004',
    question: 'What is your cancellation policy?',
    answer: 'Our cancellation policy varies by booking type:\n\n**Accommodations:**\n• Free cancellation within 24 hours of booking\n• 48+ hours before check-in: Full refund minus processing fee\n• Less than 48 hours: Non-refundable (unless exceptional circumstances)\n\n**Flights:**\n• Subject to airline policy\n• Some fares are non-refundable\n• Change fees may apply\n\n**Packages:**\n• 7+ days before departure: 90% refund\n• 3-7 days: 50% refund\n• Less than 3 days: No refund\n\n**Exceptions:** Natural disasters, medical emergencies, and airline cancellations receive full refunds.',
    category: InfoCategory.POLICIES,
    tags: ['cancellation', 'policy', 'refund', 'fees'],
    relatedFaqs: ['faq_003', 'faq_005', 'faq_007'],
    viewCount: 21000,
    helpfulCount: 19500,
    lastUpdated: new Date('2026-02-10')
  },
  {
    id: 'faq_005',
    question: 'How long does it take to receive a refund?',
    answer: 'Refund processing times depend on the payment method:\n\n• **Credit/Debit Cards:** 5-10 business days\n• **PayPal:** 3-5 business days\n• **Bank Transfer:** 7-10 business days\n• **REZ Credits:** Instant\n\nOnce approved, refunds are processed within 24-48 hours. The total time from request to receipt may vary based on your financial institution. You will receive an email confirmation when your refund has been processed.',
    category: InfoCategory.REFUND,
    tags: ['refund', 'timeline', 'processing', 'payment'],
    relatedFaqs: ['faq_006', 'faq_007', 'faq_004'],
    viewCount: 15600,
    helpfulCount: 14800,
    lastUpdated: new Date('2026-01-25')
  },
  {
    id: 'faq_006',
    question: 'How do I request a refund?',
    answer: 'To request a refund:\n\n1. Log into your REZ account\n2. Go to "My Trips" and select the booking\n3. Click "Request Refund"\n4. Select the reason for your refund\n5. Provide any required documentation\n6. Submit your request\n\nRefund requests are typically processed within 2-3 business days. You will receive email updates on your refund status throughout the process.',
    category: InfoCategory.REFUND,
    tags: ['refund', 'request', 'how to', 'process'],
    relatedFaqs: ['faq_005', 'faq_007', 'faq_008'],
    viewCount: 13200,
    helpfulCount: 12500,
    lastUpdated: new Date('2026-02-05')
  },
  {
    id: 'faq_007',
    question: 'Can I change the dates of my booking?',
    answer: 'Yes, most bookings can be modified. To change your dates:\n\n1. Log into your REZ account\n2. Go to "My Trips"\n3. Select your booking and click "Modify"\n4. Choose new dates\n5. Review any price differences\n6. Confirm the changes\n\n**Accommodations:** Subject to availability. Price differences apply.\n**Flights:** Subject to airline policy. Change fees may apply.\n**Packages:** Contact us directly for modifications.\n\nSome promotional rates may not allow changes.',
    category: InfoCategory.BOOKING,
    tags: ['change', 'dates', 'modify', 'booking'],
    relatedFaqs: ['faq_001', 'faq_003', 'faq_009'],
    viewCount: 9800,
    helpfulCount: 8900,
    lastUpdated: new Date('2026-01-30')
  },
  {
    id: 'faq_008',
    question: 'How do I create an account?',
    answer: 'Creating a REZ account is free and takes just a minute:\n\n1. Click "Sign Up" at the top of the page\n2. Enter your email address\n3. Create a secure password\n4. Fill in your profile information\n5. Verify your email address\n\nBenefits of creating an account:\n• Faster checkout\n• Save favorite destinations\n• Track your bookings\n• Earn and redeem loyalty points\n• Get exclusive deals',
    category: InfoCategory.ACCOUNT,
    tags: ['account', 'sign up', 'register', 'create'],
    relatedFaqs: ['faq_009', 'faq_012', 'faq_015'],
    viewCount: 22100,
    helpfulCount: 21000,
    lastUpdated: new Date('2026-01-10')
  },
  {
    id: 'faq_009',
    question: 'How do I reset my password?',
    answer: 'To reset your password:\n\n1. Click "Log In" at the top of the page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your email for a reset link\n5. Click the link and create a new password\n\nThe password reset link expires after 24 hours. If you do not receive the email, check your spam folder or contact support.',
    category: InfoCategory.ACCOUNT,
    tags: ['password', 'reset', 'forgot', 'login'],
    relatedFaqs: ['faq_008', 'faq_010', 'faq_011'],
    viewCount: 18500,
    helpfulCount: 17800,
    lastUpdated: new Date('2026-02-15')
  },
  {
    id: 'faq_010',
    question: 'How does REZ loyalty program work?',
    answer: 'REZ Rewards is our loyalty program that lets you earn points on every booking:\n\n**Earning Points:**\n• 1 point per $1 spent on accommodations\n• 1 point per $2 spent on flights\n• 2x points on REZ special promotions\n\n**Tier Levels:**\n• **Bronze:** 0-999 points (Entry level)\n• **Silver:** 1,000-4,999 points (5% bonus)\n• **Gold:** 5,000-14,999 points (10% bonus + priority support)\n• **Platinum:** 15,000+ points (15% bonus + exclusive perks)\n\nPoints never expire and can be redeemed for future bookings!',
    category: InfoCategory.LOYALTY,
    tags: ['loyalty', 'points', 'rewards', 'program'],
    relatedFaqs: ['faq_011', 'faq_012', 'faq_013'],
    viewCount: 16800,
    helpfulCount: 15900,
    lastUpdated: new Date('2026-02-20')
  },
  {
    id: 'faq_011',
    question: 'How do I redeem my loyalty points?',
    answer: 'Redeeming your REZ points is easy:\n\n1. Shop for your desired trip as usual\n2. At checkout, toggle "Use REZ Points"\n3. Adjust the number of points you want to redeem\n4. Points are converted at 100 points = $1\n5. Complete your booking\n\nYou can redeem up to 50% of your booking value using points. Points are deducted immediately upon booking.',
    category: InfoCategory.LOYALTY,
    tags: ['redeem', 'points', 'loyalty', 'checkout'],
    relatedFaqs: ['faq_010', 'faq_012', 'faq_013'],
    viewCount: 12500,
    helpfulCount: 11800,
    lastUpdated: new Date('2026-01-28')
  },
  {
    id: 'faq_012',
    question: 'Is my personal information secure?',
    answer: 'Absolutely! We take security very seriously:\n\n• All data is encrypted using 256-bit SSL\n• PCI DSS compliant payment processing\n• Regular security audits\n• Two-factor authentication available\n• We never share your data without consent\n\nYou can review our full Privacy Policy for detailed information on how we protect and use your data.',
    category: InfoCategory.TECHNICAL,
    tags: ['security', 'privacy', 'data', 'encryption'],
    relatedFaqs: ['faq_013', 'faq_014', 'faq_015'],
    viewCount: 11200,
    helpfulCount: 10800,
    lastUpdated: new Date('2026-02-08')
  },
  {
    id: 'faq_013',
    question: 'How do I contact customer support?',
    answer: 'Our customer support team is available multiple ways:\n\n**Email:** support@rez.com (24-hour response)\n**Phone:** 1-800-REZ-HELP (Mon-Fri, 8AM-8PM EST)\n**Live Chat:** Available 24/7 on our website\n\nFor urgent matters, we recommend using phone or live chat. Premium and Platinum members receive priority support.',
    category: InfoCategory.CONTACT,
    tags: ['support', 'contact', 'help', 'phone', 'email'],
    relatedFaqs: ['faq_014', 'faq_015', 'faq_001'],
    viewCount: 19800,
    helpfulCount: 19200,
    lastUpdated: new Date('2026-02-12')
  },
  {
    id: 'faq_014',
    question: 'What destinations are available on REZ?',
    answer: 'REZ offers travel to destinations worldwide! Our catalog includes:\n\n**Regions:**\n• Europe (over 40 countries)\n• Asia Pacific\n• North America\n• South America\n• Africa & Middle East\n• Caribbean\n\n**Types:**\n• Hotels & Resorts\n• Vacation Rentals\n• Flights\n• Tours & Activities\n• Car Rentals\n• Travel Insurance\n\nUse our search to explore all available options for your next trip!',
    category: InfoCategory.GENERAL,
    tags: ['destinations', 'locations', 'travel', 'countries'],
    relatedFaqs: ['faq_001', 'faq_015', 'faq_010'],
    viewCount: 14200,
    helpfulCount: 13500,
    lastUpdated: new Date('2026-01-18')
  },
  {
    id: 'faq_015',
    question: 'Do you offer travel insurance?',
    answer: 'Yes! REZ offers comprehensive travel insurance through trusted providers:\n\n**Coverage Options:**\n• Trip Cancellation (up to 100% of trip cost)\n• Trip Interruption\n• Emergency Medical Coverage\n• Baggage Protection\n• Travel Delay\n• 24/7 Assistance\n\n**Pricing:** Varies by trip cost and traveler age. Typically 4-8% of trip value.\n\nWe strongly recommend travel insurance, especially for international trips or trips with non-refundable bookings.',
    category: InfoCategory.GENERAL,
    tags: ['insurance', 'coverage', 'protection', 'travel'],
    relatedFaqs: ['faq_004', 'faq_005', 'faq_010'],
    viewCount: 8900,
    helpfulCount: 8200,
    lastUpdated: new Date('2026-02-03')
  }
];

const POLICY_DATABASE: Policy[] = [
  {
    id: 'pol_001',
    name: 'Terms of Service',
    description: 'The complete terms governing your use of REZ services',
    content: 'These Terms of Service ("Terms") govern your access to and use of REZ websites, mobile apps, and services. By using our services, you agree to these terms.',
    category: InfoCategory.POLICIES,
    version: '2.5',
    effectiveDate: new Date('2026-01-01'),
    lastUpdated: new Date('2026-01-01'),
    sections: [
      { title: 'Acceptance of Terms', content: 'By accessing or using REZ services, you agree to be bound by these Terms. If you do not agree, do not use our services.' },
      { title: 'User Accounts', content: 'You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.' },
      { title: 'Booking Terms', content: 'Bookings are subject to availability and confirmation. Prices are subject to change until booking is confirmed.' },
      { title: 'User Conduct', content: 'You agree to use our services only for lawful purposes and in accordance with these Terms.' },
      { title: 'Intellectual Property', content: 'All content on REZ is protected by copyright and other intellectual property rights.' },
      { title: 'Limitation of Liability', content: 'REZ is not liable for indirect, incidental, or consequential damages arising from your use of our services.' },
      { title: 'Governing Law', content: 'These Terms are governed by the laws of the State of New York, USA.' },
      { title: 'Changes to Terms', content: 'We may update these Terms at any time. Continued use constitutes acceptance of updated Terms.' }
    ]
  },
  {
    id: 'pol_002',
    name: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal information',
    content: 'This Privacy Policy describes how REZ collects, uses, and shares your personal information.',
    category: InfoCategory.POLICIES,
    version: '3.2',
    effectiveDate: new Date('2026-01-15'),
    lastUpdated: new Date('2026-01-15'),
    sections: [
      { title: 'Information We Collect', content: 'We collect information you provide directly: name, email, phone, payment details, travel preferences, and booking history.' },
      { title: 'How We Use Your Information', content: 'We use your information to process bookings, provide customer support, send updates, and improve our services.' },
      { title: 'Information Sharing', content: 'We share information with travel suppliers to fulfill bookings, payment processors for transactions, and as required by law.' },
      { title: 'Data Security', content: 'We implement industry-standard security measures including encryption, secure servers, and access controls.' },
      { title: 'Your Rights', content: 'You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.' },
      { title: 'Cookies', content: 'We use cookies to enhance your experience, analyze usage, and provide personalized content.' },
      { title: 'Data Retention', content: 'We retain your information as long as your account is active or as needed for services.' },
      { title: 'Contact Us', content: 'For privacy concerns, contact our Data Protection Officer at privacy@rez.com' }
    ]
  },
  {
    id: 'pol_003',
    name: 'Refund Policy',
    description: 'Complete details on refunds, timelines, and eligibility',
    content: 'This policy outlines when and how you can receive refunds for cancelled bookings.',
    category: InfoCategory.POLICIES,
    version: '2.1',
    effectiveDate: new Date('2026-01-01'),
    lastUpdated: new Date('2026-02-01'),
    sections: [
      { title: 'Eligibility', content: 'Refunds are available for eligible cancellations within the specified timeframes. Eligibility depends on booking type, timing, and reason for cancellation.' },
      { title: 'Processing Time', content: 'Refunds are processed within 2-3 business days of approval. Total time to receipt depends on payment method (5-10 days for cards).' },
      { title: 'Refund Methods', content: 'Refunds are credited to the original payment method. Store credit is available as an alternative.' },
      { title: 'Exceptions', content: 'Non-refundable bookings, promotional rates, and certain airline tickets are not eligible for refunds unless under exceptional circumstances.' },
      { title: 'Disputes', content: 'For refund disputes, contact support@rez.com within 30 days of the original refund decision.' }
    ]
  },
  {
    id: 'pol_004',
    name: 'Cookie Policy',
    description: 'Information about how we use cookies and similar technologies',
    content: 'This policy explains how REZ uses cookies and similar technologies.',
    category: InfoCategory.POLICIES,
    version: '1.5',
    effectiveDate: new Date('2026-01-01'),
    lastUpdated: new Date('2026-01-01'),
    sections: [
      { title: 'What Are Cookies', content: 'Cookies are small text files stored on your device that help websites remember your preferences.' },
      { title: 'Types We Use', content: 'We use session cookies (temporary), persistent cookies (remain after closing browser), and third-party cookies (from partners).' },
      { title: 'How We Use Them', content: 'Essential cookies enable core functions. Analytics cookies help us understand usage. Marketing cookies deliver relevant ads.' },
      { title: 'Managing Cookies', content: 'You can control cookies through your browser settings. Disabling cookies may affect site functionality.' }
    ]
  }
];

const ARTICLE_DATABASE: Article[] = [
  {
    id: 'art_001',
    title: '10 Tips for Planning Your Perfect Vacation',
    summary: 'Expert advice on creating memorable travel experiences from start to finish.',
    content: 'Planning a vacation can be overwhelming, but with the right approach, it can also be exciting. Here are our top 10 tips:\n\n1. Start with a budget\n2. Choose your destination wisely\n3. Book accommodations early\n4. Research local customs\n5. Pack smart\n6. Plan some activities, leave room for spontaneity\n7. Get travel insurance\n8. Keep copies of important documents\n9. Notify your bank\n10. Disconnect and enjoy',
    category: InfoCategory.GENERAL,
    tags: ['planning', 'tips', 'vacation', 'guide'],
    author: 'REZ Editorial Team',
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-15'),
    viewCount: 45000,
    relatedArticles: ['art_002', 'art_003']
  },
  {
    id: 'art_002',
    title: 'How to Travel on a Budget',
    summary: 'Smart strategies for seeing the world without breaking the bank.',
    content: 'Traveling does not have to be expensive. Here is how to stretch your budget:\n\n1. Travel during off-peak seasons\n2. Use reward points and miles\n3. Choose alternative accommodations\n4. Eat like a local\n5. Use public transportation\n6. Look for free activities\n7. Travel slowly',
    category: InfoCategory.GENERAL,
    tags: ['budget', 'saving', 'tips', 'travel'],
    author: 'REZ Editorial Team',
    createdAt: new Date('2025-11-15'),
    updatedAt: new Date('2026-01-20'),
    viewCount: 38000,
    relatedArticles: ['art_001', 'art_003']
  }
];

const GUIDE_DATABASE: Guide[] = [
  {
    id: 'guide_001',
    title: 'Creating Your First REZ Account',
    description: 'Step-by-step guide to setting up your REZ account and getting started.',
    steps: [
      { step: 1, title: 'Visit REZ', description: 'Go to rez.com and click the "Sign Up" button in the top right corner.', tips: ['Make sure you are on the official REZ website'] },
      { step: 2, title: 'Enter Your Email', description: 'Provide a valid email address that you check regularly.', tips: ['This will be used for confirmations and updates'], warnings: ['Use an active email you can access'] },
      { step: 3, title: 'Create a Password', description: 'Create a strong password with at least 8 characters including letters, numbers, and symbols.', tips: ['Consider using a password manager'] },
      { step: 4, title: 'Complete Your Profile', description: 'Fill in your name, phone number, and any other requested information.' },
      { step: 5, title: 'Verify Your Email', description: 'Check your email for a verification link and click it to confirm your account.', warnings: ['Check spam folder if you do not see the email'] }
    ],
    category: InfoCategory.ACCOUNT,
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    tags: ['account', 'signup', 'getting started']
  },
  {
    id: 'guide_002',
    title: 'Booking Your First Trip',
    description: 'Complete walkthrough of the REZ booking process from search to confirmation.',
    steps: [
      { step: 1, title: 'Search for Your Trip', description: 'Enter your destination, travel dates, and number of travelers in the search box.' },
      { step: 2, title: 'Browse Results', description: 'Review available accommodations, flights, and activities. Use filters to narrow down options.', tips: ['Sort by price, rating, or location'] },
      { step: 3, title: 'Select Your Choices', description: 'Click on options you like to see detailed information and add them to your cart.' },
      { step: 4, title: 'Review Your Cart', description: 'Check all selections, apply promo codes, and verify dates.', tips: ['Double-check dates before proceeding'] },
      { step: 5, title: 'Enter Traveler Details', description: 'Provide information for all travelers as it appears on their ID.' },
      { step: 6, title: 'Complete Payment', description: 'Enter your payment details and click "Book Now" to complete your purchase.' },
      { step: 7, title: 'Receive Confirmation', description: 'You will see a confirmation screen and receive an email with all your booking details.' }
    ],
    category: InfoCategory.BOOKING,
    difficulty: 'beginner',
    estimatedTime: '10-15 minutes',
    tags: ['booking', 'how to', 'tutorial']
  },
  {
    id: 'guide_003',
    title: 'Managing Your Booking',
    description: 'How to view, modify, or cancel your existing reservations.',
    steps: [
      { step: 1, title: 'Access Your Bookings', description: 'Log in and go to "My Trips" to see all your reservations.' },
      { step: 2, title: 'Select a Booking', description: 'Click on the booking you want to manage.' },
      { step: 3, title: 'View Details', description: 'Review all booking information including confirmation number, dates, and property details.' },
      { step: 4, title: 'Modify or Cancel', description: 'Click "Modify" to change dates or "Cancel" to cancel your booking.', tips: ['Check the cancellation policy before cancelling'], warnings: ['Cancellation fees may apply'] }
    ],
    category: InfoCategory.BOOKING,
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    tags: ['manage', 'modify', 'cancel', 'booking']
  }
];

export async function searchKnowledgeBase(query: string): Promise<{
  faqs: FAQ[];
  articles: Article[];
  policies: Policy[];
}> {
  const lowerQuery = query.toLowerCase();

  const faqs = FAQ_DATABASE.filter(faq =>
    faq.question.toLowerCase().includes(lowerQuery) ||
    faq.answer.toLowerCase().includes(lowerQuery) ||
    faq.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  ).sort((a, b) => b.viewCount - a.viewCount);

  const articles = ARTICLE_DATABASE.filter(article =>
    article.title.toLowerCase().includes(lowerQuery) ||
    article.summary.toLowerCase().includes(lowerQuery) ||
    article.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  ).sort((a, b) => b.viewCount - a.viewCount);

  const policies = POLICY_DATABASE.filter(policy =>
    policy.name.toLowerCase().includes(lowerQuery) ||
    policy.description.toLowerCase().includes(lowerQuery) ||
    policy.sections.some(s => s.title.toLowerCase().includes(lowerQuery))
  );

  return { faqs, articles, policies };
}

export async function getFaqs(query: string): Promise<FAQ[]> {
  const { faqs } = await searchKnowledgeBase(query);
  return faqs;
}

export function getPolicies(query: string): Policy[] {
  const lowerQuery = query.toLowerCase();

  if (!query) {
    return POLICY_DATABASE;
  }

  return POLICY_DATABASE.filter(policy =>
    policy.name.toLowerCase().includes(lowerQuery) ||
    policy.description.toLowerCase().includes(lowerQuery) ||
    policy.sections.some(s =>
      s.title.toLowerCase().includes(lowerQuery) ||
      s.content.toLowerCase().includes(lowerQuery)
    )
  );
}

export function getArticles(query: string): Article[] {
  const lowerQuery = query.toLowerCase();

  if (!query) {
    return ARTICLE_DATABASE;
  }

  return ARTICLE_DATABASE.filter(article =>
    article.title.toLowerCase().includes(lowerQuery) ||
    article.summary.toLowerCase().includes(lowerQuery) ||
    article.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getGuides(query: string): Guide[] {
  const lowerQuery = query.toLowerCase();

  if (!query) {
    return GUIDE_DATABASE;
  }

  return GUIDE_DATABASE.filter(guide =>
    guide.title.toLowerCase().includes(lowerQuery) ||
    guide.description.toLowerCase().includes(lowerQuery) ||
    guide.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getPolicyById(policyId: string): Policy | undefined {
  return POLICY_DATABASE.find(p => p.id === policyId);
}

export function getFaqById(faqId: string): FAQ | undefined {
  return FAQ_DATABASE.find(f => f.id === faId);
}

export function getArticleById(articleId: string): Article | undefined {
  return ARTICLE_DATABASE.find(a => a.id === articleId);
}

export function getGuideById(guideId: string): Guide | undefined {
  return GUIDE_DATABASE.find(g => g.id === guideId);
}

export function getFaqsByCategory(category: InfoCategory): FAQ[] {
  return FAQ_DATABASE.filter(faq => faq.category === category);
}

export function getPoliciesByCategory(category: InfoCategory): Policy[] {
  return POLICY_DATABASE.filter(policy => policy.category === category);
}
