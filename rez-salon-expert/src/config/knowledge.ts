export interface SalonService {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  duration: number;
  price: number;
  priceRange?: { min: number; max: number };
  benefits: string[];
  whatToExpect: string[];
  aftercareTips: string[];
  contraindications?: string[];
  suitableFor: string[];
  allergens?: string[];
  requiresConsultation?: boolean;
}

export interface SkincareProduct {
  id: string;
  name: string;
  brand: string;
  type: string;
  skinType: string[];
  concerns: string[];
  ingredients: string[];
  price: number;
  description: string;
  howToUse: string[];
}

export interface SkinType {
  id: string;
  name: string;
  characteristics: string[];
  concerns: string[];
  recommendedProducts: string[];
  avoidIngredients: string[];
}

export const HAIR_SERVICES: SalonService[] = [
  {
    id: 'haircut',
    name: 'Haircut & Style',
    category: 'hair',
    subcategory: 'cuts',
    description: 'Professional cut tailored to your face shape, hair type, and style preferences, including wash and styling.',
    duration: 45,
    price: 55,
    priceRange: { min: 45, max: 120 },
    benefits: ['Removes split ends', 'Shapes your face', 'Refreshes your look', 'Promotes healthy growth'],
    whatToExpect: ['Consultation on desired look', 'Shampoo and conditioning', 'Precision cut', 'Blow-dry and style'],
    aftercareTips: ['Use sulfate-free shampoo', 'Trim every 6-8 weeks', 'Use heat protectant', 'Sleep on silk pillowcase'],
    suitableFor: ['Everyone', 'All hair types'],
    requiresConsultation: false
  },
  {
    id: 'hair-color',
    name: 'Full Color',
    category: 'hair',
    subcategory: 'color',
    description: 'Complete color transformation with professional-grade products for rich, vibrant, lasting color.',
    duration: 120,
    price: 150,
    priceRange: { min: 100, max: 250 },
    benefits: ['Cover gray', 'Change your look', 'Boost confidence', 'Add dimension'],
    whatToExpect: ['Patch test (first time)', 'Consultation on shade', 'Application and processing', 'Toner and glaze', 'Blow-dry'],
    aftercareTips: ['Wait 48 hours before washing', 'Use color-safe products', 'Avoid chlorine', 'Use UV protection'],
    suitableFor: ['All hair types', 'Those wanting color change'],
    allergens: ['Ammonia', 'PPD', 'Resorcinol'],
    requiresConsultation: true
  },
  {
    id: 'highlights',
    name: 'Highlights',
    category: 'hair',
    subcategory: 'color',
    description: 'Dimensional color that adds brightness and depth with foil highlights or balayage technique.',
    duration: 150,
    price: 180,
    priceRange: { min: 120, max: 350 },
    benefits: ['Adds dimension', 'Brightens face', 'Low maintenance grow-out', 'Natural-looking results'],
    whatToExpect: ['Consultation on placement', 'Sectioning and application', 'Processing time', 'Tone adjustment', 'Blow-dry'],
    aftercareTips: ['Use purple shampoo for brassiness', 'Deep condition weekly', 'Schedule touch-ups every 8-12 weeks'],
    suitableFor: ['All hair types', 'Those wanting dimension'],
    allergens: ['Ammonia', 'PPD'],
    requiresConsultation: true
  },
  {
    id: 'balayage',
    name: 'Balayage',
    category: 'hair',
    subcategory: 'color',
    description: 'Hand-painted highlights for a natural, sun-kissed effect with seamless grow-out.',
    duration: 180,
    price: 250,
    priceRange: { min: 200, max: 400 },
    benefits: ['Natural look', 'Grows out beautifully', 'Low maintenance', 'Custom placement'],
    whatToExpect: ['Extensive consultation', 'Hand-painting technique', 'Toning', 'Blow-dry and style'],
    aftercareTips: ['Use color-safe shampoo', 'Olaplex treatments', 'Touch-ups every 3-4 months', 'Use UV protection'],
    suitableFor: ['Medium to thick hair', 'Those wanting natural color'],
    allergens: ['Ammonia', 'PPD'],
    requiresConsultation: true
  },
  {
    id: 'keratin',
    name: 'Keratin Treatment',
    category: 'hair',
    subcategory: 'treatments',
    description: 'Smoothing treatment that eliminates frizz, adds shine, and makes hair more manageable for months.',
    duration: 180,
    price: 300,
    priceRange: { min: 200, max: 500 },
    benefits: ['Frizz elimination', 'Increased shine', 'Faster styling', 'Lasts 3-5 months'],
    whatToExpect: ['Consultation', 'Cleansing treatment', 'Application', 'Flat iron sealing', 'Blow-dry'],
    aftercareTips: ['No washing for 48 hours', 'No ties or clips for 48 hours', 'Use sulfate-free products', 'Wait 2 weeks for pool'],
    suitableFor: ['Frizzy, thick, or curly hair'],
    contraindications: ['Pregnant', 'recent keratin straightening (under 3 months)'],
    requiresConsultation: true
  },
  {
    id: 'deep-condition',
    name: 'Deep Conditioning Treatment',
    category: 'hair',
    subcategory: 'treatments',
    description: 'Intensive moisture and protein treatment to restore, strengthen, and nourish damaged hair.',
    duration: 45,
    price: 45,
    priceRange: { min: 30, max: 75 },
    benefits: ['Restores moisture', 'Strengthens hair', 'Adds shine', 'Improves elasticity'],
    whatToExpect: ['Shampoo', 'Treatment application', 'Steam processing', 'Rinse and style'],
    aftercareTips: ['Continue with weekly treatments', 'Use leave-in conditioner', 'Minimize heat styling'],
    suitableFor: ['Dry, damaged, or color-treated hair']
  },
  {
    id: 'bridal-hair',
    name: 'Bridal Hair',
    category: 'hair',
    subcategory: 'special-occasion',
    description: 'Complete bridal styling including trial, day-of styling, and touch-ups.',
    duration: 120,
    price: 200,
    priceRange: { min: 150, max: 400 },
    benefits: ['Perfect wedding day look', 'Trial included', 'Long-lasting hold', 'Photographs beautifully'],
    whatToExpect: ['Trial appointment', 'Consultation on style', 'Day-of styling', 'Accessories placement'],
    aftercareTips: ['Bring inspiration photos', 'Have veil/headpiece ready', 'Stay hydrated', 'Arrive with clean hair'],
    suitableFor: ['Brides', 'Wedding party'],
    requiresConsultation: true
  }
];

