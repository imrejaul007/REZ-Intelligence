/**
 * User Response Normalization Utility
 *
 * AC2-H1 fix: The backend exposes THREE different user-response shapes across three endpoints:
 *   1. GET /api/user/profile  → flat: { id, name, email, phone, profilePicture, isVerified }
 *   2. GET /api/user/auth/me  → nested: { id, phoneNumber, email, profile, preferences, wallet, role, ... }
 *   3. GET /api/user/boot     → grouped: { profile: {...firstName...}, wallet, cart: {itemCount}, notifications: {unreadCount} }
 *
 * This utility normalizes all three shapes to a single CanonicalUserProfile so that
 * consumer code can work with a consistent interface regardless of which endpoint was called.
 *
 * Usage:
 *   import { normalizeUserResponse } from '@rez/shared';
 *   const user = normalizeUserResponse(rawApiResponse);
 */

// ── Shape 1: /api/user/profile response ───────────────────────────────────────
export interface UserProfileShape1 {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
  isVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ── Shape 2: /api/user/auth/me response ────────────────────────────────────────
export interface UserProfileShape2 {
  id: string;
  _id?: string; // backend may return _id instead of id
  phoneNumber?: string;
  email?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    bio?: string;
    dateOfBirth?: string;
    gender?: string;
    location?: Record<string, unknown>;
  };
  preferences?: Record<string, unknown>;
  wallet?: Record<string, unknown>;
  role?: string;
  isVerified?: boolean;
  isOnboarded?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Identity layer fields
  statedIdentity?: string;
  featureLevel?: string;
  segment?: string;
  verificationSegment?: string;
  instituteStatus?: string;
  activeZones?: string[];
  verifications?: Record<string, unknown>;
}

// ── Shape 3: /api/user/boot response ──────────────────────────────────────────
export interface UserProfileShape3 {
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    isOnboarded?: boolean;
    subscription?: { tier?: string };
    auth?: { isVerified?: boolean };
  };
  wallet?: {
    coins?: Array<{ type: string; amount: number }>;
    balance?: { total?: number; available?: number };
    brandedCoinsTotal?: number;
  };
  cart?: { itemCount?: number };
  notifications?: { unreadCount?: number };
}

// ── TF-12: normalizeUserId() — canonical id/_id resolver ───────────────────────
/**
 * Extract a stable string id from any entity that may have `id`, `_id`, or
 * other id-like fields. MongoDB documents use `_id` while API responses use
 * `id` — this utility normalises both to a single canonical string id.
 *
 * Usage:
 *   import { normalizeUserId } from '@rez/shared';
 *   const userId = normalizeUserId(user); // always returns string
 */
export function normalizeUserId(entity: { id?: string; _id?: string } | null | undefined): string {
  if (!entity) return '';
  return entity.id ?? entity._id ?? '';
}

// ── Canonical normalized output ─────────────────────────────────────────────────
export interface CanonicalUserProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  isVerified: boolean;
  isOnboarded: boolean;
  role?: string;
  loyaltyTier?: string;
  walletBalance?: number;
  coinBalance?: number;
  cartItemCount?: number;
  unreadNotificationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Detect which shape a response matches and normalize it to CanonicalUserProfile.
 * Returns null if the input cannot be matched to any known shape.
 */
export function normalizeUserResponse(
  raw: Partial<UserProfileShape1 | UserProfileShape2 | UserProfileShape3 | unknown> | null
): CanonicalUserProfile | null {
  if (!raw) return null;

  // Shape 1: flat with `name` field (GET /api/user/profile)
  if ('name' in raw && 'id' in raw && !('profile' in raw) && !('phoneNumber' in raw)) {
    const s = raw as Partial<UserProfileShape1>;
    return {
      id: s.id ?? '',
      name: s.name ?? '',
      email: s.email,
      phone: s.phone,
      avatar: s.profilePicture,
      isVerified: s.isVerified ?? false,
      isOnboarded: true,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  // Shape 2: has phoneNumber + nested profile (GET /api/user/auth/me)
  // Note: wallet sub-doc removed from User (DM-L4) — wallet data comes from GET /wallet/balance
  if ('phoneNumber' in raw || ('profile' in raw && !('itemCount' in (raw as any).cart))) {
    const s = raw as Partial<UserProfileShape2>;
    const prof = s.profile ?? {};
    return {
      id: s.id ?? (s as any)._id ?? '',
      name: [prof.firstName, prof.lastName].filter(Boolean).join(' ') || s.email || '',
      firstName: prof.firstName,
      lastName: prof.lastName,
      email: s.email,
      phone: s.phoneNumber,
      avatar: prof.avatar,
      isVerified: s.isVerified ?? false,
      isOnboarded: s.isOnboarded ?? false,
      role: s.role,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  // Shape 3: boot response with grouped profile/wallet/cart (GET /api/user/boot)
  // Note: wallet sub-doc removed from User (DM-L4) — wallet data comes from GET /wallet/balance
  if ('profile' in raw && ('cart' in raw || 'notifications' in raw)) {
    const s = raw as Partial<UserProfileShape3>;
    const prof = s.profile ?? {};
    const isVerified = (prof as any).auth?.isVerified ?? (prof as any).subscription?.tier != null;
    return {
      id: (raw as any).id ?? (raw as any).user ?? (raw as any)._id ?? '',
      name: [prof.firstName, prof.lastName].filter(Boolean).join(' ') || '',
      firstName: prof.firstName,
      lastName: prof.lastName,
      avatar: prof.avatar,
      isVerified: isVerified,
      isOnboarded: prof.isOnboarded ?? false,
      loyaltyTier: (prof as any).subscription?.tier,
      walletBalance: undefined, // wallet sub-doc removed (DM-L4) — fetch from GET /wallet/balance
      coinBalance: undefined, // wallet sub-doc removed (DM-L4) — fetch from GET /wallet/balance
      cartItemCount: s.cart?.itemCount,
      unreadNotificationCount: s.notifications?.unreadCount,
    };
  }

  // Fallback: try to extract id and name from any unknown shape
  const unknown = raw as Record<string, unknown>;
  const id = String(unknown.id ?? unknown._id ?? unknown.user ?? '');
  const name = String(
    unknown.name ??
    unknown.fullName ??
    [unknown.firstName, unknown.lastName].filter(Boolean).join(' ') ??
    ''
  );
  return { id, name, isVerified: false, isOnboarded: false };
}
