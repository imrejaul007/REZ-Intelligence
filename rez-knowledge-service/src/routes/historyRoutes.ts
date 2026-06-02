// REZ Knowledge Service - History Routes
// Handles user history stats across ALL apps

import { Router, Response } from 'express';
import { profileService } from '../services';
import {
  asyncHandler,
  validateUserId,
  ServiceAuthRequest,
  NotFoundError,
  ValidationError,
} from '../middleware';

const router = Router();

// GET /history/:userId - Get user history
router.get(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;

    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    res.json({
      success: true,
      data: profile.history,
    });
  })
);

// GET /history/:userId/summary - Get history summary
router.get(
  '/:userId/summary',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;

    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    const { history } = profile;

    res.json({
      success: true,
      data: {
        totalBookings: {
          hotel: history.hotelBookings,
          restaurant: history.restaurantOrders,
          salon: history.salonBookings,
          healthcare: history.healthcareAppointments,
          rendez: history.rendezDates,
          corporate: history.corporateBookings,
          total: history.hotelBookings +
            history.restaurantOrders +
            history.salonBookings +
            history.healthcareAppointments +
            history.rendezDates +
            history.corporateBookings,
        },
        financial: {
          totalSpent: history.totalSpent,
          avgOrderValue: history.avgOrderValue,
          totalSavings: history.totalSavings,
          lifetimeValue: history.lifetimeValue,
        },
        engagement: {
          avgRating: history.avgRating,
          totalReviews: history.totalReviews,
          lastActiveDate: history.lastActiveDate,
          accountAge: history.accountAge,
        },
        loyalty: {
          tier: history.loyaltyTier,
          points: history.loyaltyPoints,
        },
      },
    });
  })
);

// PUT /history/:userId - Update user history
router.put(
  '/:userId',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const {
      hotelBookings,
      restaurantOrders,
      salonBookings,
      healthcareAppointments,
      rendezDates,
      corporateBookings,
      totalSpent,
      avgOrderValue,
      totalSavings,
      avgRating,
      totalReviews,
      loyaltyTier,
      loyaltyPoints,
      lifetimeValue,
    } = req.body;

    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    // Update history fields
    if (hotelBookings !== undefined) profile.history.hotelBookings = hotelBookings;
    if (restaurantOrders !== undefined) profile.history.restaurantOrders = restaurantOrders;
    if (salonBookings !== undefined) profile.history.salonBookings = salonBookings;
    if (healthcareAppointments !== undefined) profile.history.healthcareAppointments = healthcareAppointments;
    if (rendezDates !== undefined) profile.history.rendezDates = rendezDates;
    if (corporateBookings !== undefined) profile.history.corporateBookings = corporateBookings;
    if (totalSpent !== undefined) profile.history.totalSpent = totalSpent;
    if (avgOrderValue !== undefined) profile.history.avgOrderValue = avgOrderValue;
    if (totalSavings !== undefined) profile.history.totalSavings = totalSavings;
    if (avgRating !== undefined) profile.history.avgRating = avgRating;
    if (totalReviews !== undefined) profile.history.totalReviews = totalReviews;
    if (loyaltyTier !== undefined) profile.history.loyaltyTier = loyaltyTier;
    if (loyaltyPoints !== undefined) profile.history.loyaltyPoints = loyaltyPoints;
    if (lifetimeValue !== undefined) profile.history.lifetimeValue = lifetimeValue;

    profile.history.lastActiveDate = new Date();

    // Calculate account age
    profile.history.accountAge = Math.floor(
      (new Date().getTime() - profile.history.joinedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    await profile.save();

    res.json({
      success: true,
      data: profile.history,
    });
  })
);

// POST /history/:userId/increment - Increment booking stats
router.post(
  '/:userId/increment',
  validateUserId,
  asyncHandler(async (req: ServiceAuthRequest, res: Response) => {
    const { userId } = req.params;
    const { app, amount, rating } = req.body;

    if (!app) {
      throw new ValidationError('app is required');
    }

    const profile = await profileService.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError('User profile');
    }

    // Update based on app type
    switch (app) {
      case 'hotel':
      case 'stayown':
        profile.history.hotelBookings += 1;
        break;
      case 'restaurant':
        profile.history.restaurantOrders += 1;
        break;
      case 'salon':
        profile.history.salonBookings += 1;
        break;
      case 'healthcare':
        profile.history.healthcareAppointments += 1;
        break;
      case 'rendez':
        profile.history.rendezDates += 1;
        break;
      case 'corporate':
      case 'corpspark':
        profile.history.corporateBookings += 1;
        break;
      default:
        // Increment restaurant orders as default
        profile.history.restaurantOrders += 1;
    }

    // Update financial data
    if (typeof amount === 'number' && amount > 0) {
      profile.history.totalSpent += amount;

      // Recalculate average order value
      const totalOrders =
        profile.history.restaurantOrders +
        profile.history.hotelBookings +
        profile.history.salonBookings +
        profile.history.healthcareAppointments +
        profile.history.corporateBookings;

      if (totalOrders > 0) {
        profile.history.avgOrderValue = profile.history.totalSpent / totalOrders;
      }
    }

    // Update rating if provided
    if (typeof rating === 'number' && rating >= 0 && rating <= 5) {
      const totalRatings = profile.history.totalReviews + 1;
      profile.history.avgRating =
        (profile.history.avgRating * profile.history.totalReviews + rating) / totalRatings;
      profile.history.avgRating = Math.round(profile.history.avgRating * 100) / 100;
      profile.history.totalReviews = totalRatings;
    }

    // Update loyalty points
    if (typeof amount === 'number' && amount > 0) {
      // Award 1 point per 10 rupees spent
      profile.history.loyaltyPoints += Math.floor(amount / 10);
    }

    profile.history.lastActiveDate = new Date();
    profile.history.accountAge = Math.floor(
      (new Date().getTime() - profile.history.joinedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Update loyalty tier based on points
    profile.history.lifetimeValue = profile.history.lifetimeValue || 0;
    profile.history.lifetimeValue += typeof amount === 'number' ? amount : 0;

    if (profile.history.lifetimeValue >= 100000) {
      profile.history.loyaltyTier = 'diamond';
    } else if (profile.history.lifetimeValue >= 50000) {
      profile.history.loyaltyTier = 'platinum';
    } else if (profile.history.lifetimeValue >= 25000) {
      profile.history.loyaltyTier = 'gold';
    } else if (profile.history.lifetimeValue >= 10000) {
      profile.history.loyaltyTier = 'silver';
    }

    await profile.save();

    res.json({
      success: true,
      data: profile.history,
    });
  })
);

export default router;
