/**
 * ReZ Mind Pharmacy Service - Knowledge Base
 * Pharmacy industry domain knowledge for AI operations
 */

// ==================== Drug Categories ====================
export enum DrugCategory {
  ANALGESIC = 'ANALGESIC',
  ANTIBIOTIC = 'ANTIBIOTIC',
  ANTIVIRAL = 'ANTIVIRAL',
  ANTIFUNGAL = 'ANTIFUNGAL',
  ANTIHISTAMINE = 'ANTIHISTAMINE',
  ANTIHYPERTENSIVE = 'ANTIHYPERTENSIVE',
  DIABETIC = 'DIABETIC',
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  RESPIRATORY = 'RESPIRATORY',
  GASTROINTESTINAL = 'GASTROINTESTINAL',
  NEUROLOGICAL = 'NEUROLOGICAL',
  PSYCHIATRIC = 'PSYCHIATRIC',
  ONCOLOGY = 'ONCOLOGY',
  OPHTHALMIC = 'OPHTHALMIC',
  DERMATOLOGICAL = 'DERMATOLOGICAL',
  HORMONAL = 'HORMONAL',
  VACCINE = 'VACCINE',
  OTHER = 'OTHER',
}

// ==================== Drug Schedule Classifications ====================
export enum DrugSchedule {
  SCHEDULE_I = 'SCHEDULE_I',
  SCHEDULE_II = 'SCHEDULE_II',
  SCHEDULE_III = 'SCHEDULE_III',
  SCHEDULE_IV = 'SCHEDULE_IV',
  SCHEDULE_V = 'SCHEDULE_V',
  NON_CONTROLLED = 'NON_CONTROLLED',
}

export const SCHEDULE_RESTRICTIONS: Record<DrugSchedule, {
  description: string;
  refills: number;
  idRequired: boolean;
  specialHandling: string[];
}> = {
  [DrugSchedule.SCHEDULE_I]: {
    description: 'No accepted medical use, high abuse potential',
    refills: 0,
    idRequired: true,
    specialHandling: ['Secure storage required', 'Detailed records mandatory', 'No refills allowed'],
  },
  [DrugSchedule.SCHEDULE_II]: {
    description: 'High abuse potential, severe dependence',
    refills: 0,
    idRequired: true,
    specialHandling: ['No verbal prescriptions', 'Special prescription form required', 'Dispense within strict timelines'],
  },
  [DrugSchedule.SCHEDULE_III]: {
    description: 'Moderate abuse potential',
    refills: 5,
    idRequired: true,
    specialHandling: ['Refills valid for 6 months', 'Physical prescription required'],
  },
  [DrugSchedule.SCHEDULE_IV]: {
    description: 'Low abuse potential',
    refills: 5,
    idRequired: false,
    specialHandling: ['Refills valid for 1 year', 'State-specific limits apply'],
  },
  [DrugSchedule.SCHEDULE_V]: {
    description: 'Lowest abuse potential',
    refills: 'unlimited' as unknown as number,
    idRequired: false,
    specialHandling: ['Age restrictions may apply', 'State-specific regulations'],
  },
  [DrugSchedule.NON_CONTROLLED]: {
    description: 'No controlled substance classification',
    refills: 12,
    idRequired: false,
    specialHandling: ['Standard dispensing rules apply'],
  },
};

// ==================== Drug Interactions Database ====================
export interface DrugInteractionEntry {
  drug1: string;
  drug2: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  description: string;
  mechanism: string;
  recommendation: string;
  clinicalEffects: string[];
}

