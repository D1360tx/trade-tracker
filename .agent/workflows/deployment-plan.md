---
description: Complete deployment and production setup plan for Trade Tracker
---

# Trade Tracker: Production Deployment Plan

**Created**: January 3, 2026  
**Status**: Planning Phase  
**Estimated Total Effort**: 15-20 hours across all phases

---

## Executive Summary

This document outlines the complete plan to deploy Trade Tracker to production with:
- Schwab OAuth integration (requires live deployment)
- User authentication system
- Cloud database backend
- Scalable infrastructure

---

## Technology Stack Comparison

### Hosting Platforms

| Platform | Ease of Setup | Stability | Scalability | Free Tier | Monthly Cost (Paid) | Verdict |
|----------|--------------|-----------|-------------|-----------|---------------------|---------|
| **Vercel** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Generous (100GB BW) | $20/mo Pro | **RECOMMENDED** |
| Netlify | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Generous (100GB BW) | $19/mo Pro | Great alternative |
| AWS Amplify | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 12 months free | ~$5-20/mo | Enterprise option |
| Railway | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $5 credit | $5+/mo usage | Good for full-stack |
| Render | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Limited | $7+/mo | Alternative |

**Winner: Vercel**
- Best DX for React/Vite apps
- Automatic preview deployments
- Serverless functions built-in (for API routes)
- Git integration (push to deploy)
- Edge network for fast global delivery

---

### Database & Backend

| Platform | Ease of Setup | Stability | Scalability | Free Tier | Paid Cost | Auth Built-in | Verdict |
|----------|--------------|-----------|-------------|-----------|-----------|---------------|---------|
| **Supabase** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 500MB DB, 2 projects | $25/mo Pro | ✅ Yes | **RECOMMENDED** |
| Firebase | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Generous | Pay-as-you-go | ✅ Yes | Great alternative |
| PlanetScale | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 5GB storage | $29/mo | ❌ No | DB only |
| Neon | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 0.5GB + branching | $19/mo | ❌ No | Serverless Postgres |
| AWS DynamoDB | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 25GB | Pay-as-you-go | ❌ No | Complex setup |
| MongoDB Atlas | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 512MB | $9+/mo | ❌ No | NoSQL option |

**Winner: Supabase**
- PostgreSQL (SQL is better for trading data relationships)
- Built-in authentication (email, OAuth, magic links)
- Real-time subscriptions (sync across devices)
- Row-Level Security (RLS) for multi-tenancy
- REST API auto-generated
- Dashboard for data management

---

### Authentication Providers (Standalone)

If using separate auth (instead of Supabase Auth):

| Provider | Ease of Setup | Free Tier | Paid Cost | Features |
|----------|--------------|-----------|-----------|----------|
| Clerk | ⭐⭐⭐⭐⭐ | 10k MAU | $25/mo | Beautiful UI, webhooks |
| Auth0 | ⭐⭐⭐⭐ | 7k MAU | $23/mo | Enterprise features |
| Firebase Auth | ⭐⭐⭐⭐ | Unlimited free | Free | Google integration |
| Supabase Auth | ⭐⭐⭐⭐⭐ | 50k MAU | Included | Integrated with DB |

**Winner: Supabase Auth** (bundled with database)

---

## Final Technology Recommendation

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend Hosting:     Vercel (Free tier)                   │
│  Database:             Supabase PostgreSQL (Free tier)      │
│  Authentication:       Supabase Auth (Free tier)            │
│  API Routes:           Vercel Serverless Functions          │
│  File Storage:         Supabase Storage (for screenshots)   │
│  Domain:               yourname.vercel.app (free)           │
│                        OR custom domain (~$12/year)         │
├─────────────────────────────────────────────────────────────┤
│  TOTAL COST (Start):   $0/month                             │
│  TOTAL COST (Scale):   ~$45/month (Pro tiers)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### 📦 Phase 1: Basic Deployment (Day 1)
**Goal**: Get the app live, enable Schwab OAuth

#### 1.1 Vercel Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
cd /path/to/trade_tracker
vercel
```

#### 1.2 Environment Variables on Vercel
Set these in Vercel Dashboard → Settings → Environment Variables:
- `SCHWAB_CLIENT_ID`
- `SCHWAB_CLIENT_SECRET`
- `SCHWAB_CALLBACK_URL` (update to production URL)
- `GEMINI_API_KEY` (for AI features)

#### 1.3 Update Schwab Developer Portal
- Add production callback URL: `https://your-app.vercel.app/api/schwab/callback`
- Update app settings

#### 1.4 Verify Deployment
- [ ] App loads correctly
- [ ] Schwab OAuth flow works
- [ ] All pages render
- [ ] LocalStorage works in production

**Deliverable**: Live app at `https://your-app.vercel.app`  
**Effort**: 1-2 hours

---

### 📦 Phase 2: Database Backend (Day 2-3)
**Goal**: Persist data in cloud database instead of localStorage

#### 2.1 Supabase Project Setup
1. Create account at supabase.com
2. Create new project (region: closest to you)
3. Note the following credentials:
   - Project URL
   - Anon/Public Key
   - Service Role Key (for server-side)

