/**
 * REZ Context Engine - Holiday Service
 * India-specific holiday calendar for demand prediction
 */

import { logger } from '../utils/logger.js';

export interface Holiday {
  name: string;
  date: Date;
  type: 'national' | 'state' | 'religious' | 'regional';
  impact: HolidayImpact;
}

export interface HolidayImpact {
  retailMultiplier: number;
  restaurantMultiplier: number;
  deliveryMultiplier: number;
  rideMultiplier: number;
  entertainmentMultiplier: number;
  travelMultiplier: number;
  description: string;
}

export interface HolidayContext {
  isHoliday: boolean;
  isWeekend: boolean;
  isNearHoliday: boolean;
  daysToHoliday: number | null;
  holiday: Holiday | null;
  period: 'normal' | 'pre_holiday' | 'post_holiday' | 'holiday' | 'long_weekend';
  multipliers: HolidayImpact;
}

// Major Indian holidays for 2026
const INDIAN_HOLIDAYS_2026: Array<{
  name: string;
  month: number;
  day: number;
  type: 'national' | 'state' | 'religious' | 'regional';
  impact: HolidayImpact;
}> = [
  {
    name: "New Year's Day",
    month: 0, // January
    day: 1,
    type: 'national',
    impact: {
      retailMultiplier: 1.3,
      restaurantMultiplier: 1.2,
      deliveryMultiplier: 0.9,
      rideMultiplier: 1.1,
      entertainmentMultiplier: 1.4,
      travelMultiplier: 1.2,
      description: 'New Year celebration'
    }
  },
  {
    name: 'Makar Sankranti',
    month: 0, // January
    day: 14,
    type: 'religious',
    impact: {
      retailMultiplier: 1.4,
      restaurantMultiplier: 1.3,
      deliveryMultiplier: 0.8,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 1.5,
      description: 'Harvest festival, peak travel day'
    }
  },
  {
    name: 'Republic Day',
    month: 0, // January
    day: 26,
    type: 'national',
    impact: {
      retailMultiplier: 1.2,
      restaurantMultiplier: 1.3,
      deliveryMultiplier: 0.85,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.3,
      travelMultiplier: 1.4,
      description: 'National holiday with parades and events'
    }
  },
  {
    name: 'Maha Shivaratri',
    month: 1, // February
    day: 12,
    type: 'religious',
    impact: {
      retailMultiplier: 1.0,
      restaurantMultiplier: 1.5,
      deliveryMultiplier: 1.3,
      rideMultiplier: 1.1,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 0.9,
      description: 'Night-long fasting, late-night dining'
    }
  },
  {
    name: 'Holi',
    month: 2, // March
    day: 10,
    type: 'religious',
    impact: {
      retailMultiplier: 1.5,
      restaurantMultiplier: 1.4,
      deliveryMultiplier: 1.2,
      rideMultiplier: 1.2,
      entertainmentMultiplier: 1.6,
      travelMultiplier: 1.3,
      description: 'Festival of colors - peak celebration day'
    }
  },
  {
    name: 'Good Friday',
    month: 2, // March
    day: 27,
    type: 'religious',
    impact: {
      retailMultiplier: 1.1,
      restaurantMultiplier: 1.2,
      deliveryMultiplier: 1.1,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 1.1,
      description: 'Christian holiday'
    }
  },
  {
    name: 'Eid-ul-Fitr',
    month: 3, // April
    day: 10,
    type: 'religious',
    impact: {
      retailMultiplier: 1.4,
      restaurantMultiplier: 1.5,
      deliveryMultiplier: 0.9,
      rideMultiplier: 1.3,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 1.4,
      description: 'Ramadan celebration - feasting after fasting'
    }
  },
  {
    name: 'Ambedkar Jayanti',
    month: 3, // April
    day: 14,
    type: 'national',
    impact: {
      retailMultiplier: 1.1,
      restaurantMultiplier: 1.1,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.1,
      travelMultiplier: 1.0,
      description: 'Constitution architect birthday'
    }
  },
  {
    name: 'Mahavir Jayanti',
    month: 3, // April
    day: 16,
    type: 'religious',
    impact: {
      retailMultiplier: 1.1,
      restaurantMultiplier: 1.2,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.1,
      travelMultiplier: 1.0,
      description: 'Jain festival'
    }
  },
  {
    name: 'May Day',
    month: 4, // May
    day: 1,
    type: 'national',
    impact: {
      retailMultiplier: 1.2,
      restaurantMultiplier: 1.3,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.2,
      entertainmentMultiplier: 1.3,
      travelMultiplier: 1.2,
      description: 'Labor Day - long weekend'
    }
  },
  {
    name: 'Eid-ul-Adha',
    month: 5, // June
    day: 6,
    type: 'religious',
    impact: {
      retailMultiplier: 1.3,
      restaurantMultiplier: 1.4,
      deliveryMultiplier: 0.9,
      rideMultiplier: 1.2,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 1.5,
      description: 'Festival of sacrifice - travel peak'
    }
  },
  {
    name: 'Independence Day',
    month: 7, // August
    day: 15,
    type: 'national',
    impact: {
      retailMultiplier: 1.3,
      restaurantMultiplier: 1.4,
      deliveryMultiplier: 0.85,
      rideMultiplier: 1.1,
      entertainmentMultiplier: 1.5,
      travelMultiplier: 1.3,
      description: '75th celebration, patriotic events'
    }
  },
  {
    name: 'Ganesh Chaturthi',
    month: 8, // September
    day: 5,
    type: 'religious',
    impact: {
      retailMultiplier: 1.6,
      restaurantMultiplier: 1.5,
      deliveryMultiplier: 1.1,
      rideMultiplier: 1.4,
      entertainmentMultiplier: 1.8,
      travelMultiplier: 1.2,
      description: '11-day festival - peak celebrations first/last days'
    }
  },
  {
    name: 'Gandhi Jayanti',
    month: 9, // October
    day: 2,
    type: 'national',
    impact: {
      retailMultiplier: 1.2,
      restaurantMultiplier: 1.2,
      deliveryMultiplier: 0.9,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 1.1,
      description: "Father of nation's birthday"
    }
  },
  {
    name: 'Dussehra',
    month: 9, // October
    day: 12,
    type: 'religious',
    impact: {
      retailMultiplier: 1.5,
      restaurantMultiplier: 1.3,
      deliveryMultiplier: 0.9,
      rideMultiplier: 1.2,
      entertainmentMultiplier: 1.6,
      travelMultiplier: 1.4,
      description: 'Victory of good over evil - shopping peak'
    }
  },
  {
    name: 'Diwali',
    month: 10, // November
    day: 8,
    type: 'religious',
    impact: {
      retailMultiplier: 2.0,
      restaurantMultiplier: 1.6,
      deliveryMultiplier: 1.3,
      rideMultiplier: 1.5,
      entertainmentMultiplier: 1.8,
      travelMultiplier: 1.6,
      description: 'Festival of lights - BIGGEST commerce day'
    }
  },
  {
    name: 'Bhai Dooj',
    month: 10, // November
    day: 10,
    type: 'religious',
    impact: {
      retailMultiplier: 1.4,
      restaurantMultiplier: 1.3,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.2,
      entertainmentMultiplier: 1.3,
      travelMultiplier: 1.3,
      description: 'Sister-brother bonding day'
    }
  },
  {
    name: 'Guru Nanak Jayanti',
    month: 11, // November
    day: 17,
    type: 'religious',
    impact: {
      retailMultiplier: 1.2,
      restaurantMultiplier: 1.3,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.1,
      entertainmentMultiplier: 1.2,
      travelMultiplier: 1.1,
      description: 'Sikh festival'
    },
  },
  {
    name: 'Christmas',
    month: 11, // December
    day: 25,
    type: 'national',
    impact: {
      retailMultiplier: 1.5,
      restaurantMultiplier: 1.6,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.2,
      entertainmentMultiplier: 1.5,
      travelMultiplier: 1.3,
      description: 'Year-end celebrations'
    }
  }
];