export const NAIL_SERVICES: SalonService[] = [
  {
    id: 'manicure',
    name: 'Classic Manicure',
    category: 'nails',
    subcategory: 'manicure',
    description: 'Nail shaping, cuticle care, hand massage, and polish application for beautiful nails.',
    duration: 30,
    price: 25,
    priceRange: { min: 20, max: 45 },
    benefits: ['Clean, shaped nails', 'Healthy cuticles', 'Relaxed hands', 'Polished look'],
    whatToExpect: ['Sanitized soak', 'Nail shaping', 'Cuticle care', 'Hand massage', 'Polish of choice'],
    aftercareTips: ['Reapply top coat daily', 'Wear gloves for dishes', 'Moisturize daily', 'Avoid picking at nails'],
    suitableFor: ['Everyone', 'Regular maintenance'],
    allergens: ['Polish ingredients (formaldehyde, toluene, DBHP)']
  },
  {
    id: 'gel-manicure',
    name: 'Gel Manicure',
    category: 'nails',
    subcategory: 'manicure',
    description: 'Long-lasting gel polish that shines for weeks without chipping.',
    duration: 45,
    price: 40,
    priceRange: { min: 35, max: 65 },
    benefits: ['2-3 week wear', 'High shine', 'No chipping', 'Quick dry'],
    whatToExpect: ['Nail prep', 'Base coat', 'Gel color application', 'UV cure between coats', 'Cuticle care'],
    aftercareTips: ['Avoid picking', 'Use cuticle oil daily', 'File if needed', 'Soak off properly'],
    suitableFor: ['Those wanting long-lasting color'],
    allergens: ['Methacrylate', 'HEMA', 'UV light sensitivity'],
    requiresConsultation: false
  },
  {
    id: 'acrylic-extensions',
    name: 'Acrylic Nail Extensions',
    category: 'nails',
    subcategory: 'extensions',
    description: 'Artificial nail extensions for added length and strength with endless design options.',
    duration: 90,
    price: 65,
    priceRange: { min: 55, max: 100 },
    benefits: ['Instant length', 'Strength', 'Custom shapes', 'Durability'],
    whatToExpect: ['Consultation on shape/length', 'Nail prep', 'Acrylic application', 'Shaping and buffing', 'Polish'],
    aftercareTips: ['Fill every 2-3 weeks', 'Avoid as leverage', 'Keep dry for 24 hours', 'Use cuticle oil'],
    suitableFor: ['Those wanting length', 'Weak or bitten nails'],
    allergens: ['Methyl methacrylate', 'Acrylic dust'],
    requiresConsultation: true
  },
  {
    id: 'nail-art',
    name: 'Nail Art & Design',
    category: 'nails',
    subcategory: 'art',
    description: 'Custom nail designs from simple accents to intricate hand-painted art.',
    duration: 30,
    price: 15,
    priceRange: { min: 10, max: 50 },
    benefits: ['Self-expression', 'Unique look', 'Trendy designs', 'Special occasions'],
    whatToExpect: ['Design consultation', 'Base manicure/gel', 'Art application', 'Sealing and finishing'],
    aftercareTips: ['Avoid picking at designs', 'Use top coat daily', 'Be gentle with extensions'],
    suitableFor: ['Creative individuals', 'Special occasions'],
    requiresConsultation: false
  },
  {
    id: 'pedicure',
    name: 'Spa Pedicure',
    category: 'nails',
    subcategory: 'pedicure',
    description: 'Luxurious foot treatment including soak, exfoliation, massage, and polish.',
    duration: 60,
    price: 50,
    priceRange: { min: 40, max: 80 },
    benefits: ['Soft feet', 'Relaxed legs', 'Improved circulation', 'Beautiful toes'],
    whatToExpect: ['Sanitized foot soak', 'Exfoliation scrub', 'Callus treatment', 'Lower leg massage', 'Polish'],
    aftercareTips: ['Exfoliate weekly', 'Wear breathable shoes', 'Moisturize feet', 'Change socks daily'],
    suitableFor: ['Everyone', 'Especially summer'],
    allergens: ['Scrub ingredients', 'Polish']
  }
];

