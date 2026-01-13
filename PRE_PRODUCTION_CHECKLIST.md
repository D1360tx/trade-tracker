# Pre-Production Checklist

**⚠️ IMPORTANT: Complete these tasks before launching to real users**

Last Updated: January 13, 2026

---

## 🗑️ Temporary Dev Tools to Remove

### 1. Cleanup Duplicates Button
- **Location:** `src/components/TradeManagement.tsx`
- **Lines:** ~14-32, ~166-176
- **Description:** Purple "Clean Duplicates" button - one-time maintenance tool
- **Action:** Delete the `handleCleanupDuplicates` function and button
- **File to remove:** `src/lib/supabase/cleanupDuplicates.ts`

---

## ✅ Pre-Launch Tasks

### Database
- [ ] Run "Clean Duplicates" button one final time
- [ ] Verify RLS (Row Level Security) policies are correct
- [ ] Test with multiple user accounts
- [ ] Backup database before launch

### Security
- [ ] Remove any hardcoded API keys or secrets
- [ ] Verify all environment variables are production-ready
- [ ] Test RLS policies with different users
- [ ] Enable Supabase real-time for all users

### Code Quality
- [ ] Remove all console.log statements (except critical errors)
- [ ] Remove commented-out code
- [ ] Run TypeScript strict mode check
- [ ] Run ESLint and fix all warnings

### Testing
- [ ] Test all exchange integrations (MEXC, Schwab, etc.)
- [ ] Test CSV imports for all supported exchanges
- [ ] Test manual trade entry
- [ ] Test trade editing and deletion
- [ ] Verify P&L calculations are accurate
- [ ] Test on mobile devices
- [ ] Test in different browsers

### Performance
- [ ] Optimize bundle size (check for unused dependencies)
- [ ] Enable production builds
- [ ] Test with large datasets (1000+ trades)
- [ ] Verify image optimization

### UX/UI
- [ ] Add loading states for all async operations
- [ ] Add error boundaries
- [ ] Test keyboard navigation
- [ ] Verify all links work
- [ ] Test dark mode thoroughly

---

## 📝 Nice-to-Have Before Launch

- [ ] Add onboarding flow for new users
- [ ] Add help/documentation links
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up analytics (PostHog, etc.)
- [ ] Add user feedback mechanism
- [ ] Create a changelog page

---

## 🚀 Launch Checklist

- [ ] Deploy to production
- [ ] Test production environment thoroughly
- [ ] Monitor error logs
- [ ] Have rollback plan ready
- [ ] Announce to beta users

---

**Remember:** This is a personal trading tracker app. Many of these items can be done post-launch if you're the only user. Prioritize based on your needs!
