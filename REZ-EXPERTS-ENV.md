# REZ Expert Services - Environment Variables

All expert services should use these RABTUL integration variables:

```bash
# RABTUL Core Services (Required)
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com

# Internal Token (for service-to-service auth)
INTERNAL_SERVICE_TOKEN=your-internal-service-token
```

## Expert Services Using This

| Expert | Port | RABTUL Integration |
|--------|------|-------------------|
| rez-hospitality-expert | 3000 | ✅ rabtul.ts |
| rez-salon-expert | 3005 | ✅ rabtul.ts |
| rez-fitness-expert | 3010 | ✅ rabtul.ts |
| rez-health-expert | 3011 | ✅ rabtul.ts |
| rez-travel-expert | 3003 | ✅ rabtul.ts |
| rez-retail-expert | 3004 | ✅ rabtul.ts |
| rez-culinary-expert | - | ✅ rabtul.ts |
| rez-education-expert | - | ✅ rabtul.ts |