export const SKINCARE_SERVICES: SalonService[] = [
  {
    id: 'classic-facial',
    name: 'Classic Facial',
    category: 'skincare',
    subcategory: 'facial',
    description: 'Deep cleansing facial customized for your skin type with extraction, massage, and mask.',
    duration: 60,
    price: 85,
    priceRange: { min: 60, max: 150 },
    benefits: ['Cleaner pores', 'Hydrated skin', 'Relaxed muscles', 'Glowing complexion'],
    whatToExpect: ['Skin analysis', 'Cleansing', 'Steam', 'Extractions', 'Face massage', 'Mask', 'Serum and moisturizer'],
    aftercareTips: ['Stay hydrated', 'Use recommended products', 'Avoid touching face', 'Use SPF daily'],
    suitableFor: ['All skin types', 'First-time facials'],
    allergens: ['Various active ingredients']
  },
  {
    id: 'chemical-peel',
    name: 'Chemical Peel',
    category: 'skincare',
    subcategory: 'treatments',
    description: 'Exfoliating treatment that removes damaged skin cells for brighter, smoother skin.',
    duration: 45,
    price: 120,
    priceRange: { min: 80, max: 200 },
    benefits: ['Smoother texture', 'Even skin tone', 'Reduced fine lines', 'Improved radiance'],
    whatToExpect: ['Skin prep', 'Peel application', 'Processing time', 'Neutralization', 'Soothing products'],
    aftercareTips: ['Peeling is normal - dont pick', 'Use gentle cleanser', 'Avoid sun exposure', 'Use SPF 30+', 'No active ingredients for 1 week'],
    suitableFor: ['Dull skin', 'Uneven tone', 'Fine lines'],
    contraindications: ['Active acne', 'Rosacea flare', 'Pregnant', 'Recent Accutane use'],
    allergens: ['AHA', 'BHA', 'TCA'],
    requiresConsultation: true
  },
  {
    id: 'microdermabrasion',
    name: 'Microdermabrasion',
    category: 'skincare',
    subcategory: 'treatments',
    description: 'Gentle exfoliation that buffs away dead skin for immediate glow and smoothness.',
    duration: 45,
    price: 100,
    priceRange: { min: 75, max: 180 },
    benefits: ['Instant glow', 'Smoother texture', 'Reduced appearance of pores', 'Better product absorption'],
    whatToExpect: ['Skin cleansing', 'Exfoliation pass', 'Serum application', 'Moisturizer and SPF'],
    aftercareTips: ['Use gentle products for 24 hours', 'Avoid direct sun', 'Hydrate well', 'No retinoids for 48 hours'],
    suitableFor: ['All skin types', 'Dull or congested skin'],
    contraindications: ['Active acne', 'Rosacea', 'Thin skin'],
    requiresConsultation: false
  },
  {
    id: 'hydrafacial',
    name: 'HydraFacial',
    category: 'skincare',
    subcategory: 'facial',
    description: 'Medical-grade hydradermabrasion that cleanses, extracts, and hydrates simultaneously.',
    duration: 60,
    price: 200,
    priceRange: { min: 150, max: 350 },
    benefits: ['Deep hydration', 'Immediate glow', 'No downtime', 'Customizable boosters'],
    whatToExpect: ['Cleansing', 'Glycolic peel', 'Extractions', 'Hydration infusion', 'LED light (optional)', 'SPF'],
    aftercareTips: ['No makeup for 24 hours preferred', 'Use hydrating serums', 'Avoid harsh products', 'Continue SPF'],
    suitableFor: ['All skin types', 'Sensitive skin', 'Those wanting glow without downtime'],
    allergens: ['Hyaluronic acid', 'Antioxidants']
  },
  {
    id: 'led-therapy',
    name: 'LED Light Therapy',
    category: 'skincare',
    subcategory: 'treatments',
    description: 'Therapeutic light wavelengths that stimulate collagen, reduce inflammation, or target acne.',
    duration: 30,
    price: 75,
    priceRange: { min: 50, max: 150 },
    benefits: ['Collagen stimulation', 'Acne reduction', 'Reduced redness', 'Faster healing'],
    whatToExpect: ['Skin cleansing', 'Eye protection', 'LED mask application', 'Relaxing session'],
    aftercareTips: ['Continue with regular skincare', 'Use SPF', 'Stay hydrated', 'Results improve with series'],
    suitableFor: ['Aging skin', 'Acne-prone skin', 'Sensitive skin'],
    contraindications: ['Pregnancy', 'Epilepsy', 'Light sensitivity', 'Cancer']
  }
];

