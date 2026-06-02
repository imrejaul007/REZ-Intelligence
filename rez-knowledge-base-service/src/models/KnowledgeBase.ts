import mongoose, { Schema, Document } from 'mongoose';

// ====== ALL MERCHANT TYPES ======
export type MerchantType =
  // Food & Beverage
  | 'restaurant' | 'cafe' | 'cloud_kitchen' | 'bakery' | 'bar' | 'food_court' | 'food_delivery'
  // Hospitality
  | 'hotel' | 'hostel' | 'homestay' | 'resort' | 'guesthouse'
  // Retail
  | 'retail' | 'grocery' | 'pharmacy' | 'electronics' | 'fashion' | 'furniture' | 'pet_store'
  // Beauty & Wellness
  | 'salon' | 'spa' | 'gym' | 'clinic'
  // Services
  | 'service' | 'laundry' | 'repair' | 'cleaning'
  // Transport & Travel
  | 'taxi' | 'transport' | 'parking'
  // Entertainment & Events
  | 'events' | 'tickets' | 'cinema' | 'gaming'
  // Education
  | 'tuition' | 'coaching' | 'courses'
  // Other
  | 'general';

// ====== MERCHANT TYPE GROUPS ======
export const MERCHANT_TYPE_GROUPS = {
  'Food & Beverage': ['restaurant', 'cafe', 'cloud_kitchen', 'bakery', 'bar', 'food_court', 'food_delivery'],
  'Hospitality': ['hotel', 'hostel', 'homestay', 'resort', 'guesthouse'],
  'Retail': ['retail', 'grocery', 'pharmacy', 'electronics', 'fashion', 'furniture', 'pet_store'],
  'Beauty & Wellness': ['salon', 'spa', 'gym', 'clinic'],
  'Services': ['service', 'laundry', 'repair', 'cleaning'],
  'Transport & Travel': ['taxi', 'transport', 'parking'],
  'Entertainment': ['events', 'tickets', 'cinema', 'gaming'],
  'Education': ['tuition', 'coaching', 'courses'],
  'Other': ['general']
};

// ====== INTERFACES ======

export interface IMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  preparationTime?: number;
  dietary?: string[];
  allergens?: string[];
  modifiers?: { name: string; price: number }[];
  complementary?: boolean;
}

export interface IFAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrainingDoc {
  id: string;
  title: string;
  content: string;
  type: 'book' | 'article' | 'document' | 'menu';
  source?: string;
  createdAt: Date;
}

export interface IBusinessInfo {
  name: string;
  type: MerchantType;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email?: string;
  website?: string;
  hours: { [day: string]: { open: string; close: string; closed?: boolean } };
  social?: { [platform: string]: string };
}

// ====== SALES STRATEGIES ======
export interface IComplimentaryOffer {
  item: string;
  condition?: string;
  description: string;
  isActive: boolean;
}

export interface IDiscount {
  name: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_item';
  value: number;
  minOrder?: number;
  applicableTo?: string[];
  validDays?: string[];
  validHours?: { start: string; end: string };
  code?: string;
  description: string;
  isActive: boolean;
}

export interface IPromotion {
  id: string;
  name: string;
  type: 'happy_hour' | 'seasonal' | 'loyalty' | 'first_order' | 'referral' | 'flash_sale';
  description: string;
  startDate?: Date;
  endDate?: Date;
  discount?: IDiscount;
  complimentaryItems?: IComplimentaryOffer[];
  terms?: string;
  isActive: boolean;
}

// ====== POLICIES INTERFACES ======

export interface IBasePolicy {
  acceptsReturns?: boolean;
  returnWindowDays?: number;
  returnConditions?: string;
  refundPolicy?: string;
  cancellationPolicy?: string;
  paymentMethods?: string[];
}

// RESTAURANT
export interface IRestaurantPolicy extends IBasePolicy {
  minOrderValue?: number;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
  deliveryAreas?: string[];
  deliveryTime?: string;
  reservationRequired?: boolean;
  reservationAdvanceHours?: number;
  partySizeLimit?: number;
  tableBookingFee?: number;
  complimentaryDrink?: IComplimentaryOffer;
  complimentaryAppetizer?: IComplimentaryOffer;
  complimentaryDessert?: IComplimentaryOffer;
  birthdayOffer?: IComplimentaryOffer;
  takeoutAvailable?: boolean;
  dineInOnly?: boolean;
  cateringAvailable?: boolean;
  privateDiningAvailable?: boolean;
  buffetAvailable?: boolean;
  buffetPrice?: number;
  alcoholServed?: boolean;
  dogFriendly?: boolean;
  outdoorSeating?: boolean;
}

