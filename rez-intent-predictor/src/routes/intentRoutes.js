const express = require('express');
const router = express.Router();
const intentScoringService = require('../services/IntentScoringService');
const realTimeAnalyzer = require('../services/RealTimeAnalyzer');
const pushTriggerService = require('../services/PushTriggerService');
const UserIntentProfile = require('../models/UserIntentProfile');
const SessionEvent = require('../models/SessionEvent');

/**
 * POST /intent/score
 * Real-time intent scoring endpoint
 */
router.post('/score', async (req, res) => {
  try {
    const {
      user_id,
      session_id,
      event_type,
      event_data,
      signals,
      context
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id is required'
      });
    }

    // Process the real-time event
    if (event_type) {
      await realTimeAnalyzer.processRealtimeEvent({
        user_id,
        session_id: session_id || intentScoringService.generateSessionId(),
        event_type,
        event_data
      });
    }

    // Score the user's intent
    const intentScore = await intentScoringService.scoreUserIntent(user_id, {
      session_id,
      signals,
      context
    });

    // Evaluate push eligibility
    const pushEligibility = await pushTriggerService.evaluatePushEligibility(user_id);

    // Analyze recent session
    const sessionAnalysis = await realTimeAnalyzer.analyzeSessionEvents(
      user_id,
      intentScore.session_id
    );

    res.json({
      success: true,
      data: {
        user_id,
        session_id: intentScore.session_id,
        current_intent: intentScore.current_intent,
        all_intent_scores: intentScore.all_scores,
        mood: intentScore.mood,
        session_analysis: sessionAnalysis,
        push_recommendation: pushEligibility
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Intent scoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /intent/user/:id/profile
 * Get full intent profile for a user
 */
router.get('/user/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await UserIntentProfile.findOne({ user_id: id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Get recent session events
    const recentEvents = await SessionEvent.find({ user_id: id })
      .sort({ timestamp: -1 })
      .limit(100);

    // Get push eligibility
    const pushEligibility = await pushTriggerService.evaluatePushEligibility(id);

    res.json({
      success: true,
      data: {
        user_id: profile.user_id,
        current_session: {
          session_id: profile.current_session?.session_id,
          started_at: profile.current_session?.started_at,
          last_activity: profile.current_session?.last_activity,
          total_events: profile.current_session?.total_events,
          intent_score: profile.current_session?.intent_score
        },
        current_intent: profile.current_intent,
        historical_intents: profile.historical_intents.slice(-10),
        intent_patterns: pushTriggerService.getIntentPatterns(profile),
        signals: {
          search_queries: profile.signals?.search_queries?.slice(-20) || [],
          browse_history_count: profile.signals?.browse_history?.length || 0,
          cart_behavior: profile.signals?.cart_behavior,
          device_type: profile.signals?.device_type,
          price_sensitivity: profile.signals?.price_sensitivity
        },
        mood_indicators: profile.mood_indicators,
        urgency_signals: profile.urgency_signals,
        exit_intent: profile.exit_intent,
        metrics: profile.metrics,
        user_segment: pushTriggerService.determineUserSegment(profile),
        recent_events: recentEvents.map(e => ({
          event_type: e.event_type,
          timestamp: e.timestamp,
          indicators: e.intent_indicators
        })),
        push_eligibility: pushEligibility,
        last_updated: profile.last_updated
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /intent/optimize
 * Optimize intent detection based on outcomes
 */
router.post('/optimize', async (req, res) => {
  try {
    const {
      user_id,
      session_id,
      action_taken,
      outcome,
      feedback_data
    } = req.body;

    if (!user_id || !action_taken) {
      return res.status(400).json({
        success: false,
        error: 'user_id and action_taken are required'
      });
    }

    const profile = await UserIntentProfile.findOne({ user_id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Record the optimization feedback
    const optimizationRecord = {
      timestamp: new Date(),
      action_taken,
      outcome,
      feedback_data,
      previous_intent: profile.current_intent?.category,
      confidence_at_action: profile.current_intent?.confidence
    };

    // Update metrics based on outcome
    if (outcome === 'conversion') {
      profile.metrics.total_purchases += 1;
      if (feedback_data?.purchase_value) {
        profile.metrics.average_order_value =
          (profile.metrics.average_order_value * (profile.metrics.total_purchases - 1) +
            feedback_data.purchase_value) / profile.metrics.total_purchases;
        profile.metrics.lifetime_value += feedback_data.purchase_value;
      }
    }

    // Check if our intent prediction was accurate
    const intentCorrect = feedback_data?.converted_intent === profile.current_intent?.category;
    if (intentCorrect) {
      // Boost confidence weights for accurate predictions
      optimizationRecord.prediction_accuracy = 'correct';
    } else {
      optimizationRecord.prediction_accuracy = 'incorrect';
      optimizationRecord.actual_intent = feedback_data?.converted_intent;
    }

    profile.last_updated = new Date();
    await profile.save();

    // Return optimization insights
    res.json({
      success: true,
      data: {
        optimization_recorded: true,
        feedback_summary: {
          previous_intent: profile.current_intent?.category,
          predicted_confidence: profile.current_intent?.confidence,
          actual_outcome: outcome,
          prediction_correct: intentCorrect
        },
        updated_metrics: profile.metrics,
        recommendations: generateOptimizationRecommendations(optimizationRecord)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /intent/event
 * Record a real-time event
 */
router.post('/event', async (req, res) => {
  try {
    const {
      user_id,
      session_id,
      event_type,
      event_data
    } = req.body;

    if (!user_id || !event_type) {
      return res.status(400).json({
        success: false,
        error: 'user_id and event_type are required'
      });
    }

    const event = await realTimeAnalyzer.processRealtimeEvent({
      user_id,
      session_id: session_id || intentScoringService.generateSessionId(),
      event_type,
      event_data
    });

    // Re-score intent after event
    const intentScore = await intentScoringService.scoreUserIntent(user_id, {
      session_id: event.session_id
    });

    res.json({
      success: true,
      data: {
        event_id: event._id,
        session_id: event.session_id,
        intent_after_event: intentScore.current_intent,
        event_recorded: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Event recording error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /intent/session/:sessionId/analysis
 * Get detailed session analysis
 */
router.get('/session/:sessionId/analysis', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const events = await SessionEvent.find({ session_id: sessionId })
      .sort({ timestamp: 1 });

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const analysis = await realTimeAnalyzer.analyzeSessionEvents(
      events[0].user_id,
      sessionId
    );

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        user_id: events[0].user_id,
        analysis,
        events: events.map(e => ({
          event_type: e.event_type,
          timestamp: e.timestamp,
          event_data: e.event_data,
          intent_indicators: e.intent_indicators
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /intent/batch-score
 * Batch score multiple users
 */
router.post('/batch-score', async (req, res) => {
  try {
    const { user_ids, signals_batch } = req.body;

    if (!user_ids || !Array.isArray(user_ids)) {
      return res.status(400).json({
        success: false,
        error: 'user_ids array is required'
      });
    }

    const results = [];

    for (let i = 0; i < user_ids.length; i++) {
      const userId = user_ids[i];
      const signals = signals_batch?.[i];

      const intentScore = await intentScoringService.scoreUserIntent(userId, { signals });
      const pushEligibility = await pushTriggerService.evaluatePushEligibility(userId);

      results.push({
        user_id: userId,
        current_intent: intentScore.current_intent,
        all_scores: intentScore.all_scores,
        push_eligible: pushEligibility.should_push,
        push_reasons: pushEligibility.reasons
      });
    }

    res.json({
      success: true,
      data: {
        total_scored: results.length,
        results
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Batch scoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /intent/push-candidates
 * Get users eligible for push notifications
 */
router.get('/push-candidates', async (req, res) => {
  try {
    const { trigger_type, limit = 100 } = req.query;

    let query = { 'push_eligibility.should_push': true };

    if (trigger_type) {
      query['current_intent.category'] = trigger_type;
    }

    const candidates = await UserIntentProfile.find(query)
      .select('user_id current_intent mood_indicators metrics push_eligibility')
      .limit(parseInt(limit))
      .lean();

    const enrichedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const eligibility = await pushTriggerService.evaluatePushEligibility(candidate.user_id);
        return {
          ...candidate,
          push_trigger: eligibility.selected_trigger,
          user_context: eligibility.user_context
        };
      })
    );

    res.json({
      success: true,
      data: {
        count: enrichedCandidates.length,
        candidates: enrichedCandidates
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Push candidates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function generateOptimizationRecommendations(record) {
  const recommendations = [];

  if (record.prediction_accuracy === 'incorrect') {
    recommendations.push({
      type: 'model_adjustment',
      message: 'Consider reviewing intent classification weights',
      details: {
        predicted: record.previous_intent,
        actual: record.actual_intent
      }
    });
  }

  if (record.outcome === 'conversion' && record.confidence_at_action < 0.5) {
    recommendations.push({
      type: 'confidence_threshold',
      message: 'Low confidence predictions may need additional signals'
    });
  }

  return recommendations;
}

module.exports = router;