export const BODY_SERVICES: SalonService[] = [
  {
    id: 'swedish-massage',
    name: 'Swedish Massage',
    category: 'body',
    subcategory: 'massage',
    description: 'Classic relaxation massage using long strokes and kneading to ease tension and improve circulation.',
    duration: 60,
    price: 80,
    priceRange: { min: 60, max: 150 },
    benefits: ['Muscle relaxation', 'Improved circulation', 'Reduced stress', 'Better sleep'],
    whatToExpect: ['Consultation on pressure', 'Draping for modesty', 'Effleurage strokes', 'Kneading', 'Stretching'],
    aftercareTips: ['Drink water to flush toxins', 'Take a warm bath', 'Rest if possible', 'Avoid strenuous activity'],
    suitableFor: ['Everyone', 'First-time massage', 'Stress relief']
  },
  {
    id: 'deep-tissue',
    name: 'Deep Tissue Massage',
    category: 'body',
    subcategory: 'massage',
    description: 'Intensive massage targeting deep muscle layers to release chronic tension and knots.',
    duration: 60,
    price: 95,
    priceRange: { min: 75, max: 180 },
    benefits: ['Chronic pain relief', 'Muscle knot release', 'Improved mobility', 'Post-workout recovery'],
    whatToExpect: ['Pressure assessment', 'Focused work on problem areas', 'Firm pressure', 'Stretching'],
    aftercareTips: ['Drink plenty of water', 'May feel sore for 24 hours', 'Use ice or heat as needed', 'Schedule regular sessions'],
    suitableFor: ['Athletes', 'Chronic pain', 'Tension buildup'],
    contraindications: ['Blood clots', 'Fractures', 'Recent surgery'],
    requiresConsultation: true
  },
  {
    id: 'body-wrap',
    name: 'Detox Body Wrap',
    category: 'body',
    subcategory: 'wraps',
    description: 'Full-body treatment that detoxifies, firms, and hydrates while you relax.',
    duration: 90,
    price: 150,
    priceRange: { min: 100, max: 250 },
    benefits: ['Detoxification', 'Firming', 'Hydration', 'Smoother skin'],
    whatToExpect: ['Body exfoliation', 'Application of wrap solution', 'Wrapping', 'Steam or heat', 'Rinse and moisturize'],
    aftercareTips: ['Drink lots of water', 'Eat light', 'Avoid caffeine and alcohol', 'Results last 1-2 weeks'],
    suitableFor: ['Puffy skin', 'Post-weight loss', 'Sluggish circulation'],
    contraindications: ['Pregnancy', 'Heart conditions', 'Diabetes', 'Skin infections'],
    allergens: ['Seaweed', 'Herbs', 'Essential oils'],
    requiresConsultation: true
  },
  {
    id: 'brazilian-wax',
    name: 'Brazilian Wax',
    category: 'body',
    subcategory: 'hair-removal',
    description: 'Professional waxing service for complete or partial hair removal in the bikini area.',
    duration: 30,
    price: 50,
    priceRange: { min: 35, max: 80 },
    benefits: ['Smooth results', 'Thinner regrowth over time', 'No razor burn', 'Longer lasting than shaving'],
    whatToExpect: ['Brief consultation', 'Preparation', 'Warm wax application', 'Quick hair removal', 'Soothing lotion'],
    aftercareTips: ['Exfoliate after 48 hours', 'Wear loose clothing', 'Avoid heat for 24 hours', 'Moisturize regularly'],
    suitableFor: ['Those wanting smooth results', 'Regular waxing clients'],
    contraindications: ['Sunburn', 'Irritated skin', 'Certain medications'],
    allergens: ['Wax ingredients', 'Resin'],
    requiresConsultation: false
  },
  {
    id: 'spray-tan',
    name: 'Spray Tan',
    category: 'body',
    subcategory: 'tanning',
    description: 'Sunless tanning solution applied professionally for a natural-looking, even tan.',
    duration: 30,
    price: 45,
    priceRange: { min: 30, max: 75 },
    benefits: ['Instant color', 'No UV damage', 'Even application', 'Lasts 5-10 days'],
    whatToExpect: ['Consultation on shade', 'Protective barrier application', 'Spray application', 'Drying time'],
    aftercareTips: ['Wait 8-12 hours before showering', 'Moisturize daily', 'Avoid chlorine', 'Pat dry'],
    suitableFor: ['Special events', 'Pale skin', 'Those avoiding sun'],
    allergens: ['Dihydroxyacetone (DHA)']
  }
];

