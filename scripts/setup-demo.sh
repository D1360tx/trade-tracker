#!/bin/bash

# Demo Account Setup Script
# This script creates a demo user and populates it with realistic trade data

echo "🎯 Setting up Trade Tracker Demo Account..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Creating demo user in Supabase Auth${NC}"
echo ""
echo "Please create a user in your Supabase Dashboard:"
echo "  1. Go to Authentication > Users"
echo "  2. Click 'Add user'"
echo "  3. Email: demo@example.com"
echo "  4. Password: demo123"
echo "  5. Auto Confirm User: YES"
echo ""
read -p "Press enter when you've created the demo user..."

echo ""
echo -e "${YELLOW}Step 2: Getting demo user ID${NC}"
echo ""
echo "Run this SQL query in your Supabase SQL Editor to get the user ID:"
echo ""
echo "SELECT id, email FROM auth.users WHERE email = 'demo@example.com';"
echo ""
read -p "Enter the demo user ID (UUID): " DEMO_USER_ID

echo ""
echo -e "${YELLOW}Step 3: Updating migration with demo user ID${NC}"

# Update the migration file with the actual user ID
sed -i.bak "s/demo_user_id uuid := '00000000-0000-0000-0000-000000000001'/demo_user_id uuid := '$DEMO_USER_ID'/" supabase/migrations/003_demo_account.sql

echo "✅ Migration file updated"
echo ""
echo -e "${YELLOW}Step 4: Applying migration${NC}"

# Apply the migration
npx supabase db push

echo ""
echo -e "${GREEN}✅ Demo account setup complete!${NC}"
echo ""
echo "Demo Login Credentials:"
echo "  Email: demo@example.com"
echo "  Password: demo123"
echo ""
echo "The demo account now has:"
echo "  ✅ 15 realistic trades (wins and losses)"
echo "  ✅ 3 trading strategies"
echo "  ✅ 2 common mistakes tagged"
echo "  ✅ Mix of stocks, options, and crypto"
echo "  ✅ Multiple exchanges (Schwab, MEXC)"
echo "  ✅ Recent data for populated charts"
echo ""
echo "🚀 Ready to demo!"
