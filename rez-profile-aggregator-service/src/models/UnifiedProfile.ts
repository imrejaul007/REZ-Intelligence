/**
 * Unified Profile MongoDB Schema
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// User Types & Enums
// ============================================================================

export type UserType =
  | 'student'
  | 'doctor'
  | 'army'
  | 'senior_citizen'
  | 'corporate'
  | 'government_employee'
  | 'ngo_volunteer'
  | 'influencer'
  | 'premium_member'
  | 'family'
  | 'traveler'
  | 'fitness_enthusiast';

export type VerificationLevel = 'unverified' | 'basic' | 'verified' | 'trusted' | 'premium';

export type Role =
  | 'user'
  | 'merchant'
  | 'admin'
  | 'super_admin'
  | 'vendor'
  | 'delivery_partner';

export interface IStudentDetails {
  institutionName?: string;
  studentId?: string;
  graduationYear?: number;
  course?: string;
  studentEmail?: string;
  isActive: boolean;
  verificationDoc?: string;
}

export interface IDoctorDetails {
  specialization?: string;
  licenseNumber?: string;
  hospital?: string;
  yearsOfExperience?: number;
  clinicAddress?: string;
  consultationFee?: number;
  isAvailableForTelemedicine: boolean;
  verificationDoc?: string;
}

export interface IArmyDetails {
  rank?: string;
  serviceNumber?: string;
  unit?: string;
  branch: 'army' | 'navy' | 'air_force' | 'coast_guard';
  isServing: boolean;
  retirementDate?: Date;
  verificationDoc?: string;
}

export interface ISeniorCitizenDetails {
  age: number;
  isPensioner: boolean;
  pensionId?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  emergencyContact?: string;
  hasMobilityIssues: boolean;
  verificationDoc?: string;
}

export interface ICorporateDetails {
  companyName?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  corporateEmail?: string;
  isOnProbation: boolean;
  probationEndDate?: Date;
  corporatePlanId?: string;
  verificationDoc?: string;
}

export interface IGovernmentEmployeeDetails {
  ministry?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  gradePay?: string;
  isServing: boolean;
  postingLocation?: string;
  verificationDoc?: string;
}

export interface INGOVolunteerDetails {
  organizationName?: string;
  volunteerId?: string;
  role?: string;
  isActive: boolean;
  hoursCommitted?: number;
  areaOfWork?: string[];
  verificationDoc?: string;
}

export interface IInfluencerDetails {
  platforms?: string[];
  followers?: Record<string, number>;
  engagementRate?: number;
  niche?: string[];
  tier: 'nano' | 'micro' | 'macro' | 'mega';
  isBrandAmbassador: boolean;
  brandDealsCount?: number;
  verificationDoc?: string;
}

export interface IPremiumMemberDetails {
  membershipId?: string;
  planName?: string;
  planTier: 'monthly' | 'annual' | 'lifetime';
  startDate?: Date;
  renewalDate?: Date;
  autoRenew: boolean;
  perksUnlocked: string[];
  referralCode?: string;
}

export interface IFamilyDetails {
  familyId?: string;
  membersCount: number;
  isHeadOfFamily: boolean;
  relationshipToHead?: string;
  familyPlanId?: string;
  dependents?: Array<{
    name: string;
    relation: string;
    age?: number;
  }>;
}

export interface ITravelerDetails {
  frequentDestinations?: string[];
  passportNumber?: string;
  nationality?: string;
  travelFrequency: 'rarely' | 'occasionally' | 'frequently' | 'frequent';
  preferredTravelClass?: 'economy' | 'business' | 'first';
  isFrequentFlyer: boolean;
  loyaltyPrograms?: Record<string, string>;
}

export interface IFitnessEnthusiastDetails {
  fitnessGoals?: string[];
  preferredActivities?: string[];
  gymMembership?: boolean;
  personalTrainer: boolean;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  healthConditions?: string[];
  subscribedPlans?: string[];
}

// ============================================================================
// Discount Configuration per User Type
// ============================================================================

export interface IDiscountConfig {
  enabled: boolean;
  discountPercentage: number;
  maxDiscountAmount?: number;
  applicableCategories?: string[];
  excludedCategories?: string[];
  applicableMerchants?: string[];
  excludedMerchants?: string[];
  minOrderValue?: number;
  maxUsagePerMonth?: number;
  usageThisMonth: number;
  validFrom?: Date;
  validUntil?: Date;
  stackingAllowed: boolean;
  priority: number; // Higher priority = applied last
  termsAccepted: boolean;
}

export const USER_TYPE_DISCOUNT_DEFAULTS: Record<UserType, Omit<IDiscountConfig, 'usageThisMonth' | 'termsAccepted'>> = {
  student: {
    enabled: true,
    discountPercentage: 15,
    maxDiscountAmount: 200,
    applicableCategories: ['education', 'food', 'entertainment', 'travel'],
    excludedCategories: ['alcohol', 'tobacco'],
    stackingAllowed: false,
    priority: 1,
  },
  doctor: {
    enabled: true,
    discountPercentage: 20,
    maxDiscountAmount: 500,
    applicableCategories: ['healthcare', 'pharma', 'wellness', 'medical_equipment'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 2,
  },
  army: {
    enabled: true,
    discountPercentage: 25,
    maxDiscountAmount: 1000,
    applicableCategories: ['all'],
    excludedCategories: [],
    stackingAllowed: false,
    priority: 3,
  },
  senior_citizen: {
    enabled: true,
    discountPercentage: 20,
    maxDiscountAmount: 500,
    applicableCategories: ['healthcare', 'groceries', 'pharma', 'utilities'],
    excludedCategories: [],
    stackingAllowed: false,
    priority: 2,
  },
  corporate: {
    enabled: true,
    discountPercentage: 10,
    maxDiscountAmount: 300,
    applicableCategories: ['food', 'travel', 'entertainment', 'office_supplies'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 1,
  },
  government_employee: {
    enabled: true,
    discountPercentage: 15,
    maxDiscountAmount: 400,
    applicableCategories: ['all'],
    excludedCategories: [],
    stackingAllowed: false,
    priority: 2,
  },
  ngo_volunteer: {
    enabled: true,
    discountPercentage: 15,
    maxDiscountAmount: 300,
    applicableCategories: ['charity', 'food', 'transport', 'utilities'],
    excludedCategories: [],
    stackingAllowed: false,
    priority: 1,
  },
  influencer: {
    enabled: true,
    discountPercentage: 20,
    maxDiscountAmount: 1000,
    applicableCategories: ['all'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 4,
  },
  premium_member: {
    enabled: true,
    discountPercentage: 25,
    maxDiscountAmount: 2000,
    applicableCategories: ['all'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 5,
  },
  family: {
    enabled: true,
    discountPercentage: 12,
    maxDiscountAmount: 500,
    applicableCategories: ['groceries', 'household', 'food', 'entertainment'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 1,
  },
  traveler: {
    enabled: true,
    discountPercentage: 15,
    maxDiscountAmount: 800,
    applicableCategories: ['travel', 'accommodation', 'transport', 'food'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 2,
  },
  fitness_enthusiast: {
    enabled: true,
    discountPercentage: 18,
    maxDiscountAmount: 400,
    applicableCategories: ['fitness', 'health', 'wellness', 'sports'],
    excludedCategories: [],
    stackingAllowed: true,
    priority: 2,
  },
};

// ============================================================================
// Verification Badges
// ============================================================================

export interface IVerificationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  issuedAt: Date;
  expiresAt?: Date;
  issuer: string;
  status: 'active' | 'expired' | 'revoked';
  verificationDoc?: string;
  metadata?: Record<string, unknown>;
}

export const VERIFICATION_BADGES = {
  EMAIL_VERIFIED: {
    id: 'email_verified',
    name: 'Email Verified',
    description: 'Email address has been verified',
    icon: '✓',
    issuer: 'ReZ Platform',
  },
  PHONE_VERIFIED: {
    id: 'phone_verified',
    name: 'Phone Verified',
    description: 'Phone number has been verified via OTP',
    icon: '📱',
    issuer: 'ReZ Platform',
  },
  IDENTITY_VERIFIED: {
    id: 'identity_verified',
    name: 'Identity Verified',
    description: 'Government ID has been verified',
    icon: '🪪',
    issuer: 'ReZ Platform',
  },
  STUDENT_VERIFIED: {
    id: 'student_verified',
    name: 'Student Verified',
    description: 'Student status verified with institution',
    icon: '🎓',
    issuer: 'ReZ Platform',
  },
  DOCTOR_VERIFIED: {
    id: 'doctor_verified',
    name: 'Medical Professional',
    description: 'Medical license verified',
    icon: '👨‍⚕️',
    issuer: 'ReZ Platform',
  },
  ARMY_VERIFIED: {
    id: 'army_verified',
    name: 'Defence Personnel',
    description: 'Service status verified with defence records',
    icon: '🎖️',
    issuer: 'ReZ Platform',
  },
  CORPORATE_VERIFIED: {
    id: 'corporate_verified',
    name: 'Corporate Employee',
    description: 'Corporate email verified',
    icon: '💼',
    issuer: 'ReZ Platform',
  },
  GOVERNMENT_VERIFIED: {
    id: 'government_verified',
    name: 'Government Employee',
    description: 'Government service verified',
    icon: '🏛️',
    issuer: 'ReZ Platform',
  },
  TRUSTED_USER: {
    id: 'trusted_user',
    name: 'Trusted User',
    description: 'High-trust user with verified identity and history',
    icon: '⭐',
    issuer: 'ReZ Platform',
  },
  EARLY_ADOPTER: {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined during beta/early access',
    icon: '🚀',
    issuer: 'ReZ Platform',
  },
  REFERRAL_CHAMPION: {
    id: 'referral_champion',
    name: 'Referral Champion',
    description: 'Successfully referred 10+ users',
    icon: '🎁',
    issuer: 'ReZ Platform',
  },
  POWER_USER: {
    id: 'power_user',
    name: 'Power User',
    description: 'Top 1% engagement on platform',
    icon: '⚡',
    issuer: 'ReZ Platform',
  },
};

// ============================================================================
// Role-Based Access Control
// ============================================================================

export interface IRolePermissions {
  canAccessAdminPanel: boolean;
  canViewAllUsers: boolean;
  canModifyOrders: boolean;
  canIssueRefunds: boolean;
  canViewFinancials: boolean;
  canManageMerchants: boolean;
  canManageStaff: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
  canManageDiscounts: boolean;
  canApproveVerifications: boolean;
  canBypassRestrictions: boolean;
  canAccessBetaFeatures: boolean;
  canManageRoles: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, IRolePermissions> = {
  user: {
    canAccessAdminPanel: false,
    canViewAllUsers: false,
    canModifyOrders: false,
    canIssueRefunds: false,
    canViewFinancials: false,
    canManageMerchants: false,
    canManageStaff: false,
    canViewAnalytics: false,
    canExportData: false,
    canManageDiscounts: false,
    canApproveVerifications: false,
    canBypassRestrictions: false,
    canAccessBetaFeatures: false,
    canManageRoles: false,
  },
  merchant: {
    canAccessAdminPanel: true,
    canViewAllUsers: false,
    canModifyOrders: true,
    canIssueRefunds: true,
    canViewFinancials: true,
    canManageMerchants: false,
    canManageStaff: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageDiscounts: true,
    canApproveVerifications: false,
    canBypassRestrictions: false,
    canAccessBetaFeatures: false,
    canManageRoles: false,
  },
  admin: {
    canAccessAdminPanel: true,
    canViewAllUsers: true,
    canModifyOrders: true,
    canIssueRefunds: true,
    canViewFinancials: true,
    canManageMerchants: true,
    canManageStaff: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageDiscounts: true,
    canApproveVerifications: true,
    canBypassRestrictions: true,
    canAccessBetaFeatures: true,
    canManageRoles: false,
  },
  super_admin: {
    canAccessAdminPanel: true,
    canViewAllUsers: true,
    canModifyOrders: true,
    canIssueRefunds: true,
    canViewFinancials: true,
    canManageMerchants: true,
    canManageStaff: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageDiscounts: true,
    canApproveVerifications: true,
    canBypassRestrictions: true,
    canAccessBetaFeatures: true,
    canManageRoles: true,
  },
  vendor: {
    canAccessAdminPanel: true,
    canViewAllUsers: false,
    canModifyOrders: true,
    canIssueRefunds: false,
    canViewFinancials: true,
    canManageMerchants: false,
    canManageStaff: false,
    canViewAnalytics: true,
    canExportData: false,
    canManageDiscounts: false,
    canApproveVerifications: false,
    canBypassRestrictions: false,
    canAccessBetaFeatures: false,
    canManageRoles: false,
  },
  delivery_partner: {
    canAccessAdminPanel: false,
    canViewAllUsers: false,
    canModifyOrders: true,
    canIssueRefunds: false,
    canViewFinancials: false,
    canManageMerchants: false,
    canManageStaff: false,
    canViewAnalytics: false,
    canExportData: false,
    canManageDiscounts: false,
    canApproveVerifications: false,
    canBypassRestrictions: false,
    canAccessBetaFeatures: false,
    canManageRoles: false,
  },
};

// ============================================================================
// Main Interface
// ============================================================================

export interface IUnifiedProfile extends Document {
  userId: string;

  // User Type & Verification
  userType: UserType[];
  verificationLevel: VerificationLevel;
  primaryUserType?: UserType;
  isPrimaryTypeActive: boolean;

  // Vertical-Specific Details
  student?: IStudentDetails;
  doctor?: IDoctorDetails;
  army?: IArmyDetails;
  seniorCitizen?: ISeniorCitizenDetails;
  corporate?: ICorporateDetails;
  governmentEmployee?: IGovernmentEmployeeDetails;
  ngoVolunteer?: INGOVolunteerDetails;
  influencer?: IInfluencerDetails;
  premiumMember?: IPremiumMemberDetails;
  family?: IFamilyDetails;
  traveler?: ITravelerDetails;
  fitnessEnthusiast?: IFitnessEnthusiastDetails;

  // Discount Configuration
  discountConfig: Partial<Record<UserType, IDiscountConfig>>;

  // Verification Badges
  verificationBadges: IVerificationBadge[];

  // Role-Based Access
  roles: Role[];
  primaryRole: Role;
  permissions: IRolePermissions;

  // Original Fields
  wallet: {
    balances: {
      rez: number;
      prive: number;
      branded: number;
      promo: number;
      cashback: number;
      referral: number;
    };
    totalValue: number;
    lastTransaction?: Date;
  };
  loyalty: {
    globalTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';
    totalPoints: number;
    lifetimeSpend: number;
    visitCount: number;
    streak: {
      current: number;
      longest: number;
      lastVisit?: Date;
    };
    merchantPrograms: Record<string, {
      tier: string;
      points: number;
    }>;
  };
  karma: {
    score: number;
    level: 'L1' | 'L2' | 'L3' | 'L4';
    lifetimeEarned: number;
    volunteerHours: number;
    eventsCompleted: number;
    badges: string[];
    perks: string[];
  };
  gamification: {
    xp: number;
    level: number;
    achievements: Array<{
      id: string;
      name: string;
      earnedAt: Date;
    }>;
    activeChallenges: Array<{
      id: string;
      name: string;
      progress: number;
      target: number;
    }>;
  };
  behavior: {
    avgOrderValue: number;
    orderFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
    preferredCategories: string[];
    priceRange: 'budget' | 'mid' | 'premium' | 'luxury';
    churnRisk: number;
    ltv: number;
    bestContactTime?: Date;
    preferredChannel: 'push' | 'sms' | 'whatsapp';
  };
  reZScore: {
    composite: number;
    engagement: number;
    spending: number;
    karma: number;
    social: number;
    streak: number;
    tier: string;
    percentile?: number;
    rank?: number;
  };
  crossMerchant: {
    categoriesVisited: string[];
    totalMerchantsVisited: number;
    badgesEarned: string[];
    nextUnlock?: {
      badge: string;
      requirement: string;
      progress: number;
    };
  };
  activity: {
    lastActive?: Date;
    daysSinceSignup: number;
    totalOrders: number;
    lastOrderDate?: Date;
  };
  updatedAt: Date;
}

// ============================================================================
// Mongoose Schema
// ============================================================================

const UnifiedProfileSchema = new Schema<IUnifiedProfile>({
  userId: { type: String, required: true, unique: true, index: true },

  // User Type & Verification
  userType: {
    type: [String],
    enum: ['student', 'doctor', 'army', 'senior_citizen', 'corporate', 'government_employee', 'ngo_volunteer', 'influencer', 'premium_member', 'family', 'traveler', 'fitness_enthusiast'],
    default: ['user'],
  },
  verificationLevel: {
    type: String,
    enum: ['unverified', 'basic', 'verified', 'trusted', 'premium'],
    default: 'unverified',
  },
  primaryUserType: {
    type: String,
    enum: ['student', 'doctor', 'army', 'senior_citizen', 'corporate', 'government_employee', 'ngo_volunteer', 'influencer', 'premium_member', 'family', 'traveler', 'fitness_enthusiast'],
  },
  isPrimaryTypeActive: { type: Boolean, default: true },

  // Vertical-Specific Details
  student: {
    institutionName: String,
    studentId: String,
    graduationYear: Number,
    course: String,
    studentEmail: String,
    isActive: { type: Boolean, default: true },
    verificationDoc: String,
  },
  doctor: {
    specialization: String,
    licenseNumber: String,
    hospital: String,
    yearsOfExperience: Number,
    clinicAddress: String,
    consultationFee: Number,
    isAvailableForTelemedicine: { type: Boolean, default: false },
    verificationDoc: String,
  },
  army: {
    rank: String,
    serviceNumber: String,
    unit: String,
    branch: { type: String, enum: ['army', 'navy', 'air_force', 'coast_guard'], default: 'army' },
    isServing: { type: Boolean, default: true },
    retirementDate: Date,
    verificationDoc: String,
  },
  seniorCitizen: {
    age: { type: Number, min: 60 },
    isPensioner: { type: Boolean, default: false },
    pensionId: String,
    primaryContactName: String,
    primaryContactPhone: String,
    emergencyContact: String,
    hasMobilityIssues: { type: Boolean, default: false },
    verificationDoc: String,
  },
  corporate: {
    companyName: String,
    employeeId: String,
    department: String,
    designation: String,
    corporateEmail: String,
    isOnProbation: { type: Boolean, default: false },
    probationEndDate: Date,
    corporatePlanId: String,
    verificationDoc: String,
  },
  governmentEmployee: {
    ministry: String,
    department: String,
    designation: String,
    employeeId: String,
    gradePay: String,
    isServing: { type: Boolean, default: true },
    postingLocation: String,
    verificationDoc: String,
  },
  ngoVolunteer: {
    organizationName: String,
    volunteerId: String,
    role: String,
    isActive: { type: Boolean, default: true },
    hoursCommitted: Number,
    areaOfWork: [String],
    verificationDoc: String,
  },
  influencer: {
    platforms: [String],
    followers: { type: Map, of: Number },
    engagementRate: Number,
    niche: [String],
    tier: { type: String, enum: ['nano', 'micro', 'macro', 'mega'], default: 'nano' },
    isBrandAmbassador: { type: Boolean, default: false },
    brandDealsCount: Number,
    verificationDoc: String,
  },
  premiumMember: {
    membershipId: String,
    planName: String,
    planTier: { type: String, enum: ['monthly', 'annual', 'lifetime'], default: 'monthly' },
    startDate: Date,
    renewalDate: Date,
    autoRenew: { type: Boolean, default: false },
    perksUnlocked: [String],
    referralCode: String,
  },
  family: {
    familyId: String,
    membersCount: { type: Number, default: 1 },
    isHeadOfFamily: { type: Boolean, default: false },
    relationshipToHead: String,
    familyPlanId: String,
    dependents: [{
      name: String,
      relation: String,
      age: Number,
    }],
  },
  traveler: {
    frequentDestinations: [String],
    passportNumber: String,
    nationality: String,
    travelFrequency: { type: String, enum: ['rarely', 'occasionally', 'frequently', 'frequent'], default: 'occasionally' },
    preferredTravelClass: { type: String, enum: ['economy', 'business', 'first'] },
    isFrequentFlyer: { type: Boolean, default: false },
    loyaltyPrograms: { type: Map, of: String },
  },
  fitnessEnthusiast: {
    fitnessGoals: [String],
    preferredActivities: [String],
    gymMembership: { type: Boolean, default: false },
    personalTrainer: { type: Boolean, default: false },
    fitnessLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'professional'], default: 'beginner' },
    healthConditions: [String],
    subscribedPlans: [String],
  },

  // Discount Configuration
  discountConfig: {
    type: Map,
    of: {
      enabled: { type: Boolean, default: true },
      discountPercentage: { type: Number, default: 0 },
      maxDiscountAmount: Number,
      applicableCategories: [String],
      excludedCategories: [String],
      applicableMerchants: [String],
      excludedMerchants: [String],
      minOrderValue: Number,
      maxUsagePerMonth: Number,
      usageThisMonth: { type: Number, default: 0 },
      validFrom: Date,
      validUntil: Date,
      stackingAllowed: { type: Boolean, default: false },
      priority: { type: Number, default: 0 },
      termsAccepted: { type: Boolean, default: false },
    },
    default: {},
  },

  // Verification Badges
  verificationBadges: [{
    id: String,
    name: String,
    description: String,
    icon: String,
    issuedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    issuer: { type: String, default: 'ReZ Platform' },
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
    verificationDoc: String,
    metadata: { type: Map, of: Schema.Types.Mixed },
  }],

  // Role-Based Access
  roles: {
    type: [String],
    enum: ['user', 'merchant', 'admin', 'super_admin', 'vendor', 'delivery_partner'],
    default: ['user'],
  },
  primaryRole: {
    type: String,
    enum: ['user', 'merchant', 'admin', 'super_admin', 'vendor', 'delivery_partner'],
    default: 'user',
  },
  permissions: {
    type: Map,
    of: Boolean,
    default: () => ROLE_PERMISSIONS.user,
  },

  // Original Fields (unchanged)
  wallet: {
    balances: {
      rez: { type: Number, default: 0 },
      prive: { type: Number, default: 0 },
      branded: { type: Number, default: 0 },
      promo: { type: Number, default: 0 },
      cashback: { type: Number, default: 0 },
      referral: { type: Number, default: 0 },
    },
    totalValue: { type: Number, default: 0 },
    lastTransaction: Date,
  },
  loyalty: {
    globalTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', 'vip'], default: 'bronze' },
    totalPoints: { type: Number, default: 0 },
    lifetimeSpend: { type: Number, default: 0 },
    visitCount: { type: Number, default: 0 },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastVisit: Date,
    },
    merchantPrograms: { type: Map, of: new Schema({ tier: String, points: Number }), default: {} },
  },
  karma: {
    score: { type: Number, default: 0 },
    level: { type: String, enum: ['L1', 'L2', 'L3', 'L4'], default: 'L1' },
    lifetimeEarned: { type: Number, default: 0 },
    volunteerHours: { type: Number, default: 0 },
    eventsCompleted: { type: Number, default: 0 },
    badges: [String],
    perks: [String],
  },
  gamification: {
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    achievements: [{
      id: String,
      name: String,
      earnedAt: Date,
    }],
    activeChallenges: [{
      id: String,
      name: String,
      progress: Number,
      target: Number,
    }],
  },
  behavior: {
    avgOrderValue: { type: Number, default: 0 },
    orderFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'occasional'], default: 'occasional' },
    preferredCategories: [String],
    priceRange: { type: String, enum: ['budget', 'mid', 'premium', 'luxury'], default: 'mid' },
    churnRisk: { type: Number, default: 0 },
    ltv: { type: Number, default: 0 },
    bestContactTime: Date,
    preferredChannel: { type: String, enum: ['push', 'sms', 'whatsapp'], default: 'push' },
  },
  reZScore: {
    composite: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    spending: { type: Number, default: 0 },
    karma: { type: Number, default: 0 },
    social: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    tier: { type: String, default: 'bronze' },
    percentile: Number,
    rank: Number,
  },
  crossMerchant: {
    categoriesVisited: [String],
    totalMerchantsVisited: { type: Number, default: 0 },
    badgesEarned: [String],
    nextUnlock: {
      badge: String,
      requirement: String,
      progress: Number,
    },
  },
  activity: {
    lastActive: Date,
    daysSinceSignup: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    lastOrderDate: Date,
  },
  updatedAt: { type: Date, default: Date.now },
});

// ============================================================================
// Indexes
// ============================================================================

UnifiedProfileSchema.index({ 'reZScore.composite': -1 });
UnifiedProfileSchema.index({ 'loyalty.globalTier': 1 });
UnifiedProfileSchema.index({ 'karma.level': 1 });
UnifiedProfileSchema.index({ userType: 1 });
UnifiedProfileSchema.index({ verificationLevel: 1 });
UnifiedProfileSchema.index({ primaryRole: 1 });
UnifiedProfileSchema.index({ 'verificationBadges.id': 1 });
UnifiedProfileSchema.index({ 'discountConfig.enabled': 1 });

// Compound indexes for common queries
UnifiedProfileSchema.index({ userType: 1, verificationLevel: 1 });
UnifiedProfileSchema.index({ primaryRole: 1, primaryUserType: 1 });

export const UnifiedProfile = mongoose.model<IUnifiedProfile>('UnifiedProfile', UnifiedProfileSchema);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the effective discount config for a user type
 */