export const MAKEUP_SERVICES: SalonService[] = [
  {
    id: 'bridal-makeup',
    name: 'Bridal Makeup',
    category: 'makeup',
    subcategory: 'bridal',
    description: 'Flawless, long-lasting bridal makeup with trial included for your perfect wedding look.',
    duration: 90,
    price: 175,
    priceRange: { min: 125, max: 300 },
    benefits: ['Photograph-ready look', 'Long wear formula', 'Waterproof', 'Matches dress'],
    whatToExpect: ['Trial session', 'Skin prep', 'Full makeup application', 'Setting spray', 'Touch-up kit'],
    aftercareTips: ['Bring reference photos', 'Have veil/ accessories ready', 'Stay hydrated', 'Trust your artist'],
    suitableFor: ['Brides', 'Wedding party'],
    allergens: ['Various cosmetic ingredients'],
    requiresConsultation: true
  },
  {
    id: 'special-occasion',
    name: 'Special Occasion Makeup',
    category: 'makeup',
    subcategory: 'occasion',
    description: 'Glamorous makeup for parties, proms, galas, or unknown special event.',
    duration: 60,
    price: 100,
    priceRange: { min: 75, max: 175 },
    benefits: ['Statement look', 'Photography ready', 'Lasts all event', 'Boosts confidence'],
    whatToExpect: ['Look consultation', 'Skin prep', 'Makeup application', 'Finishing spray'],
    aftercareTips: ['Bring photos of desired look', 'Consider your outfit', 'Plan accessories'],
    suitableFor: ['Parties', 'Prom', 'Galas', 'Photoshoots'],
    allergens: ['Various cosmetic ingredients'],
    requiresConsultation: false
  },
  {
    id: 'natural-makeup',
    name: 'Natural Glam Makeup',
    category: 'makeup',
    subcategory: 'natural',
    description: 'Enhanced natural look that emphasizes your features while looking effortlessly beautiful.',
    duration: 45,
    price: 75,
    priceRange: { min: 55, max: 125 },
    benefits: ['Enhanced natural beauty', 'No-makeup makeup look', 'Suitable for daily', 'Photographs well'],
    whatToExpect: ['Minimal skin prep', 'Light foundation', 'Subtle enhancement', 'Tinted moisturizer or light coverage'],
    aftercareTips: ['Bring your usual products to show preferences', 'Consider your outfit'],
    suitableFor: ['Work events', 'Daily enhancement', 'Mature skin'],
    allergens: ['Various cosmetic ingredients']
  },
  {
    id: 'makeup-lesson',
    name: 'Makeup Lesson',
    category: 'makeup',
    subcategory: 'education',
    description: 'One-on-one tutorial teaching techniques and products for your specific features.',
    duration: 90,
    price: 125,
    priceRange: { min: 100, max: 200 },
    benefits: ['Learn techniques', 'Discover right products', 'Save money', 'Confidence in daily routine'],
    whatToExpect: ['Skills assessment', 'Product recommendations', 'Step-by-step demonstration', 'Practice time', 'Written guide'],
    aftercareTips: ['Practice at home', 'Keep a makeup journal', 'Start with basics', 'Build gradually'],
    suitableFor: ['Beginners', 'Those updating their routine', 'Mature makeup wearers']
  }
];