// CAFE
export interface ICafePolicy extends IBasePolicy {
  minOrderValue?: number;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
  coworkingSpace?: boolean;
  meetingRoomAvailable?: boolean;
  meetingRoomFee?: number;
  complimentaryWiFi?: boolean;
  powerOutlets?: boolean;
}

// HOTEL
export interface IHotelPolicy extends IBasePolicy {
  checkInTime?: string;
  checkOutTime?: string;
  lateCheckoutAvailable?: boolean;
  lateCheckoutFee?: number;
  earlyCheckInAvailable?: boolean;
  earlyCheckInFee?: number;
  maxOccupancy?: number;
  extraBedAvailable?: boolean;
  extraBedFee?: number;
  complimentaryBreakfast?: boolean;
  complimentaryWiFi?: boolean;
  complimentaryParking?: boolean;
  complimentaryGym?: boolean;
  complimentaryPool?: boolean;
  complimentarySpa?: boolean;
  roomServiceAvailable?: boolean;
  laundryAvailable?: boolean;
  airportTransfer?: boolean;
  concierge24h?: boolean;
  miniBar?: boolean;
  safeDeposit?: boolean;
  securityDeposit?: number;
  idRequired?: boolean;
}

// HOSTEL/HOMESTAY
export interface IHostelPolicy extends IBasePolicy {
  checkInTime?: string;
  checkOutTime?: string;
  curfewTime?: string;
  commonKitchen?: boolean;
  laundryAvailable?: boolean;
  lockerProvided?: boolean;
  lockerFee?: number;
  complimentaryWiFi?: boolean;
  complimentaryBreakfast?: boolean;
}

// RESORT
export interface IResortPolicy extends IHotelPolicy {
  allInclusiveAvailable?: boolean;
  allInclusivePrice?: number;
  beachAccess?: boolean;
  kidsClub?: boolean;
  kidsClubAge?: number;
  waterSports?: boolean;
  spaIncluded?: boolean;
  golfCourse?: boolean;
}

// RETAIL
export interface IRetailPolicy extends IBasePolicy {
  storeCreditOnly?: boolean;
  originalPackagingRequired?: boolean;
  exchangeAvailable?: boolean;
  sizeExchangeDays?: number;
  loyaltyPointsEnabled?: boolean;
  pointsPerRupee?: number;
  giftWrappingAvailable?: boolean;
  giftWrappingFee?: number;
  alterationService?: boolean;
  homeDelivery?: boolean;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
}

// GROCERY
export interface IGroceryPolicy extends IBasePolicy {
  minOrderValue?: number;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
  deliveryTimeSlot?: string;
  deliveryAreas?: string[];
  freshnessGuarantee?: boolean;
  sameDayDelivery?: boolean;
  scheduledDelivery?: boolean;
}

// PHARMACY
export interface IPharmacyPolicy extends IBasePolicy {
  prescriptionRequired?: boolean;
  homeDelivery?: boolean;
  deliveryFee?: number;
  deliveryTime?: string;
  consultationAvailable?: boolean;
  consultationFee?: number;
  compoundingAvailable?: boolean;
  medicineExchange?: boolean;
}

// ELECTRONICS
export interface IElectronicsPolicy extends IBasePolicy {
  warrantyProvided?: boolean;
  warrantyPeriodMonths?: number;
  installationAvailable?: boolean;
  installationFee?: number;
  homeDelivery?: boolean;
  deliveryFee?: number;
  extendedWarranty?: boolean;
}

// FASHION
export interface IFashionPolicy extends IBasePolicy {
  tailoringAvailable?: boolean;
  tailoringFee?: number;
  sizeExchangeDays?: number;
  loyaltyPointsEnabled?: boolean;
  pointsPerRupee?: number;
  giftWrappingAvailable?: boolean;
  homeDelivery?: boolean;
  deliveryFee?: number;
}

// SALON
export interface ISalonPolicy extends IBasePolicy {
  advanceBookingRequired?: boolean;
  advanceBookingHours?: number;
  cancellationWindowHours?: number;
  packagesAvailable?: boolean;
  membershipAvailable?: boolean;
  consultationFree?: boolean;
  consultationFee?: number;
  homeServiceAvailable?: boolean;
  homeServiceFee?: number;
}

