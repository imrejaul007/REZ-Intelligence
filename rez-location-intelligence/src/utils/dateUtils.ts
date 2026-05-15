/**
 * Date Utilities
 * Helper functions for date manipulation and analysis
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isWeekday(date: Date): boolean {
  return !isWeekend(date);
}

export function getHour(date: Date): number {
  return date.getHours();
}

export function isBusinessHours(date: Date, startHour = 9, endHour = 18): boolean {
  const hour = getHour(date);
  return hour >= startHour && hour <= endHour;
}

export function isMorningRush(date: Date): boolean {
  const hour = getHour(date);
  return (hour >= 7 && hour <= 9);
}

export function isEveningRush(date: Date): boolean {
  const hour = getHour(date);
  return (hour >= 17 && hour <= 19);
}

export function isLunchTime(date: Date): boolean {
  const hour = getHour(date);
  return (hour >= 12 && hour <= 14);
}

export function getDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end };
}

export function groupByDay(visits: { timestamp: Date }[]): Map<string, typeof visits> {
  const grouped = new Map<string, typeof visits>();

  for (const visit of visits) {
    const dateKey = visit.timestamp.toISOString().split('T')[0];
    const existing = grouped.get(dateKey) || [];
    existing.push(visit);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

export function groupByHour(visits: { timestamp: Date }[]): Map<number, typeof visits> {
  const grouped = new Map<number, typeof visits>();

  for (const visit of visits) {
    const hour = getHour(visit.timestamp);
    const existing = grouped.get(hour) || [];
    existing.push(visit);
    grouped.set(hour, existing);
  }

  return grouped;
}

export function calculateFrequency(visits: { timestamp: Date }[], totalDays: number): 'daily' | 'weekly' | 'occasional' {
  const uniqueDays = new Set(visits.map(v => v.timestamp.toISOString().split('T')[0])).size;

  if (uniqueDays === 0) return 'occasional';

  const visitsPerDay = uniqueDays / totalDays;

  if (visitsPerDay >= 0.8) return 'daily';
  if (visitsPerDay >= 0.15) return 'weekly';
  return 'occasional';
}

export function getDateDiffInDays(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