export const BROW_LASH_SERVICES: SalonService[] = [
  {
    id: 'brow-shaping',
    name: 'Brow Shaping',
    category: 'brow-lash',
    subcategory: 'brows',
    description: 'Expert brow shaping through waxing, threading, or tweezing to frame your face.',
    duration: 20,
    price: 20,
    priceRange: { min: 15, max: 35 },
    benefits: ['Defined shape', 'Frames face', 'Polished look', 'Opens eyes'],
    whatToExpect: ['Brow mapping', 'Discussion of shape', 'Hair removal', 'Tweezing', 'Finishing touch'],
    aftercareTips: ['Apply witch hazel to soothe', 'Avoid touching area', 'Regrowth is normal'],
    suitableFor: ['Everyone', 'Regular maintenance']
  },
  {
    id: 'brow-tint',
    name: 'Brow Tint',
    category: 'brow-lash',
    subcategory: 'brows',
    description: 'Semi-permanent color for brows that lasts 3-4 weeks, perfect for sparse or light brows.',
    duration: 25,
    price: 30,
    priceRange: { min: 20, max: 50 },
    benefits: ['Fuller brows', 'Saves time on makeup', 'Defines shape', 'Smudge-proof'],
    whatToExpect: ['Patch test (first time)', 'Color consultation', 'Application', 'Processing', 'Removal and styling'],
    aftercareTips: ['Avoid water for 24 hours', 'No retinoids near brows', 'Touch-ups as needed'],
    suitableFor: ['Light hair', 'Sparse brows', 'Those short on time'],
    allergens: ['PPD'],
    requiresConsultation: true
  },
  {
    id: 'lash-lift',
    name: 'Lash Lift & Tint',
    category: 'brow-lash',
    subcategory: 'lashes',
    description: 'Semi-permanent treatment that lifts, curls, and tints your natural lashes for a stunning effect.',
    duration: 60,
    price: 100,
    priceRange: { min: 80, max: 175 },
    benefits: ['Curled lashes for 6-8 weeks', 'No mascara needed', 'Opens eyes', 'Low maintenance'],
    whatToExpect: ['Consultation', 'Pad application', 'Lifting solution', 'Tinting', 'Setting'],
    aftercareTips: ['No water for 24 hours', 'Avoid mascara for 48 hours', 'No rubbing eyes', 'Results last 6-8 weeks'],
    suitableFor: ['Straight lashes', 'Those wanting natural enhancement'],
    allergens: ['Perming solutions', 'Tint'],
    requiresConsultation: true
  },
  {
    id: 'eyelash-extensions',
    name: 'Eyelash Extensions',
    category: 'brow-lash',
    subcategory: 'lashes',
    description: 'Individual synthetic or mink lashes applied to each natural lash for a full, dramatic look.',
    duration: 120,
    price: 150,
    priceRange: { min: 100, max: 300 },
    benefits: ['Fuller lashes', 'No mascara needed', 'Instant glamour', 'Lasts with fills'],
    whatToExpect: ['Consultation on style', 'Eye pad application', 'Individual lash application', 'Finishing'],
    aftercareTips: ['No water for 24 hours', 'No oil-based products', 'Brush daily', 'Schedule fills every 2-4 weeks'],
    suitableFor: ['Those wanting drama', 'Special occasions', 'Mascara haters'],
    allergens: ['Extension glue', 'Formaldehyde'],
    requiresConsultation: true
  }
];

