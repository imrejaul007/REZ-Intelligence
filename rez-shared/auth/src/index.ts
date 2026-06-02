import axios, { AxiosInstance, AxiosError } from 'axios';

export const AUTH_HEADER = 'Authorization';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const ACCESS_TOKEN_KEY = 'access_token';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * BrowserSecureStore — cookie-backed token storage for web platforms.
 *
 * SECURITY NOTE: Tokens stored here are accessible to JavaScript (not httpOnly),
 * so the primary defense against XSS is CSP, input sanitization, and avoiding
 * dangerous APIs (eval, innerHTML with user input). For defense-in-depth, the
 * server should ALSO set tokens as httpOnly cookies via Set-Cookie headers so
 * that even a successful XSS cannot exfiltrate them via document.cookie.
 *
 * Cookie flags applied: Secure (HTTPS only), SameSite=Strict, Path=/
 *
 * @deprecated Use CookieSecureStore directly for new code.
 *             This class is kept for backward compatibility but now delegates
 *             to cookie-based storage with the same security properties.
 */
export class BrowserSecureStore implements SecureStore {
  private readonly cookieStore = new CookieSecureStore(true, 'Strict');

  async get(key: string): Promise<string | null> {
    return this.cookieStore.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.cookieStore.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.cookieStore.remove(key);
  }

  /**
   * Sets a cookie with explicit flags.
   * Prefer having the server set tokens via Set-Cookie headers with httpOnly.
   * This method is provided for cases where client-side cookie setting is needed.
   */
  async setCookie(
    key: string,
    value: string,
    options?: { secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' },
  ): Promise<void> {
    const store = new CookieSecureStore(
      options?.secure ?? true,
      options?.sameSite ?? 'Strict',
    );
    await store.set(key, value);
  }

  /**
   * Reads a cookie by name. Returns null if not found.
   */
  async getCookie(key: string): Promise<string | null> {
    return this.cookieStore.get(key);
  }
}

export class CookieSecureStore implements SecureStore {
  constructor(private secure = true, private sameSite = 'Strict') {}

  async get(key: string): Promise<string | null> {
    if (typeof document === 'undefined') return null;
    const name = `${key}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    for (let cookie of cookieArray) {
      cookie = cookie.trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length);
      }
    }
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof document === 'undefined') return;
    const path = '; path=/';
    const secure = this.secure ? '; Secure' : '';
    const sameSite = `; SameSite=${this.sameSite}`;
    document.cookie = `${key}=${encodeURIComponent(value)}${path}${secure}${sameSite}`;
  }

  async remove(key: string): Promise<void> {
    if (typeof document === 'undefined') return;
    await this.set(key, '');
  }
}

export class TokenManager {
  constructor(private store: SecureStore, private apiClient: AxiosInstance) {
    this.setupInterceptor();
  }

  async getAccessToken(): Promise<string | null> {
    return this.store.get(ACCESS_TOKEN_KEY);
  }

  async setTokens(tokens: Tokens): Promise<void> {
    await this.store.set(ACCESS_TOKEN_KEY, tokens.accessToken);
    await this.store.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  async refreshAccessToken(refreshUrl: string): Promise<string> {
    const refreshToken = await this.store.get(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.apiClient.post(refreshUrl, {
      refreshToken,
    });

    const newTokens: Tokens = response.data;
    await this.setTokens(newTokens);
    return newTokens.accessToken;
  }

  async logout(): Promise<void> {
    await this.store.remove(ACCESS_TOKEN_KEY);
    await this.store.remove(REFRESH_TOKEN_KEY);
  }

  private setupInterceptor(): void {
    // Request interceptor: add auth header
    this.apiClient.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers[AUTH_HEADER] = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: handle 401
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && originalRequest) {
          try {
            const newToken = await this.refreshAccessToken('/auth/refresh');
            originalRequest.headers[AUTH_HEADER] = `Bearer ${newToken}`;
            return this.apiClient(originalRequest);
          } catch {
            await this.logout();
            throw error;
          }
        }
        throw error;
      },
    );
  }
}
