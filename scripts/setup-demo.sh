#!/bin/bash

# Demo Account Setup Script
# This script creates a demo user and populates it with realistic trade data

echo "🎯 Setting up Trade Tracker Demo Account..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}This script will:${NC}"
echo "  ✅ Create demo@tradetracker.app user (password: demo123)"
echo "  ✅ Add 15 realistic demo trades"
echo "  ✅ Add 3 trading strategies"
echo "  ✅ Add 2 common mistake tags"
echo ""
read -p "Press enter to continue..."

echo ""
echo -e "${YELLOW}Applying demo account migration...${NC}"

# Apply the migration
npx supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Demo account setup complete!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}Demo Login Credentials:${NC}"
    echo "  📧 Email: demo@tradetracker.app"
    echo "  🔑 Password: demo123"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "The demo account now has:"
    echo "  ✅ 15 realistic trades (wins and losses)"
    echo "  ✅ 3 trading strategies"
    echo "  ✅ 2 common mistakes tagged"
    echo "  ✅ Mix of stocks, options, and crypto"
    echo "  ✅ Multiple exchanges (Schwab, MEXC)"
    echo "  ✅ Recent data for populated charts"
    echo ""
    echo "Total Demo P&L: ~\$9,387"
    echo "Win Rate: ~67%"
    echo "Profit Factor: ~2.8"
    echo ""
    echo "🚀 Ready to demo!"
else
    echo ""
    echo -e "${YELLOW}⚠️  Migration failed. Check the error above.${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Make sure Supabase is running: npx supabase start"
    echo "  - Check that you're in the project root directory"
    echo "  - Verify Supabase connection settings"
    exit 1
fi