export const ALL_SERVICES = [
  ...HAIR_SERVICES,
  ...NAIL_SERVICES,
  ...SKINCARE_SERVICES,
  ...BODY_SERVICES,
  ...MAKEUP_SERVICES,
  ...BROW_LASH_SERVICES
];

export const SKIN_TYPES: SkinType[] = [
  {
    id: 'normal',
    name: 'Normal Skin',
    characteristics: ['Balanced oil production', 'Few imperfections', 'Small pores', 'Smooth texture'],
    concerns: ['Maintaining balance', 'Environmental damage'],
    recommendedProducts: ['Gentle cleanser', 'Light moisturizer', 'Daily SPF'],
    avoidIngredients: []
  },
  {
    id: 'dry',
    name: 'Dry Skin',
    characteristics: ['Tight feeling', 'Dull appearance', 'Flaky patches', 'Rough texture'],
    concerns: ['Dehydration', 'Sensitivity', 'Premature aging'],
    recommendedProducts: ['Cream cleanser', 'Rich moisturizer', 'Hydrating serum', 'Face oil'],
    avoidIngredients: ['Alcohol', 'Fragrance', 'Harsh sulfates']
  },
  {
    id: 'oily',
    name: 'Oily Skin',
    characteristics: ['Shiny appearance', 'Enlarged pores', 'Blackheads', 'Prone to breakouts'],
    concerns: ['Acne', 'Excess shine', 'Clogged pores'],
    recommendedProducts: ['Foam cleanser', 'Salicylic acid', 'Light gel moisturizer', 'Mattifying primer'],
    avoidIngredients: ['Heavy oils', 'Coconut oil', 'Lanolin']
  },
  {
    id: 'combination',
    name: 'Combination Skin',
    characteristics: ['Oily T-zone', 'Dry cheeks', 'Enlarged pores on nose', 'Occasional breakouts'],
    concerns: ['Balancing different areas', 'Pore size', 'Uneven texture'],
    recommendedProducts: ['Gentle cleanser', 'Balancing toner', 'Lightweight moisturizer', 'Targeted treatments'],
    avoidIngredients: ['Heavy creams on T-zone', 'Very drying products']
  },
  {
    id: 'sensitive',
    name: 'Sensitive Skin',
    characteristics: ['Easily irritated', 'Redness', 'Burning sensation', 'Reactive to products'],
    concerns: ['Redness', 'Irritation', 'Allergic reactions'],
    recommendedProducts: ['Fragrance-free products', 'Calming serums', 'Gentle moisturizers', 'Mineral SPF'],
    avoidIngredients: ['Fragrance', 'Essential oils', 'Dyes', 'Alcohol', 'Retinoids']
  }
];

export const CONTRAINDICATIONS = [
  { name: 'Pregnancy', services: ['Chemical peels', 'Certain laser treatments', 'Some essential oils'] },
  { name: 'Active skin infections', services: ['Facials', 'Microdermabrasion', 'Chemical peels'] },
  { name: 'Recent sunburn', services: ['All facial treatments', 'Waxing'] },
  { name: 'Blood clotting disorders', services: ['Massage', 'Body wraps'] },
  { name: 'Diabetes (uncontrolled)', services: ['Foot treatments', 'Body treatments'] },
  { name: 'Recent surgery', services: ['Massage', 'Body wraps', 'Chemical peels'] },
  { name: 'Accutane use (within 6 months)', services: ['Facials', 'Chemical peels', 'Microdermabrasion', 'Waxing'] },
  { name: 'Epilepsy', services: ['LED therapy', 'Intense pulsed light'] },
  { name: 'Pacemaker', services: ['Radiofrequency treatments'] }
];
