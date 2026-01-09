# 🚀 Trade Tracker Pro - Deployment Checklist

**Current Status**: Deployed to Production  
**Production URL**: https://trade-tracker-eight.vercel.app  
**Last Updated**: January 9, 2026

---

## ✅ PRE-DEPLOYMENT CHECKS

### 1. **Environment Variables (Vercel Dashboard)**

Visit: `https://vercel.com/[your-project]/settings/environment-variables`

#### Required for Production:

```bash
# AI Features (Required for AI Insights page)
VITE_OPENAI_API_KEY=sk-...
# OR use Gemini (recommended)
VITE_GEMINI_API_KEY=...

# Schwab OAuth (Required for Schwab API import)
SCHWAB_CLIENT_ID=your_schwab_client_id
SCHWAB_CLIENT_SECRET=your_schwab_client_secret
SCHWAB_CALLBACK_URL=https://trade-tracker-eight.vercel.app/schwab/callback

# MEXC API (Optional - for MEXC API import)
MEXC_API_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret_key
```

#### ⚠️ **CRITICAL**: Update Schwab Callback URL

1. **Update in Vercel Environment Variables**:
   - Change from: `http://localhost:5173/schwab/callback`
   - Change to: `https://trade-tracker-eight.vercel.app/schwab/callback`

2. **Update in Schwab Developer Portal**:
   - Go to: https://developer.schwab.com/dashboard
   - Navigate to your app settings
   - Update "Redirect URI" to match: `https://trade-tracker-eight.vercel.app/schwab/callback`
   - Save changes

---

## 🧪 TESTING CHECKLIST

### Local Testing (Before Deploy)

```bash
# 1. Install dependencies
npm install

# 2. Run build check
npm run build

# 3. Test locally with Vercel dev (for API routes)
vercel dev

# 4. Type checking
npm run tsc

# 5. Lint check
npm run lint
```

### Production Testing (After Deploy)

#### **1. Test MEXC Integration**

**Test Procedure**:
1. Open browser console (`F12`)
2. Go to Settings page
3. Enter MEXC API Key and Secret
4. Save settings
5. Go to Import page
6. Try "Import from MEXC Futures"
7. Check console for detailed debug logs

**Expected Console Logs**:
```
[MEXC] API Key length: 32
[MEXC] Secret length: 32
[MEXC Time Check] { drift: "123ms", driftSeconds: "0.12s" }
[MEXC Futures] Request Details: { timestamp: "...", signatureFull: "..." }
[MEXC Futures] Raw Response: { status: 200, ... }
[MEXC Futures] Parsed Response: { success: true, code: 0 }
```

**Common Errors & Solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| `"Confirming signature failed"` | Incorrect signature generation | Check API key/secret, verify no extra spaces |
| `403 Forbidden` | IP not whitelisted | Add your IP to MEXC API key whitelist |
| `401 Unauthorized` | Invalid API credentials | Verify key/secret are correct |
| `Time window error` | Server time drift > 10s | Check system clock, increase Recv-Window |

#### **2. Test Schwab OAuth**

**Test Procedure**:
1. Go to Import page
2. Click "Connect to Schwab"
3. Complete OAuth flow
4. Should redirect back to app with success message

**Expected Behavior**:
- OAuth popup/redirect to Schwab login
- After login, redirect to `https://trade-tracker-eight.vercel.app/schwab/callback`
- App receives auth code and exchanges for token
- Import trades successfully

#### **3. Test HeroFX/TradeLocker Quick Paste**

**Test Procedure**:
1. Go to Import page
2. Scroll to "Quick Paste Import"
3. Copy sample trades from TradeLocker (Ctrl+C)
4. Paste into textarea
5. Click "Import Pasted Data"

**Expected Behavior**:
- Trades parsed correctly with proper P&L calculation
- 100x leverage applied
- Contract sizes correct (XAGUSD: 5000 oz, XAUUSD: 100 oz)

#### **4. Test CSV Imports**

Test each supported exchange:
- [x] Schwab (Realized Gain/Loss CSV)
- [x] Interactive Brokers
- [x] Binance
- [x] ByBit
- [ ] BloFin

#### **5. Test AI Insights**

**Test Procedure**:
1. Go to Settings
2. Enter Gemini API key
3. Click "Test Connection"
4. Should show "Connection Successful!"
5. Go to AI Insights page
6. Add some trades if needed
7. Click "Generate Insights"

**Expected Behavior**:
- AI analyzes recent trades
- Provides pattern recognition
- Suggests improvements

---

