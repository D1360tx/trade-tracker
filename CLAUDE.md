# Trade Tracker - Claude Session Context

This file contains essential context for Claude Code sessions. Read this first when starting a new session.

## Project Overview

Trade Tracker is a trading journal and analytics application that syncs trades from multiple exchanges (Schwab, MEXC, ByBit) and provides P&L tracking, calendar views, and performance analytics.

**Live URL**: https://trade-tracker-eight.vercel.app

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS with CSS variables for theming
- **Backend**: Vercel Serverless Functions (in `/api` directory)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Charts**: Recharts

## Key Directories

```
/api                    # Vercel serverless functions
  /schwab               # Schwab OAuth and sync endpoints
    syncusers.ts        # Daily cron job for auto-sync
    transactions.ts     # Fetch transactions from Schwab API
    refresh.ts          # Token refresh endpoint
  /utils
    schwabTransactions.ts  # Maps Schwab transactions to trades
/src
  /pages                # Main app pages
    /v2                 # V2 redesigned pages (Dashboard V2, Reports V2)
  /components
    /v2                 # V2 components
      /dashboard        # Dashboard V2 components
  /context
    TradeContext.tsx    # Global trade state and sync logic
  /hooks/v2             # V2 custom hooks
/docs                   # Documentation
```

## Daily Auto-Sync (Cron Job)

**Schedule**: 9:30 PM UTC daily (3:30 PM CST / 4:30 PM CDT)

**Endpoint**: `/api/schwab/syncusers`

**Flow**:
1. Vercel cron triggers the endpoint
2. For each user with Schwab tokens:
   - Refresh access token (they expire after 30 minutes)
   - Save new tokens to database
   - Fetch last 180 days of transactions
   - Map to trades using `mapSchwabTransactionsToTrades()`
   - Upsert to database

**Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/schwab/syncusers",
      "schedule": "30 21 * * *"
    }
  ]
}
```

## Critical Token Information

| Token Type | Lifetime | Notes |
|------------|----------|-------|
| Schwab Access Token | 30 minutes | Must refresh before API calls |
| Schwab Refresh Token | 7 days | User must re-authenticate if expired |
| MEXC API Keys | No expiration | Until manually revoked |

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Protects cron endpoint |
| `SCHWAB_CLIENT_ID` | Schwab OAuth |
| `SCHWAB_CLIENT_SECRET` | Schwab OAuth |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access for cron |
| `VITE_SUPABASE_URL` | Supabase connection |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase key |

## Recent Fixes (As of 2026-02-03)

### 1. Cron Sync Module Resolution (84e1a68)
**Problem**: Vercel ESM couldn't find `schwabTransactions` module
**Fix**: Added `.js` extension to import in `syncusers.ts`
```typescript
import { mapSchwabTransactionsToTrades } from '../utils/schwabTransactions.js';
```

### 2. Token Refresh in Cron (b6381c9)
**Problem**: Cron used expired access tokens (30-min lifetime)
**Fix**: Added token refresh step before API calls, saves new tokens to DB

### 3. Layout Width Constraints
**Problem**: Removing max-width from Layout broke Calendar page
**Fix**: Each page now has its own `max-w-7xl mx-auto` constraint

## Dashboard V2 Layout

The V2 dashboard uses a 3:1 grid (75% calendar, 25% sidebar):

```
┌─────────────────────────────────┬──────────────┐
│  Top Stats Bar (4 cards)                       │
├─────────────────────────────────┬──────────────┤
│                                 │ Week 1-5 P&L │
│     Monthly Calendar            ├──────────────┤
│     (expands to fill height)    │ Recent Trades│
│                                 ├──────────────┤
│                                 │ Cumulative   │
│                                 │ P&L Chart    │
├─────────────────────────────────┴──────────────┤
│  Yearly Calendar Grid                          │
├────────────────────────┬───────────────────────┤
│ Win% / Avg Win/Loss    │ Trade Time Performance│
└────────────────────────┴───────────────────────┘
```

**Key Components**:
- `MonthlyCalendarV2.tsx` - Calendar with expandable cells
- `WeeklySidebar.tsx` - Week summaries, recent trades, cumulative chart
- `YearlyCalendarGrid.tsx` - Year heatmap
- `BottomStatsCards.tsx` - Win rate and time performance charts
- `TopStatsBar.tsx` - Avg win/loss, profit factor, win %, account balance

## Testing the Cron Sync

Manual trigger:
```bash
curl -X GET "https://trade-tracker-eight.vercel.app/api/schwab/syncusers?secret=YOUR_CRON_SECRET"
```

Check Vercel logs: Dashboard → Project → Logs → filter "syncusers"

## Common Issues & Solutions

### "Cannot find module" in Vercel
- Add `.js` extension to relative imports in `/api` files
- Vercel ESM requires explicit extensions

### Cron not running
- Check `CRON_SECRET` is set in Vercel env vars
- Check Vercel Dashboard → Cron Jobs tab
- Hobby plan: max 1 cron job, once per day

### Token refresh failed (401)
- User's refresh token expired (7-day limit)
- User needs to re-authenticate via Settings page

### Calendar cells cut off on wide screens
- Pages need `max-w-7xl mx-auto` on their root div
- Layout.tsx no longer provides this constraint

## Documentation Files

- `docs/DOCUMENTATION_GUIDELINES.md` - How to update docs after changes
- `docs/SCHEDULED_SYNC_SETUP.md` - Cron job setup and troubleshooting
- `CHANGELOG.md` - Version history and release notes

## Git Workflow

Commit message format:
```
type: short description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `fix:`, `feat:`, `docs:`, `refactor:`, `perf:`, `chore:`

## Current Branch State

Check for unpushed commits:
```bash
git status
git log origin/main..HEAD --oneline
```
