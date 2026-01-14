# Scheduled Auto-Sync Setup

## Overview

Automated trade syncing runs on a schedule to keep all users' trades up-to-date without manual intervention.

## Schedule (EST/EDT)

| Time | Day(s) | Purpose |
|------|--------|---------|
| **8:31 AM** | Monday | Weekend catchup sync |
| **Every hour 9 AM - 3 PM** | Mon-Fri | During market hours |
| **3:30 PM** | Mon-Fri | Market close final sync |

**Total:** ~9 syncs per day during market hours

## Setup Instructions

### 1. Add Environment Variable in Vercel

Go to your Vercel Project → Settings → Environment Variables

Add:
- **Name:** `CRON_SECRET`
- **Value:** Generate a random string (e.g., use `openssl rand -hex 32`)
- **Environments:** Production, Preview, Development

### 2. Add Supabase Service Role Key

Also add (if not already present):
- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Your Supabase service role key (from Supabase → Settings → API)
- **Environments:** Production

### 3. Deploy

```bash
git add .
git commit -m "feat: add scheduled auto-sync"
git push origin main
```

Vercel will automatically deploy and activate the cron jobs.

### 4. Verify

After deployment, check:
1. **Vercel Dashboard** → Your Project → **Cron Jobs**
2. You should see 3 cron jobs listed
3. Check **Function Logs** after the scheduled time to see if it ran

## How It Works

### Security
- Endpoint is protected by `CRON_SECRET` header
- Only Vercel's cron service can call it

### Sync Process
For each user in the database:
1. Check if they have Schwab OAuth tokens
2. Check if they have MEXC API credentials
3. Fetch new trades from each configured exchange
4. Store trades in Supabase (deduplication handled automatically)

### Error Handling
- Failed syncs for individual users don't stop the entire process
- Errors are logged to Vercel Function Logs
- Summary includes success/failure for each user

## Monitoring

View sync results in **Vercel Function Logs**:
```
[Cron] Starting scheduled sync at 2026-01-14T14:00:00.000Z
[Cron] Found 5 users to sync
[Cron] Syncing user: user@example.com
[Cron] Sync complete: {
  "usersProcessed": 5,
  "totalTradesAdded": 23
}
```

## Manual Trigger

For testing, you can manually trigger the sync:

```bash
curl -X GET "https://your-app.vercel.app/api/cron/sync-all-users?secret=YOUR_CRON_SECRET"
```

## Troubleshooting

### Cron not running?
- Check **Vercel Dashboard** → Cron Jobs tab
- Ensure `CRON_SECRET` is set in environment variables
- Check function logs for errors

### Syncs failing?
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify user credentials are valid (Schwab tokens not expired)
- Review error messages in logs

### Too many API calls?
- Current schedule: ~180 API calls/month per user
- Schwab limit: 120 calls/minute (plenty of headroom)
- MEXC limit: 1000 calls/minute (plenty of headroom)

## Cron Schedule Format

```
31 13 * * 1        = Every Monday at 13:31 UTC (8:31 AM EST)
0 14-20 * * 1-5    = Every hour from 14:00-20:00 UTC, Mon-Fri (9 AM - 3 PM EST)
30 20 * * 1-5      = Every weekday at 20:30 UTC (3:30 PM EST)
```

Note: Times are in UTC. EST = UTC-5, EDT = UTC-4.

## Maintenance

### Adjusting Schedule

Edit `vercel.json` crons section and redeploy:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-all-users",
      "schedule": "0 14 * * *"  // Daily at 2 PM UTC
    }
  ]
}
```

### Disabling Auto-Sync

1. Remove or comment out the `crons` section in `vercel.json`
2. Redeploy

Or delete the cron jobs in Vercel Dashboard.