export const COMMON_DRUG_INTERACTIONS: DrugInteractionEntry[] = [
  {
    drug1: 'warfarin',
    drug2: 'aspirin',
    severity: 'SEVERE',
    description: 'Increased bleeding risk when combined',
    mechanism: 'Additive anticoagulant effects',
    recommendation: 'Avoid combination unless clinically necessary. Monitor INR closely.',
    clinicalEffects: ['Increased bleeding risk', 'Prolonged clotting time', 'GI bleeding'],
  },
  {
    drug1: 'warfarin',
    drug2: 'ibuprofen',
    severity: 'SEVERE',
    description: 'Significantly increased bleeding risk',
    mechanism: 'NSAIDs inhibit platelet function and GI protection',
    recommendation: 'Use acetaminophen for pain relief. If NSAID required, use lowest dose for shortest duration.',
    clinicalEffects: ['GI hemorrhage', 'Intracranial bleeding', 'Hematuria'],
  },
  {
    drug1: 'metformin',
    drug2: 'alcohol',
    severity: 'MODERATE',
    description: 'Increased risk of lactic acidosis',
    mechanism: 'Alcohol potentiates metformin effects on lactate metabolism',
    recommendation: 'Limit alcohol consumption. Monitor for signs of lactic acidosis.',
    clinicalEffects: ['Lactic acidosis', 'Hypoglycemia', 'Vitamin B12 deficiency'],
  },
  {
    drug1: 'lisinopril',
    drug2: 'potassium',
    severity: 'MODERATE',
    description: 'Risk of hyperkalemia',
    mechanism: 'ACE inhibitors reduce potassium excretion',
    recommendation: 'Monitor serum potassium regularly. Avoid potassium supplements unless prescribed.',
    clinicalEffects: ['Hyperkalemia', 'Cardiac arrhythmias', 'Muscle weakness'],
  },
  {
    drug1: 'simvastatin',
    drug2: 'grapefruit',
    severity: 'MODERATE',
    description: 'Increased statin exposure and risk of myopathy',
    mechanism: 'Grapefruit inhibits CYP3A4 metabolism of statins',
    recommendation: 'Avoid grapefruit and grapefruit juice. Consider alternative statin if compliance is an issue.',
    clinicalEffects: ['Rhabdomyolysis', 'Myopathy', 'Increased CK levels'],
  },
  {
    drug1: 'ciprofloxacin',
    drug2: 'antacids',
    severity: 'MILD',
    description: 'Reduced antibiotic absorption',
    mechanism: 'Metal cations chelate fluoroquinolones',
    recommendation: 'Separate administration by 2 hours before or 6 hours after antacids.',
    clinicalEffects: ['Reduced bioavailability', 'Suboptimal dosing', 'Treatment failure'],
  },
  {
    drug1: 'levothyroxine',
    drug2: 'calcium',
    severity: 'MILD',
    description: 'Reduced levothyroxine absorption',
    mechanism: 'Calcium binds levothyroxine in GI tract',
    recommendation: 'Take levothyroxine 4 hours apart from calcium supplements.',
    clinicalEffects: ['Reduced T4 absorption', 'Suboptimal thyroid control', 'Hypothyroid symptoms'],
  },
  {
    drug1: 'amlodipine',
    drug2: 'simvastatin',
    severity: 'MODERATE',
    description: 'Increased simvastatin levels',
    mechanism: 'Amlodipine inhibits CYP3A4',
    recommendation: 'Limit simvastatin dose to 20mg daily when used with amlodipine.',
    clinicalEffects: ['Increased statin exposure', 'Myopathy risk', 'Rhabdomyolysis'],
  },
  {
    drug1: 'sertraline',
    drug2: 'tramadol',
    severity: 'SEVERE',
    description: 'Risk of serotonin syndrome',
    mechanism: 'Both drugs increase serotonin activity',
    recommendation: 'Avoid combination. If necessary, use lowest doses and monitor closely for serotonin syndrome.',
    clinicalEffects: ['Serotonin syndrome', 'Seizures', 'Agitation', 'Hyperthermia'],
  },
  {
    drug1: 'fluconazole',
    drug2: 'quinidine',
    severity: 'SEVERE',
    description: 'Cardiac toxicity risk',
    mechanism: 'QT prolongation additive effects',
    recommendation: 'Avoid combination. Use alternative antifungal if possible.',
    clinicalEffects: ['QT prolongation', 'Torsades de pointes', 'Cardiac arrest'],
  },
  {
    drug1: 'digoxin',
    drug2: 'amiodarone',
    severity: 'SEVERE',
    description: 'Increased digoxin levels',
    mechanism: 'Amiodarone inhibits P-glycoprotein and reduces digoxin clearance',
    recommendation: 'Reduce digoxin dose by 50% when starting amiodarone. Monitor levels.',
    clinicalEffects: ['Digoxin toxicity', 'Bradycardia', 'Nausea', 'Visual disturbances'],
  },
  {
    drug1: 'lithium',
    drug2: 'ibuprofen',
    severity: 'MODERATE',
    description: 'Increased lithium levels',
    mechanism: 'NSAIDs reduce renal lithium clearance',
    recommendation: 'Monitor lithium levels closely. Consider dose adjustment. Use lowest NSAID dose.',
    clinicalEffects: ['Lithium toxicity', 'Tremor', 'Confusion', 'Seizures'],
  },
  {
    drug1: 'methotrexate',
    drug2: 'NSAIDs',
    severity: 'SEVERE',
    description: 'Severe methotrexate toxicity',
    mechanism: 'NSAIDs reduce methotrexate clearance',
    recommendation: 'Avoid NSAIDs with high-dose methotrexate. If low-dose, monitor closely.',
    clinicalEffects: ['Bone marrow suppression', 'Hepatotoxicity', 'Nephrotoxicity'],
  },
  {
    drug1: 'clopidogrel',
    drug2: 'omeprazole',
    severity: 'MODERATE',
    description: 'Reduced antiplatelet effect',
    mechanism: 'Omeprazole inhibits CYP2C19 activation of clopidogrel',
    recommendation: 'Consider alternative PPI (pantoprazole). Monitor for cardiovascular events.',
    clinicalEffects: ['Reduced antiplatelet effect', 'Stent thrombosis', 'ACS recurrence'],
  },
  {
    drug1: 'spironolactone',
    drug2: 'potassium',
    severity: 'SEVERE',
    description: 'Life-threatening hyperkalemia',
    mechanism: 'Both cause potassium retention',
    recommendation: 'Avoid potassium supplements entirely. Monitor potassium levels weekly.',
    clinicalEffects: ['Hyperkalemia', 'Cardiac arrhythmias', 'Death'],
  },
];

