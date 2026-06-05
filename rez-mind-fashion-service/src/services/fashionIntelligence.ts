import { FashionMindSession } from '../models';
import logger from '../utils/logger';

export interface ConsultationResult { sessionId: string; message: string; suggestions?: string[]; timestamp: Date; }

class FashionIntelligenceService {
  async consult(userId: string, message: string, context?: { customerId?: string; productId?: string; merchantId?: string }): Promise<ConsultationResult> {
    let session = await FashionMindSession.findOrCreate(userId, context as any);
    if (context?.sessionId && context.sessionId !== session.sessionId) { const existing = await FashionMindSession.findOne({ sessionId: context.sessionId }); if (existing) session = existing; }
    await session.addMessage('user', message);
    const response = await this.generateResponse(message, context);
    await session.addMessage('assistant', response.message);
    logger.info('Fashion consultation processed', { sessionId: session.sessionId, intent: this.detectIntent(message) });
    return { sessionId: session.sessionId, message: response.message, suggestions: response.suggestions, timestamp: new Date() };
  }

  async getSessionHistory(sessionId: string, limit?: number) { const session = await FashionMindSession.findOne({ sessionId }); return session ? session.getHistory(limit) : null; }

  async completeSession(sessionId: string) { const session = await FashionMindSession.findOne({ sessionId }); if (session) { session.status = 'completed'; await session.save(); } }

  private detectIntent(msg: string): string { const l = msg.toLowerCase(); if (l.includes('trend') || l.includes('style') || l.includes('fashion')) return 'trend_inquiry'; if (l.includes('recommend') || l.includes('suggest') || l.includes('match')) return 'recommendation_inquiry'; if (l.includes('inventory') || l.includes('stock') || l.includes('reorder')) return 'inventory_inquiry'; return 'general_inquiry'; }

  private async generateResponse(message: string, _context?: { customerId?: string; productId?: string }) {
    const intent = this.detectIntent(message);
    switch (intent) {
      case 'trend_inquiry': return { message: `Fashion trends are evolving rapidly! Current key trends include:\n\n• **Sustainable Fashion**: Growing demand for eco-friendly materials\n• **Comfort Wear**: Athleisure and loungewear continue dominance\n• **Ethnic Fusion**: Modern takes on traditional wear\n• **Gender-Neutral**: Inclusive fashion gaining traction\n• **Minimalist**: Clean lines and neutral palettes\n\nTo get specific trend analysis for your inventory, use our /api/v1/trends/analyze endpoint with category and season parameters.`, suggestions: ['Get trend analysis', 'Seasonal predictions', 'Category-specific trends'] };
      case 'recommendation_inquiry': return { message: `For personalized style recommendations, I can help match customers to products based on:\n\n• Body type and preferences\n• Color palette matching\n• Budget considerations\n• Occasion requirements\n• Style history\n\nUse /api/v1/style/match with customer data to get AI-powered recommendations.`, suggestions: ['Match customer to products', 'Create outfits', 'Cross-sell suggestions'] };
      case 'inventory_inquiry': return { message: `Inventory optimization helps maximize sales and minimize dead stock. I analyze:\n\n• Sales velocity patterns\n• Seasonal demand forecasting\n• Size distribution optimization\n• Reorder timing recommendations\n• Discount strategies for slow movers\n\nUse /api/v1/inventory/optimize to get actionable recommendations.`, suggestions: ['Get inventory optimization', 'Demand forecasting', 'Dead stock analysis'] };
      default: return { message: `Hello! I'm ReZ Fashion Mind, your AI assistant for fashion business intelligence.\n\nI can help with:\n\n👗 **Trend Analysis**: Current and upcoming fashion trends\n🎯 **Style Matching**: Customer to product matching\n📦 **Inventory Optimization**: Demand forecasting and reordering\n📊 **Size Forecasting**: Predict size demand patterns\n🛒 **Cross-sell**: Product recommendations and outfits\n\nHow can I assist your fashion business today?`, suggestions: ['Trend analysis', 'Style matching', 'Inventory optimization'] };
    }
  }
}

export const fashionIntelligenceService = new FashionIntelligenceService();
export default fashionIntelligenceService;