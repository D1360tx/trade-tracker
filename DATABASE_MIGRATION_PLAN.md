# Database & Authentication Implementation Plan

## Overview
Migrate Trade Tracker from localStorage to a cloud database with multi-user authentication, enabling cross-device sync and secure data storage.

---

## Technology Stack

### Backend: **Supabase**
- **Database**: PostgreSQL (hosted)
- **Authentication**: Built-in Auth with multiple providers
- **Storage**: For trade screenshots/attachments
- **Real-time**: For live data sync across devices
- **Row Level Security (RLS)**: User data isolation

**Why Supabase?**
- ✅ Free tier (50,000 monthly active users, 500 MB database)
- ✅ Built-in authentication (email, Google, GitHub, etc.)
- ✅ TypeScript SDK
- ✅ Real-time subscriptions
- ✅ No backend code required
- ✅ Automatic API generation

---

## Database Schema

### 1. **users** (managed by Supabase Auth)
```sql
-- Auto-created by Supabase
id: uuid (primary key)
email: text
created_at: timestamp
```

### 2. **user_profiles**
```sql
id: uuid (references auth.users) PRIMARY KEY
username: text
timezone: text
theme_preference: text
created_at: timestamp
updated_at: timestamp
```

### 3. **trades**
```sql
id: uuid PRIMARY KEY
user_id: uuid (references auth.users) NOT NULL
exchange: text NOT NULL
ticker: text NOT NULL
type: text NOT NULL (STOCK, OPTION, CRYPTO, FUTURES, FOREX, SPOT)
direction: text NOT NULL (LONG, SHORT)
entry_price: numeric NOT NULL
exit_price: numeric NOT NULL
quantity: numeric NOT NULL
entry_date: timestamptz NOT NULL
exit_date: timestamptz NOT NULL
status: text NOT NULL (OPEN, CLOSED)
pnl: numeric NOT NULL
pnl_percentage: numeric NOT NULL
fees: numeric NOT NULL
notes: text
strategy_id: uuid (references strategies)
mistakes: uuid[] (array of mistake IDs)
initial_risk: numeric
leverage: numeric
notional: numeric
margin: numeric
is_bot: boolean DEFAULT false
external_oid: text
created_at: timestamptz DEFAULT now()
updated_at: timestamptz DEFAULT now()

-- Indexes
INDEX idx_trades_user_id ON trades(user_id)
INDEX idx_trades_exit_date ON trades(exit_date DESC)
INDEX idx_trades_ticker ON trades(ticker)
INDEX idx_trades_exchange ON trades(exchange)
```

### 4. **strategies**
```sql
id: uuid PRIMARY KEY
user_id: uuid (references auth.users) NOT NULL
name: text NOT NULL
description: text
color: text NOT NULL
created_at: timestamptz DEFAULT now()
updated_at: timestamptz DEFAULT now()

UNIQUE(user_id, name)
```

### 5. **mistakes**
```sql
id: uuid PRIMARY KEY
user_id: uuid (references auth.users) NOT NULL
name: text NOT NULL
description: text
color: text NOT NULL
created_at: timestamptz DEFAULT now()
updated_at: timestamptz DEFAULT now()

UNIQUE(user_id, name)
```

### 6. **api_credentials** (encrypted)
```sql
id: uuid PRIMARY KEY
user_id: uuid (references auth.users) NOT NULL
exchange: text NOT NULL
api_key: text NOT NULL (encrypted)
api_secret: text NOT NULL (encrypted)
is_active: boolean DEFAULT true
created_at: timestamptz DEFAULT now()
updated_at: timestamptz DEFAULT now()

UNIQUE(user_id, exchange)
```

### 7. **trade_screenshots** (uses Supabase Storage)
```sql
id: uuid PRIMARY KEY
user_id: uuid (references auth.users) NOT NULL
trade_id: uuid (references trades)
file_path: text NOT NULL (storage bucket path)
file_name: text
file_size: integer
created_at: timestamptz DEFAULT now()

INDEX idx_screenshots_trade_id ON trade_screenshots(trade_id)
```

### 8. **user_settings**
```sql
id: uuid PRIMARY KEY
user_id: uuid (references auth.users) NOT NULL UNIQUE
column_order: jsonb (Journal table column preferences)
default_filters: jsonb (Default filter settings)
notification_preferences: jsonb
created_at: timestamptz DEFAULT now()
updated_at: timestamptz DEFAULT now()
```