// ==================== Dosage Guidelines ====================
export interface DosageGuideline {
  drug: string;
  standardDose: string;
  weightBased: { minWeight: number; maxWeight: number; dose: string }[];
  ageBased: { minAge: number; maxAge: number; dose: string }[];
  renalImpairment: { gfrRange: string; adjustment: string }[];
  maxDose: string;
  contraindications: string[];
}

export const DOSAGE_GUIDELINES: DosageGuideline[] = [
  {
    drug: 'acetaminophen',
    standardDose: '500-1000mg every 4-6 hours',
    weightBased: [
      { minWeight: 0, maxWeight: 10, dose: '10-15mg/kg' },
      { minWeight: 10, maxWeight: 50, dose: '10-15mg/kg' },
      { minWeight: 50, maxWeight: 999, dose: '500-1000mg' },
    ],
    ageBased: [
      { minAge: 0, maxAge: 3, dose: 'Based on weight' },
      { minAge: 3, maxAge: 12, dose: '10-15mg/kg' },
      { minAge: 12, maxAge: 999, dose: '500-1000mg' },
    ],
    renalImpairment: [
      { gfrRange: '>50', adjustment: 'Standard dosing' },
      { gfrRange: '30-50', adjustment: 'Standard dosing' },
      { gfrRange: '<30', adjustment: 'Reduce to 500mg every 6 hours' },
    ],
    maxDose: '4000mg/day',
    contraindications: ['Severe liver disease', 'Active alcohol abuse'],
  },
  {
    drug: 'ibuprofen',
    standardDose: '200-400mg every 4-6 hours',
    weightBased: [
      { minWeight: 0, maxWeight: 10, dose: '5-10mg/kg' },
      { minWeight: 10, maxWeight: 999, dose: '200-400mg' },
    ],
    ageBased: [
      { minAge: 0, maxAge: 6, dose: '5-10mg/kg' },
      { minAge: 6, maxAge: 12, dose: '200mg' },
      { minAge: 12, maxAge: 999, dose: '200-400mg' },
    ],
    renalImpairment: [
      { gfrRange: '>50', adjustment: 'Standard dosing' },
      { gfrRange: '30-50', adjustment: 'Use lowest effective dose' },
      { gfrRange: '<30', adjustment: 'Avoid if possible' },
    ],
    maxDose: '2400mg/day',
    contraindications: ['Active GI bleeding', 'Severe renal impairment', 'Third trimester pregnancy'],
  },
  {
    drug: 'amoxicillin',
    standardDose: '250-500mg every 8 hours',
    weightBased: [
      { minWeight: 0, maxWeight: 9, dose: '20-40mg/kg/day divided' },
      { minWeight: 9, maxWeight: 40, dose: '250mg every 8 hours' },
      { minWeight: 40, maxWeight: 999, dose: '500mg every 8 hours' },
    ],
    ageBased: [
      { minAge: 0, maxAge: 3, dose: 'Based on weight' },
      { minAge: 3, maxAge: 12, dose: '20-40mg/kg/day' },
      { minAge: 12, maxAge: 999, dose: '250-500mg' },
    ],
    renalImpairment: [
      { gfrRange: '>50', adjustment: 'Standard dosing' },
      { gfrRange: '10-50', adjustment: 'Standard dosing' },
      { gfrRange: '<10', adjustment: 'Reduce frequency to every 12 hours' },
    ],
    maxDose: '3000mg/day',
    contraindications: ['Penicillin allergy', 'Infectious mononucleosis (rash risk)'],
  },
];

