# Vercel Deployment Guide

## Prerequisites

1. **Run the SQL migrations in Supabase**:
   - Go to your Supabase dashboard: https://supabase.com/dashboard/project/iwwalsauixbaupmvesna/sql
   - Run `supabase/migrations/001_initial_schema.sql`
   - Run `supabase/migrations/002_api_credentials.sql`

2. **Vercel account** with the project connected to this GitHub repo

---

## Environment Variables for Vercel

Add these in **Vercel Dashboard → Project Settings → Environment Variables**:

```
VITE_SUPABASE_URL=https://iwwalsauixbaupmvesna.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_oST0YM2_D_PgC5-1mMoA3g_6ckI_-3V
```

**Note:** Make sure to add them for all environments (Production, Preview, Development)

---

## Deployment Steps

### Option 1: Auto-Deploy (Recommended)
1. Push to `main` branch (already done!)
2. Vercel will auto-deploy
3. Wait for build to complete (~2-3 minutes)
4. Done!

### Option 2: Manual Deploy
```bash
# From your local machine
npm run build
vercel --prod
```

---

## Vercel CLI

The Vercel CLI is installed and configured for this project. Use these commands to check deployment status:

```bash
# Check login status
vercel whoami

# List recent deployments
vercel ls

# View deployment logs (replace URL with deployment URL from vercel ls)
vercel logs https://trade-tracker-xxxxx-d1360txs-projects.vercel.app

# Trigger a production deployment manually
vercel --prod

# View environment variables
vercel env ls
```

**Note:** Deployments happen automatically on push to `main` via GitHub integration.

---

## Post-Deployment Checklist

### 1. **Test Authentication**
- Visit your Vercel URL
- You should be redirected to `/auth/login`
- Try signing up with a new account
- Confirm login works

### 2. **Run Data Migration**
- Log in to your account
- Go to **Settings**
- Scroll to "Data Migration" section
- Click "Start Migration" to import your localStorage data
- Wait for success message
- Page will auto-reload

### 3. **Verify Data**
- Check that your trades appear in the Journal
- Verify strategies and mistakes loaded
- Test adding a new trade (should save to Supabase)

### 4. **Save API Credentials**
- Go to Settings
- Select an exchange (e.g., MEXC)
- Enter API Key and Secret
- Click "Save Changes"
- API keys now saved to Supabase (not localStorage!)

---

## Multi-Device Access

Once deployed, you can access your account from:
- ✅ **Desktop browser** (any computer)
- ✅ **Mobile browser** (phone/tablet)
- ✅ **Work computer**
- ✅ **Multiple browser tabs** (real-time sync!)

Just log in with the same email/password everywhere.

---

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure environment variables are set
- Try `npm run build` locally first

### Can't Login After Deploy
- Verify Supabase URLs are correct
- Check browser console for errors
- Try clearing browser cache

### Data Not Syncing
- Check Supabase dashboard for RLS policies
- Verify user is authenticated (check browser devtools)
- Check Network tab for failed API calls

---

## What's Different from Localhost

| Feature | Localhost | Vercel Production |
|---------|-----------|-------------------|
| URL | `localhost:5174` | `your-app.vercel.app` |
| Data Storage | Supabase Cloud | Supabase Cloud |
| Authentication | Supabase | Supabase |
| API Keys | Supabase | Supabase |
| Build | Dev server | Optimized production |

Everything else works exactly the same!

---

## Next Steps

After successful deployment:
1. **Bookmark your Vercel URL**
2. **Test on mobile browser**
3. **Share with team** (if applicable)
4. **Set up custom domain** (optional)

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Check browser console
4. Review this guide

**All code is pushed to GitHub and ready for deployment!** 🚀