---

## Row Level Security (RLS) Policies

All tables will have RLS enabled with policies like:
```sql
-- Example for trades table
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Implementation Phases

### **Phase 1: Setup & Infrastructure** (Day 1)
- [ ] Create Supabase project
- [ ] Set up database schema
- [ ] Configure RLS policies
- [ ] Install Supabase client SDK
- [ ] Create service layer utilities

### **Phase 2: Authentication** (Day 1-2)
- [ ] Create Login/Signup pages
- [ ] Add Auth context provider
- [ ] Protected route wrapper
- [ ] Email/password authentication
- [ ] OAuth providers (Google, GitHub)
- [ ] Session management
- [ ] Logout functionality

### **Phase 3: Data Layer Migration** (Day 2-3)
- [ ] Create Supabase service layer (`src/lib/supabase/`)
- [ ] Update TradeContext to use Supabase
- [ ] Update StrategyContext to use Supabase
- [ ] Update MistakeContext to use Supabase
- [ ] Add real-time subscriptions for live updates

### **Phase 4: Data Migration Tool** (Day 3)
- [ ] Build localStorage → Supabase migration utility
- [ ] Add one-click import for existing users
- [ ] Handle API credentials migration (encrypt)
- [ ] Verify data integrity

### **Phase 5: API Integration Updates** (Day 4)
- [ ] Move API credentials to Supabase (encrypted)
- [ ] Update MEXC/ByBit/Schwab fetchers to use DB credentials
- [ ] Add secure credential storage/retrieval

### **Phase 6: Screenshots & Storage** (Day 4-5)
- [ ] Set up Supabase Storage bucket
- [ ] Migrate IndexedDB screenshots to Supabase Storage
- [ ] Update screenshot upload/display logic

### **Phase 7: Settings Sync** (Day 5)
- [ ] Migrate column preferences to database
- [ ] Sync user settings across devices
- [ ] Theme preferences

### **Phase 8: Testing & Polish** (Day 5-6)
- [ ] Cross-device testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Loading states
- [ ] Offline support (optional)

---

## File Structure

```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Supabase client initialization
│   │   ├── auth.ts            # Auth helpers
│   │   ├── database.types.ts  # Auto-generated types
│   │   ├── trades.ts          # Trade CRUD operations
│   │   ├── strategies.ts      # Strategy operations
│   │   ├── mistakes.ts        # Mistake operations
│   │   └── storage.ts         # File storage helpers
│   └── migrations/
│       └── localStorage-to-supabase.ts
├── context/
│   ├── AuthContext.tsx        # Authentication state
│   ├── TradeContext.tsx       # Updated to use Supabase
│   ├── StrategyContext.tsx    # Updated to use Supabase
│   └── MistakeContext.tsx     # Updated to use Supabase
├── pages/
│   ├── auth/
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   └── ResetPassword.tsx
│   └── ... (existing pages)
└── components/
    ├── auth/
    │   ├── ProtectedRoute.tsx
    │   └── AuthGuard.tsx
    └── ... (existing components)
```

---

## Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Security Considerations

1. **Encryption**: API credentials encrypted at rest
2. **RLS**: All tables protected with Row Level Security
3. **HTTPS**: All traffic encrypted in transit
4. **Auth**: JWT-based authentication
5. **Secrets**: Never expose API keys in client code
6. **Validation**: Server-side validation via RLS

---

## Estimated Timeline

- **Phase 1-2** (Setup + Auth): 1-2 days
- **Phase 3-4** (Migration): 2-3 days
- **Phase 5-7** (Features): 2-3 days
- **Phase 8** (Testing): 1-2 days

**Total: 6-10 days** for full implementation

---

## Benefits After Migration

✅ **Multi-device sync**: Access from phone, tablet, desktop
✅ **Secure storage**: Cloud-based, encrypted
✅ **Real-time updates**: Changes sync instantly
✅ **Backup**: Automatic cloud backups
✅ **Scalability**: Handles unlimited trades
✅ **Collaboration**: Share strategies with other users (future)
✅ **Mobile app ready**: Same backend for mobile apps

---

## Next Steps

1. Create Supabase account and project
2. Install dependencies (`@supabase/supabase-js`)
3. Set up database schema
4. Begin Phase 1 implementation

---

**Ready to start?** Let me know and I'll begin with Phase 1!
