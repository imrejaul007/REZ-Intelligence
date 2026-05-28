import mongoose, { Document, Schema } from 'mongoose';

// Identifier types that can be used to identify a customer
export type IdentifierType = 'phone' | 'email' | 'device_id' | 'external_id';

// Company identifiers
export type CompanyId =
  | 'rez-merchant'
  | 'rez-consumer'
  | 'rez-media'
  | 'rabtul-technologies'
  | 'stayown-hospitality'
  | 'corpperks'
  | 'rtnm-group';

// Customer identifier interface
export interface IIdentifier {
  type: IdentifierType;
  value: string;
  companyId: CompanyId;
  isPrimary: boolean;
  isVerified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Linked account from another company
export interface ILinkedAccount {
  companyId: CompanyId;
  externalCustomerId: string;
  linkedAt: Date;
  linkedBy: 'system' | 'manual' | 'user';
  confidenceScore: number;
}

// Basic profile information
export interface IBasicProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  language?: string;
  timezone?: string;
}

// Location information
export interface ILocation {
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Preferences
export interface IPreferences {
  marketingOptIn: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean;
  pushNotifications: boolean;
  dataProcessingConsent: boolean;
  thirdPartySharing: boolean;
}

// Customer document interface
export interface ICustomer extends Document {
  // Unified customer ID (format: UC-{uuid})
  unifiedCustomerId: string;

  // Primary identifiers
  primaryPhone?: string;
  primaryEmail?: string;

  // All identifiers
  identifiers: IIdentifier[];

  // Linked accounts from other companies
  linkedAccounts: ILinkedAccount[];

  // Basic profile
  profile: IBasicProfile;

  // Location
  location?: ILocation;

  // Preferences
  preferences: IPreferences;

  // Customer classification
  customerType: 'individual' | 'business';
  customerTier?: 'standard' | 'premium' | 'vip';

  // RFM scores
  rfmScores?: {
    recency: number;
    frequency: number;
    monetary: number;
    calculatedAt: Date;
  };

  // Activity tracking
  activity: {
    firstActivityAt?: Date;
    lastActivityAt?: Date;
    totalSessions: number;
    totalTransactions: number;
  };

  // Metadata
  metadata: {
    createdSource: string;
    lastUpdatedBy: string;
    sourceCompany: CompanyId;
  };