// ==================== Expiry Patterns ====================
export interface ExpiryPattern {
  storageCondition: string;
  drugTypes: string[];
  baseShelfLife: number; // months
  factors: string[];
  disposalInstructions: string;
}

export const EXPIRY_PATTERNS: ExpiryPattern[] = [
  {
    storageCondition: 'room_temperature',
    drugTypes: ['tablets', 'capsules', 'liquids (non-refrigerated)'],
    baseShelfLife: 12,
    factors: ['Humidity', 'Light exposure', 'Temperature fluctuations'],
    disposalInstructions: 'Dispose of expired medications in household trash (mix with coffee grounds). Do not flush.',
  },
  {
    storageCondition: 'refrigerated',
    drugTypes: ['insulin', 'antibiotic suspensions', 'eye drops (opened)', 'probiotics'],
    baseShelfLife: 6,
    factors: ['Temperature excursions', 'Light exposure', 'Shelf position'],
    disposalInstructions: 'Return to pharmacy for proper disposal. Do not use if left unrefrigerated.',
  },
  {
    storageCondition: 'frozen',
    drugTypes: ['certain vaccines', 'biologics'],
    baseShelfLife: 24,
    factors: ['Freeze-thaw cycles', 'Storage duration before freezing'],
    disposalInstructions: 'Return to pharmacy for proper disposal.',
  },
  {
    storageCondition: 'controlled_room',
    drugTypes: ['hormones', 'antibiotics', 'solutions'],
    baseShelfLife: 18,
    factors: ['15-25°C maintained', '40-60% humidity'],
    disposalInstructions: 'Return to pharmacy if storage conditions not maintained.',
  },
];

