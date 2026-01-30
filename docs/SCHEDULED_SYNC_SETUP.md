# Scheduled Auto-Sync Setup

## Overview

Automated trade syncing runs on a schedule to keep all users' trades up-to-date without manual intervention.

## Schedule

| Time (UTC) | Time (CST/CDT) | Day(s) | Purpose |
|------------|----------------|--------|---------|
| **9:30 PM** | **3:30 PM** | Daily | After market close sync |

**Note:** Runs every day (including weekends) to catch any settlement or adjustment transactions.

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
1. Check if they have Schwab OAuth tokens (specifically, a `refresh_token`)
2. **Refresh the access token** - Schwab tokens expire after 30 minutes, so the cron job refreshes tokens before each API call
3. **Update tokens in database** - New access/refresh tokens are saved for future syncs
4. Fetch last 180 days of trades from Schwab (includes expired options detection)
5. Check if they have MEXC API credentials
6. Fetch MEXC Futures and Spot trades
7. Store/update trades in Supabase (deduplication via `externalOid` and fingerprinting)

### Error Handling
- Failed syncs for individual users don't stop the entire process
- Errors are logged to Vercel Function Logs
- Summary includes success/failure for each user

## Monitoring

View sync results in **Vercel Function Logs**:
```
[Cron] Starting scheduled sync at 2026-01-30T21:30:00.000Z
[Cron] Found 2 users to sync
[Cron] Syncing user: user@example.com
[Cron] Refreshing Schwab token for user@example.com
[Cron] Fetched 145 Schwab transactions for user@example.com
[Cron] Mapped to 42 trades for user@example.com
[Cron] Sync complete: {
  "usersProcessed": 2,
  "totalTradesAdded": 42
}
```

## Manual Trigger

For testing, you can manually trigger the sync:

```bash
curl -X GET "https://your-app.vercel.app/api/schwab/syncusers?secret=YOUR_CRON_SECRET"
```

## Troubleshooting

### Cron not running?
- Check **Vercel Dashboard** → Cron Jobs tab
- Ensure `CRON_SECRET` is set in environment variables
- Check function logs for errors

### Syncs failing?
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Check `SCHWAB_CLIENT_ID` and `SCHWAB_CLIENT_SECRET` are set (required for token refresh)
- If you see "Token refresh failed: 401" in logs, the user's refresh token has expired (7-day lifetime) - they need to re-authenticate via the Settings page
- Review error messages in logs for specific user failures

### Too many API calls?
- Current schedule: ~180 API calls/month per user
- Schwab limit: 120 calls/minute (plenty of headroom)
- MEXC limit: 1000 calls/minute (plenty of headroom)

## Cron Schedule Format

Current schedule in `vercel.json`:
```
30 21 * * *        = Every day at 21:30 UTC (3:30 PM CST / 4:30 PM CDT)
```

Format: `minute hour day month weekday`
- `*` = every value
- `1-5` = Monday through Friday only

Note: Times are in UTC. CST = UTC-6, CDT = UTC-5.

## Maintenance

### Adjusting Schedule

Edit `vercel.json` crons section and redeploy:

```json
{
  "crons": [
    {
      "path": "/api/schwab/syncusers",
      "schedule": "30 21 * * *"  // Daily at 9:30 PM UTC (3:30 PM CST)
    }
  ]
}
```

### Disabling Auto-Sync

1. Remove or comment out the `crons` section in `vercel.json`
2. Redeploy

Or delete the cron jobs in Vercel Dashboard.
