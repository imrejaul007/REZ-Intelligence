import { format, parseISO, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, utcToZonedTime as toZonedTime } from 'date-fns-tz';

/**
 * Date and time utilities for the targeting engine
 */

export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
};

export const formatDateInTimezone = (
  date: Date | string,
  timezone: string,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, timezone, formatStr);
};

export const getDateRange = (
  days: number,
  referenceDate?: Date
): { start: Date; end: Date } => {
  const ref = referenceDate || new Date();
  return {
    start: startOfDay(subDays(ref, days)),
    end: endOfDay(ref)
  };
};

export const isWithinDateRange = (
  date: Date,
  start: Date,
  end: Date
): boolean => {
  return date >= start && date <= end;
};

export const getNextOccurrence = (
  time: string,
  timezone: string,
  fromDate?: Date
): Date => {
  const ref = fromDate || new Date();
  const zonedDate = toZonedTime(ref, timezone);

  const [hours, minutes] = time.split(':').map(Number);
  zonedDate.setHours(hours, minutes, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (zonedDate <= ref) {
    zonedDate.setDate(zonedDate.getDate() + 1);
  }

  return zonedDate;
};

export const getDayOfWeek = (date: Date = new Date()): number => {
  return date.getDay();
};

export const isValidTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/**
 * String utilities
 */

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Number utilities
 */

export const roundToDecimal = (num: number, decimals: number = 2): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const percentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return roundToDecimal((value / total) * 100);
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Array utilities
 */

export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

export const groupBy = <T, K extends string | number>(
  array: T[],
  key: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<K, T[]>);
};

/**
 * Object utilities
 */

export const pick = <T, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as unknown;
  keys.forEach(key => {
    if (key in (obj as unknown)) {
      result[key] = (obj as unknown)[key];
    }
  });
  return result;
};

export const omit = <T, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
};

export const deepMerge = <T extends object>(target: T, source: Partial<T>): T => {
  const output = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        source[key] !== null
      ) {
        output[key] = deepMerge(
          (target[key] as unknown) || {},
          source[key] as unknown
        );
      } else {
        output[key] = source[key] as unknown;
      }
    }
  }
  return output;
};

/**
 * Validation utilities
 */

export const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const re = /^\+?[1-9]\d{1,14}$/;
  return re.test(phone.replace(/[\s()-]/g, ''));
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Hash utilities
 */

export const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export const deterministicRandom = (seed: string, min: number, max: number): number => {
  const hash = simpleHash(seed);
  return min + (hash % (max - min));
};
