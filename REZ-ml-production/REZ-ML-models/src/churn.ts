/**
 * REZ Churn Prediction Client
 *
 * ML-powered churn prediction with RFM fallback.
 */

interface ChurnPredictionInput {
  user_id?: string
  engagement_score: number
  recency_days: number
  frequency_score: number
  monetary_score: number
  tenure_days: number
  support_tickets?: number
  session_duration?: number
  app_opens?: number
  searches?: number
  bookings?: number
}

interface ChurnPredictionResult {
  churn_probability: number
  will_churn: boolean
  risk: 'high' | 'medium' | 'low'
  method?: 'ml' | 'rfm_fallback'
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:4080'

export class ChurnPredictor {
  private serviceUrl: string

  constructor(serviceUrl?: string) {
    this.serviceUrl = (serviceUrl || ML_SERVICE_URL).replace(/\/$/, '')
  }

  async predict(userData: ChurnPredictionInput): Promise<ChurnPredictionResult> {
    try {
      const response = await fetch(`${this.serviceUrl}/api/predict/churn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          return {
            churn_probability: result.prediction.churn_probability,
            will_churn: result.prediction.will_churn,
            risk: result.prediction.churn_risk,
            method: 'ml',
          }
        }
      }

      return this.fallbackPredict(userData)
    } catch {
      return this.fallbackPredict(userData)
    }
  }

  async predictBatch(usersData: ChurnPredictionInput[]): Promise<ChurnPredictionResult[]> {
    try {
      const response = await fetch(`${this.serviceUrl}/api/batch/churn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersData }),
        signal: AbortSignal.timeout(30000),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          return result.predictions.map((p) => ({
            churn_probability: p.churn_probability,
            will_churn: p.churn_probability > 0.5,
            risk: p.churn_risk,
            method: 'ml' as const,
          }))
        }
      }

      return usersData.map(u => this.fallbackPredict(u))
    } catch {
      return usersData.map(u => this.fallbackPredict(u))
    }
  }

  private fallbackPredict(userData: ChurnPredictionInput): ChurnPredictionResult {
    const recency = userData.recency_days
    const frequency = userData.frequency_score
    const engagement = userData.engagement_score
    const tenure = userData.tenure_days

    let score = 0

    if (recency > 60) score += 0.5
    else if (recency > 30) score += 0.3
    else if (recency > 14) score += 0.15

    if (frequency < 2) score += 0.25
    else if (frequency < 5) score += 0.1

    if (engagement < 30) score += 0.15
    else if (engagement < 60) score += 0.05

    if (tenure < 30) score += 0.1

    const probability = Math.min(1, Math.max(0, score))

    return {
      churn_probability: probability,
      will_churn: probability > 0.5,
      risk: probability > 0.5 ? 'high' : probability > 0.3 ? 'medium' : 'low',
      method: 'rfm_fallback',
    }
  }
}

export async function predict_churn(userData: ChurnPredictionInput): Promise<ChurnPredictionResult> {
  const predictor = new ChurnPredictor()
  return predictor.predict(userData)
}
