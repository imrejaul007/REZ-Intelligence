# ADR: Token Storage & Refresh Rotation

## Context
Token management is inconsistent across web and mobile clients. 401 errors cause lost user context. Token refreshes happen at different layers.

## Decision
Centralize token storage (localStorage on web, cookies with Secure flag) and 401 interception with automatic refresh rotation.

## Rationale
- SecureStore interface allows platform-specific implementations
- Browser storage (localStorage) vs cookies trade security/XSS for convenience
- Cookie Secure/SameSite flags prevent CSRF and token theft
- 401 interceptor automatically refreshes before client sees error
- Subsumes bugs: lost auth context on token expiry, inconsistent token storage, manual refresh logic duplication

## Implementation
Exports:
- `SecureStore` interface: get/set/remove
- `BrowserSecureStore`: localStorage-backed storage
- `CookieSecureStore`: HTTP-only cookie storage
- `TokenManager`: manages access/refresh token pair with 401 interceptor
- Constants: AUTH_HEADER, REFRESH_TOKEN_KEY, ACCESS_TOKEN_KEY

## Related Issues
- Unauthorized errors on token expiry
- Inconsistent token storage across apps
- Lost authentication state during session
