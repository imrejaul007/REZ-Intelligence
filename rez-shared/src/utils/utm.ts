/**
 * UTM Parameter Tracking Utility
 *
 * Captures and stores UTM parameters from URLs for attribution tracking.
 * UTM parameters capture marketing campaign source, medium, and campaign name.
 */

export interface UTMParams {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface UTMSessionData extends UTMParams {
  storedAt: string;
  landingPage: string;
}

/**
 * Extract UTM parameters from current URL search params
 * Works in browser environment (window.location)
 */
export function getUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    // Server-side: return empty params
    return {
      source: '',
      medium: '',
      campaign: '',
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    term: params.get('utm_term') || undefined,
    content: params.get('utm_content') || undefined,
  };
}

/**
 * Check if current URL has any UTM parameters
 */
export function hasUTMParams(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.has('utm_source') ||
    params.has('utm_medium') ||
    params.has('utm_campaign');
}

/**
 * Store UTM parameters in sessionStorage for later use
 * Call this on landing page to capture attribution data
 */
export function storeUTMParams(): UTMSessionData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const utm = getUTMParams();

  // Only store if we have meaningful UTM data
  if (!utm.source && !utm.medium && !utm.campaign) {
    return null;
  }

  const sessionData: UTMSessionData = {
    ...utm,
    storedAt: new Date().toISOString(),
    landingPage: window.location.pathname,
  };

  try {
    sessionStorage.setItem('rez_utm_params', JSON.stringify(sessionData));
  } catch (e) {
    console.error('[UTM] Failed to store UTM params:', e);
  }

  return sessionData;
}

/**
 * Retrieve stored UTM parameters from sessionStorage
 * Returns null if no UTM data was stored or session expired
 */
export function getStoredUTMParams(): UTMSessionData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = sessionStorage.getItem('rez_utm_params');
    if (!stored) return null;

    const data = JSON.parse(stored) as UTMSessionData;

    // Check if session is still valid (UTM data typically valid for same session)
    // SessionStorage clears when tab closes, so we just check if data exists
    return data;
  } catch (e) {
    console.error('[UTM] Failed to retrieve UTM params:', e);
    return null;
  }
}

/**
 * Clear stored UTM parameters
 */
export function clearStoredUTMParams(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem('rez_utm_params');
  } catch (e) {
    console.error('[UTM] Failed to clear UTM params:', e);
  }
}

/**
 * Get UTM params for API request/analytics
 * Returns stored params if available, otherwise extracts from current URL
 */
export function getUTMForTracking(): UTMParams {
  // First check sessionStorage
  const stored = getStoredUTMParams();
  if (stored) {
    return {
      source: stored.source,
      medium: stored.medium,
      campaign: stored.campaign,
    };
  }

  // Fall back to current URL params
  return getUTMParams();
}

/**
 * Parse UTM parameters from a full URL string (for server-side processing)
 */
export function parseUTMFromUrl(url: string): UTMParams {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      term: params.get('utm_term') || undefined,
      content: params.get('utm_content') || undefined,
    };
  } catch {
    return {
      source: '',
      medium: '',
      campaign: '',
    };
  }
}

/**
 * Build a URL with UTM parameters appended
 * Useful for generating shareable referral links
 */
export function buildUTMUrl(baseUrl: string, utm: Partial<UTMParams>): string {
  try {
    const urlObj = new URL(baseUrl);
    const params = new URLSearchParams(urlObj.search);

    if (utm.source) params.set('utm_source', utm.source);
    if (utm.medium) params.set('utm_medium', utm.medium);
    if (utm.campaign) params.set('utm_campaign', utm.campaign);
    if (utm.term) params.set('utm_term', utm.term);
    if (utm.content) params.set('utm_content', utm.content);

    urlObj.search = params.toString();
    return urlObj.toString();
  } catch {
    return baseUrl;
  }
}