// SPA
export interface ISpaPolicy extends IBasePolicy {
  advanceBookingRequired?: boolean;
  advanceBookingHours?: number;
  cancellationWindowHours?: number;
  packagesAvailable?: boolean;
  membershipAvailable?: boolean;
  saunaAvailable?: boolean;
  steamRoomAvailable?: boolean;
  jacuzziAvailable?: boolean;
  healthFormRequired?: boolean;
  ageRestriction?: number;
  couplePackages?: boolean;
}

// GYM
export interface IGymPolicy extends IBasePolicy {
  joiningFee?: number;
  monthlyFee?: number;
  yearlyFee?: number;
  quarterlyFee?: number;
  hours24h?: boolean;
  accessTo?: string[];
  personalTrainingAvailable?: boolean;
  personalTrainingFee?: number;
  guestPassesIncluded?: number;
  additionalGuestFee?: number;
  lockerRental?: boolean;
  lockerFee?: number;
  yogaClasses?: boolean;
  zumba?: boolean;
  crossfit?: boolean;
}

// CLINIC
export interface IClinicPolicy extends IBasePolicy {
  appointmentRequired?: boolean;
  emergencyService?: boolean;
  homeVisitAvailable?: boolean;
  homeVisitFee?: number;
  insuranceAccepted?: boolean;
  insuranceProviders?: string[];
  consultationFee?: number;
  reportDelivery?: boolean;
}

// LAUNDRY
export interface ILaundryPolicy extends IBasePolicy {
  selfService?: boolean;
  dropOffService?: boolean;
  pickupDelivery?: boolean;
  pickupDeliveryFee?: number;
  expressService?: boolean;
  expressServiceFee?: number;
  ironingIncluded?: boolean;
  dryCleaningAvailable?: boolean;
}

// TAXI/TRANSPORT
export interface ITaxiPolicy extends IBasePolicy {
  baseFare?: number;
  perKmRate?: number;
  perMinuteRate?: number;
  minimumFare?: number;
  airportTransfer?: boolean;
  outstationAvailable?: boolean;
  corporateAccounts?: boolean;
  vehicleTypes?: string[];
  cashEnabled?: boolean;
  onlinePaymentEnabled?: boolean;
  corporateBilling?: boolean;
  driverDetailsShared?: boolean;
}

// PARKING
export interface IParkingPolicy extends IBasePolicy {
  hourlyRate?: number;
  dailyMaxRate?: number;
  monthlyPass?: boolean;
  monthlyPassFee?: number;
  evCharging?: boolean;
  evChargingRate?: number;
  valetParking?: boolean;
  valetParkingFee?: number;
  coveredParking?: boolean;
}

// EVENTS/TICKETS
export interface IEventsPolicy extends IBasePolicy {
  refundPolicy?: string;
  transferAllowed?: boolean;
  transferFee?: number;
  ageRestriction?: number;
  seatSelection?: boolean;
  bookingFee?: number;
  instantConfirmation?: boolean;
}

// COURSES/TUITION
export interface ICoursesPolicy extends IBasePolicy {
  demoClassAvailable?: boolean;
  demoClassCount?: number;
  refundPolicy?: string;
  installmentAvailable?: boolean;
  studyMaterialProvided?: boolean;
  certificateProvided?: boolean;
  certificateFee?: number;
  placementAssistance?: boolean;
}

// UNIFIED POLICY
export interface IPolicy {
  cancellation?: string;
  delivery?: { minOrder: number; fee: number; areas: string[] };
  reservationRules?: string;
  restaurant?: IRestaurantPolicy;
  cafe?: ICafePolicy;
  hotel?: IHotelPolicy;
  hostel?: IHostelPolicy;
  resort?: IResortPolicy;
  retail?: IRetailPolicy;
  grocery?: IGroceryPolicy;
  pharmacy?: IPharmacyPolicy;
  electronics?: IElectronicsPolicy;
  fashion?: IFashionPolicy;
  salon?: ISalonPolicy;
  spa?: ISpaPolicy;
  gym?: IGymPolicy;
  clinic?: IClinicPolicy;
  laundry?: ILaundryPolicy;
  taxi?: ITaxiPolicy;
  transport?: ITaxiPolicy;
  parking?: IParkingPolicy;
  events?: IEventsPolicy;
  tickets?: IEventsPolicy;
  courses?: ICoursesPolicy;
  tuition?: ICoursesPolicy;
  customPolicies?: { key: string; value: string; description: string }[];
}