export function getEffectiveDiscountConfig(
  profile: IUnifiedProfile,
  userType: UserType
): IDiscountConfig | null {
  const customConfig = profile.discountConfig.get(userType);
  if (customConfig) {
    return customConfig as IDiscountConfig;
  }

  const defaultConfig = USER_TYPE_DISCOUNT_DEFAULTS[userType];
  if (!defaultConfig) return null;

  return {
    ...defaultConfig,
    usageThisMonth: 0,
    termsAccepted: false,
  } as IDiscountConfig;
}

/**
 * Check if user has a specific role
 */
export function hasRole(profile: IUnifiedProfile, role: Role): boolean {
  return profile.roles.includes(role);
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(profile: IUnifiedProfile, permission: keyof IRolePermissions): boolean {
  const permissionValue = profile.permissions.get(permission);
  return permissionValue === true;
}

/**
 * Get active badges for a profile
 */
export function getActiveBadges(profile: IUnifiedProfile): IVerificationBadge[] {
  const now = new Date();
  return profile.verificationBadges.filter(badge => {
    if (badge.status !== 'active') return false;
    if (badge.expiresAt && badge.expiresAt < now) return false;
    return true;
  });
}

/**
 * Check if user type is active and verified
 */
export function isUserTypeActiveAndVerified(
  profile: IUnifiedProfile,
  userType: UserType
): boolean {
  if (!profile.userType.includes(userType)) return false;
  if (profile.primaryUserType === userType && !profile.isPrimaryTypeActive) return false;

  const levelOrder = ['unverified', 'basic', 'verified', 'trusted', 'premium'];
  const currentLevelIndex = levelOrder.indexOf(profile.verificationLevel);

  // At least 'basic' verification required for active user types
  return currentLevelIndex >= 1;
}