// ==================== Common Drug Classes ====================
export const DRUG_CLASSIFICATIONS: Record<string, {
  category: DrugCategory;
  mechanism: string;
  commonDrugs: string[];
  sideEffects: string[];
  monitoringParams: string[];
}> = {
  ACE_INHIBITORS: {
    category: DrugCategory.ANTIHYPERTENSIVE,
    mechanism: 'Inhibits angiotensin-converting enzyme',
    commonDrugs: ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
    sideEffects: ['Cough', 'Hyperkalemia', 'Angioedema', 'Hypotension'],
    monitoringParams: ['Blood pressure', 'Serum potassium', 'Serum creatinine', 'Cough'],
  },
  STATINS: {
    category: DrugCategory.CARDIOVASCULAR,
    mechanism: 'HMG-CoA reductase inhibitor',
    commonDrugs: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin'],
    sideEffects: ['Myopathy', 'Elevated LFTs', 'Rhabdomyolysis', 'Diabetes risk'],
    monitoringParams: ['Lipid panel', 'CPK levels', 'Liver function tests', 'Muscle symptoms'],
  },
  PPIs: {
    category: DrugCategory.GASTROINTESTINAL,
    mechanism: 'Proton pump inhibitor',
    commonDrugs: ['omeprazole', 'pantoprazole', 'esomeprazole', 'lansoprazole'],
    sideEffects: ['Hypomagnesemia', 'B12 deficiency', 'C. diff infection', 'Fracture risk'],
    monitoringParams: ['Magnesium levels', 'B12 levels', 'Bone density', 'Infection signs'],
  },
  SSRIs: {
    category: DrugCategory.PSYCHIATRIC,
    mechanism: 'Selective serotonin reuptake inhibitor',
    commonDrugs: ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram'],
    sideEffects: ['Nausea', 'Sexual dysfunction', 'Insomnia', 'Serotonin syndrome'],
    monitoringParams: ['Mood changes', 'Suicidal ideation (under 25)', 'Serotonin symptoms', 'Sexual function'],
  },
  BETA_BLOCKERS: {
    category: DrugCategory.CARDIOVASCULAR,
    mechanism: 'Beta-adrenergic receptor antagonist',
    commonDrugs: ['metoprolol', 'atenolol', 'propranolol', 'carvedilol'],
    sideEffects: ['Bradycardia', 'Fatigue', 'Bronchospasm', 'Cold extremities'],
    monitoringParams: ['Heart rate', 'Blood pressure', 'Respiratory symptoms', 'Fatigue'],
  },
  THIAZIDES: {
    category: DrugCategory.ANTIHYPERTENSIVE,
    mechanism: 'Inhibit sodium reabsorption in distal tubule',
    commonDrugs: ['hydrochlorothiazide', 'chlorthalidone', 'indapamide'],
    sideEffects: ['Hypokalemia', 'Hyperuricemia', 'Hyperglycemia', 'Hyponatremia'],
    monitoringParams: ['Electrolytes', 'Uric acid', 'Blood glucose', 'Blood pressure'],
  },
};

// ==================== Refill Prediction Factors ====================
export const REFILL_PREDICTION_FACTORS = {
  chronic_medications: {
    condition: 'Chronic disease management',
    refill_lead_days: 7,
    urgency: 'high',
  },
  antibiotics: {
    condition: 'Short-term antibiotic courses',
    refill_lead_days: 14,
    urgency: 'low',
  },
  controlled_substances: {
    condition: 'Schedule II-V medications',
    refill_lead_days: 3,
    urgency: 'high',
    notes: 'May require advance notice for refill authorization',
  },
  seasonal: {
    condition: 'Seasonal medications (allergies, flu)',
    refill_lead_days: 14,
    urgency: 'medium',
  },
};

// ==================== Inventory Optimization Rules ====================
export const INVENTORY_RULES = {
  reorder_points: {
    critical: { days_supply: 7, urgency: 'critical' },
    high: { days_supply: 14, urgency: 'high' },
    medium: { days_supply: 21, urgency: 'medium' },
    low: { days_supply: 30, urgency: 'low' },
  },
  expiry_thresholds: {
    short_dated: { days_before_expiry: 30, action: 'mark_down' },
    expiring_soon: { days_before_expiry: 60, action: 'promote' },
    at_risk: { days_before_expiry: 90, action: 'return_to_supplier' },
  },
  stock_optimization: {
    fast_movers: { turnover_days: 14, safety_stock_days: 7 },
    medium_movers: { turnover_days: 30, safety_stock_days: 14 },
    slow_movers: { turnover_days: 60, safety_stock_days: 21 },
  },
};