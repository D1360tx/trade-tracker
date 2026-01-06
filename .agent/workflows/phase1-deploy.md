---
description: Phase 1 Production Deployment Checklist
---

# Phase 1: Deploy Trade Tracker to Vercel

**Goal**: Get the app live and enable Schwab OAuth  
**Timeline**: 1-2 hours  
**Status**: Ready to Start

---

## ✅ Pre-Deployment Checklist

### 1. Environment Variables Ready
- [ ] `VITE_OPENAI_API_KEY` - Your OpenAI API key
- [ ] `SCHWAB_CLIENT_ID` - From Schwab Developer Portal
- [ ] `SCHWAB_CLIENT_SECRET` - From Schwab Developer Portal
- [ ] `SCHWAB_CALLBACK_URL` - Will be updated after deployment

### 2. Build Test (Critical!)
```bash
# Test production build locally
npm run build

# Preview the build
npm run preview
```
Expected: No errors, app loads at http://localhost:4173

### 3. Check Vercel Configuration
File: `vercel.json` - Already configured ✓

---

## 🚀 Deployment Steps

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```
Follow prompts to authenticate

### Step 3: Deploy to Production
// turbo
```bash
cd /Users/d1360/.gemini/antigravity/scratch/trade_tracker
vercel --prod
```

**Interactive prompts:**
1. Set up and deploy? → **Yes**
2. Scope? → Select your account
3. Link to existing project? → **No** (first time)
4. Project name? → `trade-tracker` (or your choice)
5. Directory? → `./` (press Enter)
6. Build settings? → **Yes** (auto-detected)
7. Deploy? → **Yes**

### Step 4: Note Your Production URL
After deploy completes:
```
✅ Production: https://trade-tracker-xxx.vercel.app
```
**Copy this URL!** You'll need it next.

---

## 🔐 Configure Environment Variables

### Step 5: Add Environment Variables in Vercel Dashboard

Go to: **https://vercel.com/your-username/trade-tracker/settings/environment-variables**

Add these variables (for **Production** environment):

| Key | Value | Where to Get It |
|-----|-------|-----------------|
| `VITE_OPENAI_API_KEY` | `your_key_here` | OpenAI Platform |
| `SCHWAB_CLIENT_ID` | `your_client_id` | Schwab Developer Portal |
| `SCHWAB_CLIENT_SECRET` | `your_secret_here` | Schwab Developer Portal |
| `SCHWAB_CALLBACK_URL` | `https://YOUR-APP.vercel.app/api/schwab/callback` | Use your Vercel URL |

**⚠️ Important:** After adding variables, you MUST redeploy:
```bash
vercel --prod
```

---

## 🔗 Update Schwab Developer Portal

### Step 6: Add Production Callback URL

1. Go to: **https://developer.schwab.com**
2. Login and select your app
3. **Redirect URIs** section:
   - Add: `https://YOUR-APP.vercel.app/api/schwab/callback`
   - Keep localhost for development: `http://localhost:5173/api/schwab/callback`
4. **Save changes**

---

## 🧪 Verification & Testing

### Step 7: Test Production Deployment

Visit: `https://YOUR-APP.vercel.app`

**Test Checklist:**
- [ ] App loads without errors
- [ ] All pages render (Dashboard, Journal, Import, etc.)
- [ ] Console has no errors (F12 → Console)
- [ ] LocalStorage works (import a trade)
- [ ] Schwab OAuth flow works:
  1. Go to Import page
  2. Click "Connect to Schwab"
  3. Login to Schwab
  4. Authorize the app
  5. Should redirect back with trades

### Step 8: Test Quick Paste Import
- [ ] Paste TradeLocker/HeroFX data
- [ ] Import successfully
- [ ] Trades show correct P&L and ROI

---

## 📊 Post-Deployment

### Step 9: Update README
Add your deployment URL to README.md:

```markdown
## 🌐 Live Demo

Visit the live app: **https://YOUR-APP.vercel.app**
```

Commit and push:
```bash
git add README.md
git commit -m "docs: Add production URL to README"
git push
```

### Step 10: Enable Vercel Analytics (Optional)

In Vercel Dashboard → Analytics → Enable

Benefits:
- See visitor stats
- Monitor performance
- Track Core Web Vitals

---

## 🎯 Success Criteria

Phase 1 is complete when:
- ✅ App is live at production URL
- ✅ No console errors
- ✅ Schwab OAuth works end-to-end
- ✅ Can import trades (CSV + Quick Paste)
- ✅ Data persists in localStorage
- ✅ All charts and analytics work

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Check for TypeScript errors
npm run build

# Look for errors in output
```

### Schwab OAuth Doesn't Work
1. Check callback URL matches exactly (no trailing slash)
2. Verify environment variables are set in Vercel
3. Redeploy after adding env vars
4. Check Schwab Developer Portal has production URL

### App Doesn't Load
1. Check browser console for errors
2. Verify build succeeded in Vercel dashboard
3. Check deployment logs in Vercel

### Missing Environment Variables
Run another deployment to pick up new variables:
```bash
vercel --prod
```

---

## 📝 Notes

- Vercel auto-deploys on `git push` to main branch
- Free tier: 100GB bandwidth/month (more than enough)
- SSL/HTTPS automatically configured
- Global CDN for fast loading worldwide

---

## 🎉 What's Next?

After Phase 1 succeeds:
- ✅ App is live and working
- ✅ Schwab integration functional
- ✅ Ready for Phase 2: Database Migration (Supabase)

**Ready to deploy? Run the commands above!**
