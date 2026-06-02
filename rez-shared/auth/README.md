# Token Storage & Refresh Rotation

Platform-specific token storage with automatic 401 refresh rotation.

## Usage

```typescript
import { TokenManager, BrowserSecureStore, CookieSecureStore } from '@rez/auth';
import axios from 'axios';

// Web: use localStorage
const store = new BrowserSecureStore();
// or cookies
const store = new CookieSecureStore();

const apiClient = axios.create({ baseURL: 'https://api.example.com' });
const tokenManager = new TokenManager(store, apiClient);

// Store tokens
await tokenManager.setTokens({
  accessToken: 'jwt_token',
  refreshToken: 'refresh_jwt',
});

// Auto-refresh on 401
const response = await apiClient.get('/protected'); // automatically refreshes if needed
```

See `ADR.md` for design rationale.
