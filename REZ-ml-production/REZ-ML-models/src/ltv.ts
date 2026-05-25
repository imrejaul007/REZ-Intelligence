/**
 * REZ LTV Prediction Client
 *
 * ML-powered lifetime value prediction.
 */

interface LTVPredictionInput {
  user_id?: string
  current_spend: number
  monthly_spend: number
  order_count: number
  avg_order_value: number
  tenure_months: number
  category_diversity?: number
  app_adoption?: number
  engagement_score?: number
  recency_days?: number
  frequency_score?: number
}

interface LTVPredictionResult {
  ltv: number
  ltv_segment: 'premium' | 'high' | 'medium' | 'low'
  confidence: 'high' | 'medium' | 'low'
  currency: string
  method?: 'ml' | 'rfm_fallback'
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:4080'

export class LTVPredictor {
  private serviceUrl: string

  constructor(serviceUrl?: string) {
    this.serviceUrl = (serviceUrl || ML_SERVICE_URL).replace(/\/$/, '')
  }

  async predict(userData: LTVPredictionInput): Promise<LTVPredictionResult> {
    try {
      const response = await fetch(`${this.serviceUrl}/api/predict/ltv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          return {
            ltv: result.prediction.ltv,
            ltv_segment: result.prediction.ltv_segment,
            confidence: result.prediction.confidence,
            currency: result.prediction.currency || 'INR',
            method: 'ml',
          }
        }
      }

      return this.fallbackPredict(userData)
    } catch {
      return this.fallbackPredict(userData)
    }
  }

  async predictBatch(usersData: LTVPredictionInput[]): Promise<LTVPredictionResult[]> {
    try {
      const response = await fetch(`${this.serviceUrl}/api/batch/ltv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersData }),
        signal: AbortSignal.timeout(30000),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          return result.predictions.map((p) => ({
            ltv: p.ltv,
            ltv_segment: p.ltv_segment,
            confidence: p.confidence,
            currency: 'INR',
            method: 'ml' as const,
          }))
        }
      }

      return usersData.map(u => this.fallbackPredict(u))
    } catch {
      return usersData.map(u => this.fallbackPredict(u))
    }
  }

  private fallbackPredict(userData: LTVPredictionInput): LTVPredictionResult {
    // Simple RFM-based LTV estimation
    const monthlySpend = userData.monthly_spend || 0
    const tenureMonths = userData.tenure_months || 1
    const avgOrderValue = userData.avg_order_value || 0

    // Estimate LTV: monthly * 12 months * multiplier based on engagement
    const baseLTV = monthlySpend * 12
    const engagementMultiplier = (userData.engagement_score || 50) / 50
    const ltv = Math.round(baseLTV * Math.max(0.5, Math.min(2, engagementMultiplier)))

    let segment: LTVPredictionResult['ltv_segment'] = 'medium'
    if (ltv >= 50000) segment = 'premium'
    else if (ltv >= 25000) segment = 'high'
    else if (ltv >= 10000) segment = 'medium'
    else segment = 'low'

    return {
      ltv,
      ltv_segment: segment,
      confidence: 'medium',
      currency: 'INR',
      method: 'rfm_fallback',
    }
  }
}

export async function predict_ltv(userData: LTVPredictionInput): Promise<LTVPredictionResult> {
  const predictor = new LTVPredictor()
  return predictor.predict(userData)
}
