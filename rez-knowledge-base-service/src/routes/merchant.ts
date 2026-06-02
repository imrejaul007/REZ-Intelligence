import { Router } from 'express';
import {
  getAllMerchants,
  getMerchantById,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getFAQs,
  addFAQ,
  updateFAQ,
  deleteFAQ,
  searchKnowledge,
  importData,
  exportData,
  // Sales Strategies
  getSalesStrategies,
  addComplimentaryOffer,
  addDiscount,
  addPromotion,
  // Policies
  getPolicies,
  updatePolicies,
  updateMerchantPolicies,
  getPoliciesByType,
  // AI Recommendations
  getSalesRecommendations
} from '../controllers/merchantController';

const router = Router();

// ====== MERCHANTS ======
router.get('/', getAllMerchants);
router.post('/', createMerchant);
router.get('/:merchantId', getMerchantById);
router.put('/:merchantId', updateMerchant);
router.delete('/:merchantId', deleteMerchant);

// ====== MENU ======
router.post('/:merchantId/menu', addMenuItem);
router.put('/:merchantId/menu/:itemId', updateMenuItem);
router.delete('/:merchantId/menu/:itemId', deleteMenuItem);

// ====== FAQs ======
router.get('/:merchantId/faq', getFAQs);
router.post('/:merchantId/faq', addFAQ);
router.put('/:merchantId/faq/:faqId', updateFAQ);
router.delete('/:merchantId/faq/:faqId', deleteFAQ);

// ====== SEARCH ======
router.get('/:merchantId/search', searchKnowledge);

// ====== SALES STRATEGIES ======
// Get all sales strategies (complimentary offers, discounts, promotions)
router.get('/:merchantId/sales-strategies', getSalesStrategies);

// Add complimentary offer (e.g., free drink after 7pm)
router.post('/:merchantId/sales-strategies/complimentary', addComplimentaryOffer);

// Add discount (e.g., 10% off on orders above 500)
router.post('/:merchantId/sales-strategies/discounts', addDiscount);

// Add promotion (e.g., happy hour 5-7pm)
router.post('/:merchantId/sales-strategies/promotions', addPromotion);

// ====== POLICIES ======
// Get all policies
router.get('/:merchantId/policies', getPolicies);

// Update all policies
router.put('/:merchantId/policies', updatePolicies);

// Update type-specific policies (restaurant, hotel, retail, etc.)
router.patch('/:merchantId/policies/type', updateMerchantPolicies);

// Get policies by merchant type (for benchmarking)
router.get('/policies/by-type', getPoliciesByType);

// ====== AI SALES RECOMMENDATIONS ======
// Get AI-powered sales recommendations based on merchant policies
router.get('/:merchantId/sales-recommendations', getSalesRecommendations);

// ====== IMPORT/EXPORT ======
router.post('/:merchantId/import', importData);
router.get('/:merchantId/export', exportData);

export default router;