export class HolidayService {
  private holidays: Holiday[] = [];
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const year = new Date().getFullYear();

    this.holidays = INDIAN_HOLIDAYS_2026.map((h) => ({
      name: h.name,
      date: new Date(year, h.month, h.day),
      type: h.type,
      impact: h.impact
    }));

    // Sort by date
    this.holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
    this.initialized = true;

    logger.info('Holiday service initialized', {
      holidays: this.holidays.length,
      year
    });
  }

  /**
   * Check if a date is a holiday
   */
  isHoliday(date: Date): Holiday | null {
    const dateStr = this.formatDate(date);
    return this.holidays.find((h) => this.formatDate(h.date) === dateStr) || null;
  }

  /**
   * Check if a date is a weekend
   */
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Get days until next holiday
   */
  daysUntilHoliday(date: Date): { holiday: Holiday; days: number } | null {
    const today = this.startOfDay(date);

    for (const holiday of this.holidays) {
      const holidayDate = this.startOfDay(holiday.date);
      const daysDiff = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 0) {
        return { holiday, days: daysDiff };
      }
    }

    return null;
  }

  /**
   * Get holiday context for a date
   */
  getContext(date: Date): HolidayContext {
    const holiday = this.isHoliday(date);
    const weekend = this.isWeekend(date);
    const holidayInfo = this.daysUntilHoliday(date);

    let period: HolidayContext['period'] = 'normal';
    let multipliers: HolidayImpact = this.getDefaultMultipliers();

    if (holiday) {
      period = 'holiday';
      multipliers = holiday.impact;
    } else if (weekend) {
      period = 'normal';
      multipliers = this.getWeekendMultipliers();
    }

    if (holidayInfo) {
      if (holidayInfo.days <= 3) {
        period = 'pre_holiday';
        // Ramp up multipliers as holiday approaches
        const factor = 1 + (0.2 * (3 - holidayInfo.days) / 3);
        multipliers = this.applyFactor(multipliers, factor);
      } else if (holidayInfo.days <= 7) {
        period = holiday ? 'holiday' : 'pre_holiday';
      }
    }

    // Check for long weekend
    if (weekend && holidayInfo && holidayInfo.days <= 2) {
      period = 'long_weekend';
      multipliers = this.applyFactor(multipliers, 1.3);
    }

    return {
      isHoliday: !!holiday,
      isWeekend: weekend,
      isNearHoliday: holidayInfo ? holidayInfo.days <= 3 : false,
      daysToHoliday: holidayInfo?.days || null,
      holiday,
      period,
      multipliers
    };
  }

  /**
   * Get demand multipliers for a specific category
   */
  getCategoryMultiplier(date: Date, category: keyof HolidayImpact): number {
    const context = this.getContext(date);
    return context.multipliers[category] || 1.0;
  }

  /**
   * Get upcoming holidays in a date range
   */
  getUpcomingHolidays(startDate: Date, endDate: Date): Holiday[] {
    return this.holidays.filter((h) => {
      return h.date >= this.startOfDay(startDate) && h.date <= this.startOfDay(endDate);
    });
  }

  /**
   * Check if date is in Diwali period (peak commerce)
   */
  isDiwaliPeriod(date: Date): boolean {
    const diwali = this.holidays.find((h) => h.name === 'Diwali');
    if (!diwali) return false;

    const diff = Math.abs(date.getTime() - diwali.date.getTime());
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  }

  /**
   * Check if date is in holiday shopping season
   */
  isHolidaySeason(date: Date): boolean {
    const month = date.getMonth();
    // November - January (Diwali to New Year)
    return month >= 10 || month <= 0;
  }

  private getDefaultMultipliers(): HolidayImpact {
    return {
      retailMultiplier: 1.0,
      restaurantMultiplier: 1.0,
      deliveryMultiplier: 1.0,
      rideMultiplier: 1.0,
      entertainmentMultiplier: 1.0,
      travelMultiplier: 1.0,
      description: 'Normal day'
    };
  }

  private getWeekendMultipliers(): HolidayImpact {
    return {
      retailMultiplier: 1.15,
      restaurantMultiplier: 1.2,
      deliveryMultiplier: 1.1,
      rideMultiplier: 1.15,
      entertainmentMultiplier: 1.25,
      travelMultiplier: 1.1,
      description: 'Weekend boost'
    };
  }

  private applyFactor(multipliers: HolidayImpact, factor: number): HolidayImpact {
    return {
      retailMultiplier: multipliers.retailMultiplier * factor,
      restaurantMultiplier: multipliers.restaurantMultiplier * factor,
      deliveryMultiplier: multipliers.deliveryMultiplier * factor,
      rideMultiplier: multipliers.rideMultiplier * factor,
      entertainmentMultiplier: multipliers.entertainmentMultiplier * factor,
      travelMultiplier: multipliers.travelMultiplier * factor,
      description: multipliers.description
    };
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export const holidayService = new HolidayService();