// ====== MAIN INTERFACE ======
export interface IMerchantKnowledge extends Document {
  merchantId: string;
  businessInfo: IBusinessInfo;
  menuData: { categories: string[]; items: IMenuItem[]; lastUpdated: Date };
  policies: IPolicy;
  faqs: IFAQ[];
  trainingDocs: ITrainingDoc[];
  complimentaryOffers?: IComplimentaryOffer[];
  discounts?: IDiscount[];
  activePromotions?: IPromotion[];
  settings: {
    aiEnabled: boolean;
    autoResponse: boolean;
    escalationThreshold: number;
    salesStrategyEnabled?: boolean;
    allowDynamicPricing?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ====== SCHEMAS ======

const ComplimentaryOfferSchema = new Schema({
  item: { type: String, required: true },
  condition: { type: String },
  description: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const DiscountSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['percentage', 'fixed', 'bogo', 'free_item'], required: true },
  value: { type: Number, required: true },
  minOrder: { type: Number },
  applicableTo: [{ type: String }],
  validDays: [{ type: String }],
  validHours: { start: { type: String }, end: { type: String } },
  code: { type: String },
  description: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const PromotionSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['happy_hour', 'seasonal', 'loyalty', 'first_order', 'referral', 'flash_sale'], required: true },
  description: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  discount: { type: DiscountSchema },
  complimentaryItems: [{ type: ComplimentaryOfferSchema }],
  terms: { type: String },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const MenuItemSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String },
  available: { type: Boolean, default: true },
  preparationTime: { type: Number },
  dietary: [{ type: String }],
  allergens: [{ type: String }],
  modifiers: [{ name: { type: String }, price: { type: Number } }],
  complementary: { type: Boolean, default: false }
}, { _id: false });

const FAQSchema = new Schema({
  id: { type: String, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String },
  tags: [{ type: String }],
  helpfulCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const TrainingDocSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['book', 'article', 'document', 'menu'] },
  source: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const BusinessInfoSchema = new Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'restaurant', 'cafe', 'cloud_kitchen', 'bakery', 'bar', 'food_court', 'food_delivery',
      'hotel', 'hostel', 'homestay', 'resort', 'guesthouse',
      'retail', 'grocery', 'pharmacy', 'electronics', 'fashion', 'furniture', 'pet_store',
      'salon', 'spa', 'gym', 'clinic',
      'service', 'laundry', 'repair', 'cleaning',
      'taxi', 'transport', 'parking',
      'events', 'tickets', 'cinema', 'gaming',
      'tuition', 'coaching', 'courses',
      'general'
    ],
    required: true
  },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  website: { type: String },
  hours: { type: Map, of: { open: { type: String }, close: { type: String }, closed: { type: Boolean } } },
  social: { type: Map, of: { type: String } }
}, { _id: false });

const PolicySchema = new Schema({}, { _id: false, strict: false });

const MerchantKnowledgeSchema = new Schema({
  merchantId: { type: String, required: true, unique: true, index: true },
  businessInfo: { type: BusinessInfoSchema, required: true },
  menuData: {
    categories: [{ type: String }],
    items: [{ type: MenuItemSchema }],
    lastUpdated: { type: Date, default: Date.now }
  },
  policies: { type: PolicySchema, default: {} },
  faqs: [{ type: FAQSchema }],
  trainingDocs: [{ type: TrainingDocSchema }],
  complimentaryOffers: [{ type: ComplimentaryOfferSchema }],
  discounts: [{ type: DiscountSchema }],
  activePromotions: [{ type: PromotionSchema }],
  settings: {
    aiEnabled: { type: Boolean, default: true },
    autoResponse: { type: Boolean, default: false },
    escalationThreshold: { type: Number, default: 0.8 },
    salesStrategyEnabled: { type: Boolean, default: false },
    allowDynamicPricing: { type: Boolean, default: false }
  }
}, { timestamps: true });

MerchantKnowledgeSchema.index({ 'businessInfo.type': 1 });
MerchantKnowledgeSchema.index({ 'businessInfo.city': 1 });
MerchantKnowledgeSchema.index({ 'activePromotions.isActive': 1 });
MerchantKnowledgeSchema.index({ 'settings.salesStrategyEnabled': 1 });

export const MerchantKnowledgeModel = mongoose.model<IMerchantKnowledge>('MerchantKnowledge', MerchantKnowledgeSchema);
