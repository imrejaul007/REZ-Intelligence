import { logger } from '../utils/logger';
import { COMMON_DRUG_INTERACTIONS, DrugInteractionEntry } from '../config/knowledge';
import { DrugInteraction, InteractionSeverity } from '../types';

export class InteractionCheckerService {
  /**
   * Check drug interactions between multiple drugs
   */
  async checkDrugInteractions(drugIds: string[]): Promise<DrugInteraction[]> {
    logger.info('Checking drug interactions', { drugIds });

    if (drugIds.length < 2) {
      return [];
    }

    const interactions: DrugInteraction[] = [];

    // Check all pairs of drugs
    for (let i = 0; i < drugIds.length; i++) {
      for (let j = i + 1; j < drugIds.length; j++) {
        const drug1 = drugIds[i];
        const drug2 = drugIds[j];

        const interaction = await this.findInteraction(drug1, drug2);
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    logger.info('Drug interaction check completed', {
      drugIds,
      interactionCount: interactions.length,
    });

    return interactions;
  }

  /**
   * Check interaction between two specific drugs
   */
  async checkDrugInteraction(drug1: string, drug2: string): Promise<DrugInteraction | null> {
    return this.findInteraction(drug1, drug2);
  }

  /**
   * Find interaction between two drugs
   */
  private async findInteraction(drug1: string, drug2: string): Promise<DrugInteraction | null> {
    // Normalize drug names for comparison
    const normalizedDrug1 = drug1.toLowerCase().trim();
    const normalizedDrug2 = drug2.toLowerCase().trim();

    // Check against known interactions database
    const knownInteraction = COMMON_DRUG_INTERACTIONS.find(
      (interaction: DrugInteractionEntry) => {
        const knownDrug1 = interaction.drug1.toLowerCase();
        const knownDrug2 = interaction.drug2.toLowerCase();
        return (
          (normalizedDrug1.includes(knownDrug1) || knownDrug1.includes(normalizedDrug1)) &&
          (normalizedDrug2.includes(knownDrug2) || knownDrug2.includes(normalizedDrug2))
        ) || (
          (normalizedDrug1.includes(knownDrug2) || knownDrug2.includes(normalizedDrug1)) &&
          (normalizedDrug2.includes(knownDrug1) || knownDrug1.includes(normalizedDrug2))
        );
      }
    );

    if (knownInteraction) {
      return {
        drug1: knownInteraction.drug1,
        drug2: knownInteraction.drug2,
        severity: knownInteraction.severity as InteractionSeverity,
        description: knownInteraction.description,
        mechanism: knownInteraction.mechanism,
        recommendation: knownInteraction.recommendation,
        clinicalEffects: knownInteraction.clinicalEffects,
        confidence: 0.95,
      };
    }

    // Check for class-level interactions
    const classInteraction = this.checkClassLevelInteraction(normalizedDrug1, normalizedDrug2);
    if (classInteraction) {
      return classInteraction;
    }

    // Check for drug-food interactions
    const foodInteraction = this.checkFoodInteraction(normalizedDrug1, normalizedDrug2);
    if (foodInteraction) {
      return foodInteraction;
    }

    return null;
  }

  /**
   * Check for class-level interactions (e.g., all statins + fibrates)
   */
  private checkClassLevelInteraction(drug1: string, drug2: string): DrugInteraction | null {
    // Statins + Fibrates interaction
    if (this.isStatin(drug1) && this.isFibrate(drug2)) {
      return {
        drug1: 'Statins',
        drug2: 'Fibrates',
        severity: InteractionSeverity.SEVERE,
        description: 'Increased risk of myopathy and rhabdomyolysis',
        mechanism: 'Additive effect on muscle toxicity',
        recommendation: 'If combination necessary, use low-dose statin with fenofibrate. Monitor CK levels weekly.',
        clinicalEffects: ['Myopathy', 'Rhabdomyolysis', 'Acute kidney injury'],
        confidence: 0.85,
      };
    }

    // ACE Inhibitors + Potassium-sparing diuretics
    if (this.isACEInhibitor(drug1) && this.isPotassiumSparing(drug2)) {
      return {
        drug1: 'ACE Inhibitors',
        drug2: 'Potassium-sparing diuretics',
        severity: InteractionSeverity.MODERATE,
        description: 'Risk of hyperkalemia',
        mechanism: 'Both classes reduce potassium excretion',
        recommendation: 'Monitor serum potassium closely. Consider alternative combination.',
        clinicalEffects: ['Hyperkalemia', 'Cardiac arrhythmias'],
        confidence: 0.80,
      };
    }

    // SSRIs + MAOIs
    if (this.isSSRI(drug1) && this.isMAOI(drug2)) {
      return {
        drug1: 'SSRIs',
        drug2: 'MAOIs',
        severity: InteractionSeverity.SEVERE,
        description: 'Risk of serotonin syndrome',
        mechanism: 'Severe serotonin excess',
        recommendation: 'CONTRAINDICATED. Allow 2-week washout period between medications.',
        clinicalEffects: ['Serotonin syndrome', 'Hypertensive crisis', 'Death'],
        confidence: 0.90,
      };
    }

    // NSAIDs + Anticoagulants
    if (this.isNSAID(drug1) && this.isAnticoagulant(drug2)) {
      return {
        drug1: 'NSAIDs',
        drug2: 'Anticoagulants',
        severity: InteractionSeverity.SEVERE,
        description: 'Significantly increased bleeding risk',
        mechanism: 'NSAIDs inhibit platelet function; anticoagulants reduce clotting',
        recommendation: 'Avoid combination when possible. If necessary, use lowest NSAID dose for shortest duration.',
        clinicalEffects: ['GI hemorrhage', 'Intracranial bleeding', 'Hematuria'],
        confidence: 0.88,
      };
    }

    // Two NSAIDs together
    if (this.isNSAID(drug1) && this.isNSAID(drug2)) {
      return {
        drug1: 'NSAID 1',
        drug2: 'NSAID 2',
        severity: InteractionSeverity.MODERATE,
        description: 'Increased risk of GI bleeding and renal toxicity without added benefit',
        mechanism: 'Additive COX inhibition',
        recommendation: 'Avoid combination. Use single NSAID at appropriate dose.',
        clinicalEffects: ['GI bleeding', 'Peptic ulcer', 'Renal impairment'],
        confidence: 0.82,
      };
    }

    return null;
  }

  /**
   * Check for drug-food interactions
   */
  private checkFoodInteraction(drug: string, substance: string): DrugInteraction | null {
    // Warfarin + Vitamin K foods
    if (this.isWarfarin(drug) && substance.includes('vitamin')) {
      return {
        drug1: 'Warfarin',
        drug2: 'Vitamin K',
        severity: InteractionSeverity.MODERATE,
        description: 'Variable anticoagulant effect depending on Vitamin K intake',
        mechanism: 'Vitamin K reverses warfarin effect',
        recommendation: 'Maintain consistent Vitamin K intake. Avoid sudden dietary changes.',
        clinicalEffects: ['Unstable INR', 'Thrombosis risk', 'Bleeding risk'],
        confidence: 0.85,
      };
    }

    // MAOIs + Tyramine (aged foods)
    if (this.isMAOI(drug) && (substance.includes('tyramine') || this.containsTyramineFood(substance))) {
      return {
        drug1: 'MAOIs',
        drug2: 'Tyramine-rich foods',
        severity: InteractionSeverity.SEVERE,
        description: 'Hypertensive crisis risk',
        mechanism: 'Tyramine accumulation leads to norepinephrine release',
        recommendation: 'Strict tyramine-free diet required. Avoid aged cheeses, fermented foods, etc.',
        clinicalEffects: ['Hypertensive crisis', 'Stroke', 'Death'],
        confidence: 0.90,
      };
    }

    return null;
  }

  /**
   * Get interaction severity for a drug pair
   */
  getInteractionSeverity(drugPair: { drug1: string; drug2: string }): InteractionSeverity {
    const interaction = COMMON_DRUG_INTERACTIONS.find(
      i =>
        (i.drug1 === drugPair.drug1 && i.drug2 === drugPair.drug2) ||
        (i.drug1 === drugPair.drug2 && i.drug2 === drugPair.drug1)
    );

    return interaction?.severity as InteractionSeverity || InteractionSeverity.NONE;
  }

  // Helper functions to check drug classes
  private isStatin(drug: string): boolean {
    const statins = ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin', 'pitavastatin', 'fluvastatin'];
    return statins.some(s => drug.includes(s));
  }

  private isFibrate(drug: string): boolean {
    const fibrates = ['fenofibrate', 'gemfibrozil', 'clofibrate', 'bezafibrate'];
    return fibrates.some(f => drug.includes(f));
  }

  private isACEInhibitor(drug: string): boolean {
    const aceInhibitors = ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'benazepril', 'quinapril', 'fosinopril'];
    return aceInhibitors.some(a => drug.includes(a));
  }

  private isPotassiumSparing(drug: string): boolean {
    const potassiumSparing = ['spironolactone', 'triamterene', 'amiloride', 'eplerenone'];
    return potassiumSparing.some(p => drug.includes(p));
  }

  private isSSRI(drug: string): boolean {
    const ssris = ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'];
    return ssris.some(s => drug.includes(s));
  }

  private isMAOI(drug: string): boolean {
    const maois = ['phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline'];
    return maois.some(m => drug.includes(m));
  }

  private isNSAID(drug: string): boolean {
    const nsaids = ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'celecoxib', 'meloxicam', 'indomethacin'];
    return nsaids.some(n => drug.includes(n));
  }

  private isAnticoagulant(drug: string): boolean {
    const anticoagulants = ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'heparin'];
    return anticoagulants.some(a => drug.includes(a));
  }

  private isWarfarin(drug: string): boolean {
    return drug.includes('warfarin');
  }

  private containsTyramineFood(substance: string): boolean {
    const tyramineFoods = ['cheese', 'wine', 'beer', 'yeast', 'soy', 'fermented', 'aged'];
    return tyramineFoods.some(f => substance.includes(f));
  }
}

export const interactionChecker = new InteractionCheckerService();