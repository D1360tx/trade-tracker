# Supabase Account Setup Guide

## Step 1: Create Your Supabase Account

1. **Go to Supabase**
   - Visit: https://supabase.com
   - Click **"Start your project"** (green button)

2. **Sign Up**
   - Use **GitHub** (recommended - easiest)
   - OR use email/password

3. **Verify Email** (if using email signup)
   - Check your inbox
   - Click the verification link

---

## Step 2: Create a New Project

1. **Click "New Project"** (or it might auto-prompt)

2. **Fill in Project Details:**
   ```
   Organization: [Auto-created or select existing]
   Name: trade-tracker
   Database Password: [Generate a strong password - SAVE THIS!]
   Region: [Choose closest to you - e.g., "US West" or "US East"]
   Pricing Plan: Free
   ```

3. **Click "Create new project"**
   - Wait 2-3 minutes for setup (it's creating your database)

---

## Step 3: Get Your API Credentials

Once your project is ready:

1. **Click on "Project Settings"** (gear icon in left sidebar)

2. **Click "API"** in the settings menu

3. **Copy These Values:**

   **Project URL:**
   ```
   Example: https://abcdefghijklmno.supabase.co
   ```

   **anon/public key:**
   ```
   Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   (This is a long JWT token - copy the entire thing)
   ```

   ⚠️ **DO NOT COPY THE "service_role" KEY** - We only need the "anon public" key

---

## Step 4: Send Me the Credentials

Once you have them, reply with:

```
URL: https://[your-project].supabase.co
ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security Note:** The anon key is safe to share in client code - Supabase uses Row Level Security to protect your data.

---

## Optional: Enable Additional Auth Providers (Later)

You can do this now or later:

1. **Go to Authentication → Providers** (in left sidebar)
2. **Enable providers you want:**
   - ✅ Email (enabled by default)
   - Google (requires OAuth setup)
   - GitHub (requires OAuth setup)
   - Magic Link (passwordless email)

For now, **Email/Password** is perfectly fine. We can add others later!

---

## What I'll Do Next

Once you send me the URL and ANON_KEY, I will:

1. ✅ Install Supabase SDK
2. ✅ Set up environment variables
3. ✅ Create the database schema (all 8 tables)
4. ✅ Configure Row Level Security policies
5. ✅ Build the authentication system
6. ✅ Create the migration tool
7. ✅ Start building the cloud-sync features

---

## Estimated Time

- **Your part:** 5-10 minutes
- **My part:** Will start immediately after you send credentials

---

**Ready?** Head to https://supabase.com and let me know once you have your URL and anon key! 🚀