#### 2.2 Database Schema
```sql
-- Users table (auto-created by Supabase Auth)

-- Trades table
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('STOCK', 'OPTION', 'CRYPTO', 'FOREX', 'FUTURES', 'SPOT')),
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    entry_price DECIMAL(18, 8) NOT NULL,
    exit_price DECIMAL(18, 8) NOT NULL,
    quantity DECIMAL(18, 8) NOT NULL,
    entry_date TIMESTAMPTZ NOT NULL,
    exit_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    pnl DECIMAL(18, 2) NOT NULL,
    pnl_percentage DECIMAL(10, 4),
    fees DECIMAL(18, 2) DEFAULT 0,
    notes TEXT,
    strategy_id UUID,
    mistakes TEXT[],
    initial_risk DECIMAL(18, 2),
    is_bot BOOLEAN DEFAULT FALSE,
    leverage INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategies table
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mistakes table
CREATE TABLE mistakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Credentials table (encrypted)
CREATE TABLE api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, exchange)
);

-- Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can CRUD their own trades"
    ON trades FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own strategies"
    ON strategies FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own mistakes"
    ON mistakes FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own credentials"
    ON api_credentials FOR ALL
    USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_exit_date ON trades(exit_date DESC);
CREATE INDEX idx_trades_exchange ON trades(exchange);
```

#### 2.3 Install Supabase Client
```bash
npm install @supabase/supabase-js
```

#### 2.4 Create Supabase Client
```typescript
// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

#### 2.5 Update TradeContext
- Replace localStorage reads/writes with Supabase queries
- Add real-time subscription for cross-device sync
- Implement optimistic updates for better UX

#### 2.6 Migration Script
Create a one-time migration to move localStorage data to Supabase:
```typescript
const migrateFromLocalStorage = async () => {
    const localTrades = JSON.parse(localStorage.getItem('trade_tracker_trades') || '[]');
    if (localTrades.length > 0) {
        await supabase.from('trades').insert(localTrades.map(t => ({
            ...t,
            user_id: currentUser.id
        })));
        localStorage.removeItem('trade_tracker_trades');
    }
};
```

**Deliverable**: Data persists in Supabase, localStorage as fallback  
**Effort**: 4-6 hours

---

### 📦 Phase 3: User Authentication (Day 4-5)
**Goal**: Allow multiple users with secure login

#### 3.1 Enable Auth Providers in Supabase
Dashboard → Authentication → Providers:
- Email/Password (default)
- Google OAuth (optional)
- GitHub OAuth (optional)

#### 3.2 Create Auth Context
```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // ... auth methods

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
```

#### 3.3 Create Auth Pages
- `/login` - Sign in page
- `/signup` - Registration page
- `/forgot-password` - Password reset

#### 3.4 Protected Routes
```typescript
// src/components/ProtectedRoute.tsx
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    
    if (loading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/login" />;
    
    return children;
};
```

#### 3.5 Update App.tsx
```typescript
<AuthProvider>
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/*" element={
            <ProtectedRoute>
                <Dashboard />
            </ProtectedRoute>
        } />
    </Routes>
</AuthProvider>
```

**Deliverable**: Full authentication system  
**Effort**: 4-6 hours

---

### 📦 Phase 4: Production Polish (Day 6-7)
**Goal**: Production-ready application

#### 4.1 Security Hardening
- [ ] Environment variables in Vercel (not in code)
- [ ] API key encryption in database
- [ ] Rate limiting on API routes
- [ ] Input validation/sanitization
- [ ] CORS configuration

#### 4.2 Performance Optimization
- [ ] Enable Vercel Analytics
- [ ] Implement pagination for trade lists
- [ ] Add loading states/skeletons
- [ ] Image optimization (screenshots)

#### 4.3 Error Handling
- [ ] Global error boundary
- [ ] Toast notifications for errors
- [ ] Logging (Sentry or similar)

#### 4.4 Final Deployment Checklist
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Auth providers configured
- [ ] Schwab callback URL updated
- [ ] Custom domain configured (optional)
- [ ] SSL certificate verified
- [ ] Test all critical flows

**Deliverable**: Production-ready application  
**Effort**: 3-4 hours

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Deploy | Day 1 (2 hours) | None |
| Phase 2: Database | Days 2-3 (6 hours) | Phase 1 |
| Phase 3: Auth | Days 4-5 (6 hours) | Phase 2 |
| Phase 4: Polish | Days 6-7 (4 hours) | Phase 3 |

**Total Estimated Effort**: 18 hours over ~1 week

---

## Cost Summary

### Free Tier Limits (Sufficient for Personal Use)

| Service | Free Tier Limit | Typical Usage |
|---------|-----------------|---------------|
| Vercel | 100GB bandwidth, 100 deploys | ✅ More than enough |
| Supabase | 500MB storage, 2 projects | ✅ ~10k trades |
| Supabase Auth | 50k monthly active users | ✅ Personal use |

### Paid Scaling (If Needed)

| Scenario | Monthly Cost |
|----------|--------------|
| Personal use | **$0** |
| Small team (5 users) | **$0** |
| Launch with 100 users | **$25-50** |
| Scale to 1000 users | **$50-100** |

---

## Next Steps

1. **Approve this plan** or request modifications
2. **Start Phase 1**: Deploy to Vercel
3. **Iterate** through remaining phases

Would you like to proceed with Phase 1 deployment?