## 🐛 DEBUGGING MEXC SIGNATURE ISSUES

### Enhanced Debug Logging (v2.0)

The updated code now logs:
- ✅ Full signature string
- ✅ Complete headers sent
- ✅ Raw response from MEXC (first 500 chars)
- ✅ Server time drift calculation
- ✅ API key/secret length verification

### Manual Signature Verification

To manually verify signature generation:

```javascript
// In browser console
const apiKey = "your_api_key_here";
const apiSecret = "your_api_secret_here";
const timestamp = Date.now().toString();
const queryString = ""; // Empty for history_orders endpoint

// Build signature string
const signString = apiKey + timestamp + queryString;
console.log("Sign String:", signString);

// Generate signature (requires crypto-js)
const signature = CryptoJS.HmacSHA256(signString, apiSecret).toString(CryptoJS.enc.Hex);
console.log("Signature:", signature);
```

### Check MEXC API Requirements

1. **API Key Permissions**:
   - Must have "Read" permission for trade history
   - Check in MEXC account settings

2. **IP Whitelist**:
   - If enabled, add Vercel's IP ranges
   - Or disable IP restriction for testing

3. **Time Synchronization**:
   - MEXC requires timestamp within 10 seconds of server time
   - Our code now checks server time automatically

---

## 📊 MONITORING & LOGS

### Vercel Logs

```bash
# View production logs
vercel logs

# View specific deployment
vercel logs [deployment-url]

# Follow logs in real-time (local dev)
vercel dev --debug
```

### Browser Console

All MEXC requests log to browser console with prefix:
- `[MEXC Time Check]` - Server time drift
- `[MEXC Futures]` - API request details
- `[MEXC]` - General info

---

## 🚀 DEPLOYMENT COMMANDS

### Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or push to main branch (auto-deploy via Vercel GitHub integration)
git push origin main
```

### Rollback

```bash
# List deployments
vercel list

# Promote previous deployment
vercel promote [deployment-url]
```

---

## 📝 POST-DEPLOYMENT VERIFICATION

After deploying, verify:

- [ ] Production URL loads correctly
- [ ] All pages accessible (Dashboard, Journal, Analytics, etc.)
- [ ] Settings persist in localStorage
- [ ] HeroFX quick paste works
- [ ] CSV imports work for Schwab
- [ ] Schwab OAuth redirects correctly
- [ ] MEXC API calls complete (check console logs)
- [ ] AI insights generate successfully
- [ ] Charts render properly
- [ ] Mobile responsive design works

---

## 🔒 SECURITY NOTES

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Rotate API keys** if accidentally exposed
3. **Use read-only API keys** where possible
4. **Enable IP restrictions** on exchange API keys for production
5. **Set proper CORS headers** in Vercel serverless functions

---

## 📞 SUPPORT & TROUBLESHOOTING

### MEXC API Issues

If MEXC continues to fail after following this checklist:

1. **Verify API Key Format**:
   - Length should be 32 characters (both key and secret)
   - No spaces or special characters

2. **Test with Minimal Request**:
   - Try `/api/v1/contract/ping` first (public endpoint)
   - Then try authenticated endpoint

3. **Contact MEXC Support**:
   - Provide: timestamp, signature string, error message
   - Ask them to verify signature generation

### Schwab OAuth Issues

1. **Callback URL Mismatch**:
   - Ensure exact match in Schwab portal and Vercel env vars
   - No trailing slash

2. **Token Expiration**:
   - Tokens expire after 30 minutes
   - Refresh token valid for 7 days

---

## ✨ FEATURES STATUS

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | ✅ Working | All KPIs and charts functional |
| Trade Journal | ✅ Working | Inline editing, images supported |
| Analytics | ✅ Working | All chart types rendering |
| Calendar | ✅ Working | Daily modal with trade breakdown |
| HeroFX Quick Paste | ✅ Working | Multi-line format supported |
| Schwab CSV | ✅ Working | Realized Gain/Loss format |
| Schwab OAuth | ⚠️ Needs Testing | Requires callback URL update |
| MEXC Futures API | 🔧 In Progress | Enhanced debugging added |
| MEXC Spot API | ⏸️ On Hold | Blocked by Futures issue |
| AI Insights | ✅ Working | Requires Gemini API key |
| CSV Imports | ✅ Working | All major exchanges supported |
| Duplicate Detection | ✅ Working | Content-based matching |

---

**Last Updated**: January 9, 2026  
**Deployment Status**: Live in Production  
**Next Priority**: Fix MEXC Futures signature validation