  // Privacy
  isAnonymized: boolean;
  deletionRequestedAt?: Date;
  deletedAt?: Date;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// Schema definitions
const IdentifierSchema = new Schema<IIdentifier>(
  {
    type: {
      type: String,
      enum: ['phone', 'email', 'device_id', 'external_id'],
      required: true,
    },
    value: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    companyId: {
      type: String,
      enum: [
        'rez-merchant',
        'rez-consumer',
        'rez-media',
        'rabtul-technologies',
        'stayown-hospitality',
        'corpperks',
        'rtnm-group',
      ],
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
  },
  { _id: false, timestamps: true }
);

const LinkedAccountSchema = new Schema<ILinkedAccount>(
  {
    companyId: {
      type: String,
      enum: [
        'rez-merchant',
        'rez-consumer',
        'rez-media',
        'rabtul-technologies',
        'stayown-hospitality',
        'corpperks',
        'rtnm-group',
      ],
      required: true,
    },
    externalCustomerId: {
      type: String,
      required: true,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    linkedBy: {
      type: String,
      enum: ['system', 'manual', 'user'],
      default: 'system',
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: false }
);

const BasicProfileSchema = new Schema<IBasicProfile>(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    avatar: { type: String },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    language: { type: String, default: 'en' },
    timezone: { type: String },
  },
  { _id: false }
);

const LocationSchema = new Schema<ILocation>(
  {
    city: { type: String },
    state: { type: String },
    country: { type: String },
    countryCode: { type: String },
    postalCode: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
  { _id: false }
);

const PreferencesSchema = new Schema<IPreferences>(
  {
    marketingOptIn: { type: Boolean, default: false },
    smsOptIn: { type: Boolean, default: false },
    emailOptIn: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: true },
    dataProcessingConsent: { type: Boolean, default: true },
    thirdPartySharing: { type: Boolean, default: false },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    unifiedCustomerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    primaryPhone: {
      type: String,
      sparse: true,
      index: true,
    },
    primaryEmail: {
      type: String,
      sparse: true,
      index: true,
    },
    identifiers: [IdentifierSchema],
    linkedAccounts: [LinkedAccountSchema],
    profile: {
      type: BasicProfileSchema,
      default: () => ({}),
    },
    location: {
      type: LocationSchema,
    },
    preferences: {
      type: PreferencesSchema,
      default: () => ({
        marketingOptIn: false,
        smsOptIn: false,
        emailOptIn: false,
        pushNotifications: true,
        dataProcessingConsent: true,
        thirdPartySharing: false,
      }),
    },
    customerType: {
      type: String,
      enum: ['individual', 'business'],
      default: 'individual',
    },
    customerTier: {
      type: String,
      enum: ['standard', 'premium', 'vip'],
    },
    rfmScores: {
      recency: { type: Number },
      frequency: { type: Number },
      monetary: { type: Number },
      calculatedAt: { type: Date },
    },
    activity: {
      firstActivityAt: { type: Date },
      lastActivityAt: { type: Date },
      totalSessions: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
    },
    metadata: {
      createdSource: { type: String, required: true },
      lastUpdatedBy: { type: String },
      sourceCompany: {
        type: String,
        enum: [
          'rez-merchant',
          'rez-consumer',
          'rez-media',
          'rabtul-technologies',
          'stayown-hospitality',
          'corpperks',
          'rtnm-group',
        ],
        required: true,
      },
    },
    isAnonymized: {
      type: Boolean,
      default: false,
    },
    deletionRequestedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'customers',
  }
);

// Indexes
CustomerSchema.index({ 'identifiers.type': 1, 'identifiers.value': 1 });
CustomerSchema.index({ 'linkedAccounts.companyId': 1, 'linkedAccounts.externalCustomerId': 1 });
CustomerSchema.index({ isAnonymized: 1, deletedAt: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ 'activity.lastActivityAt': -1 });

// Pre-save hook to generate unifiedCustomerId if not present
CustomerSchema.pre('save', function (next: (err?: Error) => void) {
  if (!this.unifiedCustomerId) {
    const { v4: uuidv4 } = require('uuid');
    this.unifiedCustomerId = `UC-${uuidv4()}`;
  }
  next();
});

// Methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CustomerSchema.methods as any).findIdentifier = function (
  this: ICustomer,
  type: IdentifierType,
  value: string
): IIdentifier | undefined {
  return this.identifiers.find(
    (id) => id.type === type && id.value.toLowerCase() === value.toLowerCase()
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CustomerSchema.methods as any).hasIdentifier = function (
  this: ICustomer,
  type: IdentifierType,
  value: string
): boolean {
  return this.identifiers.some(
    (id) => id.type === type && id.value.toLowerCase() === value.toLowerCase()
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CustomerSchema.methods as any).addIdentifier = function (this: ICustomer, identifier: IIdentifier): void {
  const existingIndex = this.identifiers.findIndex(
    (id) => id.type === identifier.type && id.value.toLowerCase() === identifier.value.toLowerCase()
  );

  if (existingIndex >= 0) {
    this.identifiers[existingIndex] = identifier;
  } else {
    this.identifiers.push(identifier);
  }

  // Update primary identifiers
  if (identifier.isPrimary) {
    if (identifier.type === 'phone') {
      this.primaryPhone = identifier.value;
    } else if (identifier.type === 'email') {
      this.primaryEmail = identifier.value;
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CustomerSchema.methods as any).linkAccount = function (this: ICustomer, account: ILinkedAccount): void {
  const existingIndex = this.linkedAccounts.findIndex(
    (acc) => acc.companyId === account.companyId && acc.externalCustomerId === account.externalCustomerId
  );

  if (existingIndex >= 0) {
    this.linkedAccounts[existingIndex] = account;
  } else {
    this.linkedAccounts.push(account);
  }
};

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
