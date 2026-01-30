# Documentation Guidelines

This guide ensures consistent documentation practices across Claude sessions.

## When to Update Documentation

Update documentation after:

1. **Bug Fixes** - Especially ones that took investigation to discover
2. **New Features** - Any user-facing functionality
3. **Architecture Changes** - How components interact
4. **API Changes** - Endpoints, request/response formats
5. **Configuration Changes** - Environment variables, vercel.json, etc.
6. **Major Discoveries** - "Aha!" moments about how something works

## Files to Update

### CHANGELOG.md (Root)
**Purpose**: Track all notable changes for users and developers

**When**: After every fix, feature, or improvement that gets committed

**Format**:
```markdown
## [vX.X.X] - YYYY-MM-DD

### Category (Fixed/Added/Changed/Removed)

**Problem**: What was broken or missing
**Solution**: What was done to fix it
**Technical Details**: Key files and line numbers
**Impact**: What users/developers will notice

**Files Modified**:
- `path/to/file.ts` - Brief description of change
```

### docs/SCHEDULED_SYNC_SETUP.md
**Purpose**: How the automated daily sync works

**Update when**: Any changes to:
- Cron schedule or endpoint
- Sync process flow
- Token handling
- Error handling
- Environment variables

### docs/ Feature Specs
**Purpose**: Technical specifications for major features

**Existing specs**:
- `CALENDAR_PAGE_TECHNICAL_SPEC.md`
- `ANALYTICS_PAGE_SPECIFICATION.md`
- `TIME_RANGE_FILTER_IMPLEMENTATION.md`
- `DEMO_DATA_GENERATOR.md`

**Update when**: Implementation differs from spec or new edge cases discovered

## Information to Include

### For Bug Fixes

1. **Root Cause** - Why it was broken (not just what was broken)
2. **Investigation Path** - How you found it (helps future debugging)
3. **The Fix** - What specifically changed
4. **Verification** - How to confirm it's fixed

Example:
```markdown
**Problem**: Daily sync wasn't processing trades

**Root Cause**: Schwab access tokens expire after 30 minutes. The cron job
was using stored tokens directly without refreshing, so by runtime they
were always expired (401 errors).

**Investigation**:
1. Read syncusers.ts - found it used access_token directly
2. Read transactions.ts - saw it returns 401 for expired tokens
3. Found refresh.ts endpoint existed but wasn't being called

**Fix**: Added token refresh step before API calls in syncusers.ts:
- Lines 82-96: Call /api/schwab/refresh
- Lines 102-117: Save new tokens to database
- Line 127: Use fresh token for API call

**Verification**: Check Vercel logs after next scheduled sync for
"Refreshing Schwab token" message followed by successful transaction fetch.
```

### For New Features

1. **User Story** - What can users now do?
2. **How It Works** - Technical overview
3. **Key Files** - Where to find the code
4. **Configuration** - Any env vars or settings needed

### For Architecture/API Changes

1. **Before/After** - What changed
2. **Migration** - Any steps needed for existing deployments
3. **Breaking Changes** - What might break

## Code Comments vs Documentation

**Use code comments for**:
- Complex algorithms
- Non-obvious business logic
- "Why" explanations that aren't clear from code

**Use documentation files for**:
- Setup and configuration
- Cross-file workflows
- Debugging guides
- User-facing feature explanations

## Key Project Knowledge

### Token Lifetimes
- Schwab access token: **30 minutes**
- Schwab refresh token: **7 days**
- MEXC API keys: **No expiration** (until revoked)

### Sync Windows
- Default: **180 days** of trade history
- Configurable via startDate/endDate query params

### Critical Files

| Area | File | Purpose |
|------|------|---------|
| Cron Sync | `api/schwab/syncusers.ts` | Daily automated sync |
| Token Refresh | `api/schwab/refresh.ts` | Exchange refresh token for new access token |
| Transactions | `api/schwab/transactions.ts` | Fetch raw Schwab transactions |
| Trade Mapping | `api/utils/schwabTransactions.ts` | Convert transactions to trades (FIFO, expired options) |
| Frontend Sync | `src/context/TradeContext.tsx` | Manual sync from UI |

### Environment Variables

| Variable | Purpose | Required For |
|----------|---------|--------------|
| `CRON_SECRET` | Protects cron endpoint | Daily sync |
| `SCHWAB_CLIENT_ID` | Schwab OAuth | Token refresh |
| `SCHWAB_CLIENT_SECRET` | Schwab OAuth | Token refresh |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access | Cron sync |
| `VITE_SUPABASE_URL` | Supabase connection | All |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase key | Frontend |

## Commit Message Conventions

```
type: short description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Types**:
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation only
- `refactor:` - Code changes that don't fix bugs or add features
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

## After Making Changes

1. Update relevant docs (this checklist helps):
   - [ ] CHANGELOG.md entry added?
   - [ ] Feature-specific doc updated?
   - [ ] Code comments for complex logic?
   - [ ] Environment variables documented?

2. Commit with descriptive message

3. Push to trigger Vercel deployment

4. Verify in Vercel logs (for backend changes)
