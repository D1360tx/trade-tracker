# Release v1.6.0-stable - Product Cleanup & Import Expansion

**Release Date**: May 13, 2026
**Tag**: `v1.6.0-stable`
**Status**: Stable

## Summary

This release makes the current main branch match the product direction: Schwab/options-first imports, Webull CSV support, cleaner reporting, and decision-focused analytics.

## Highlights

- Webull CSV import is now available as a first-class secondary import source.
- Schwab connect failures now show actionable API route/configuration messages instead of raw `Failed to fetch`.
- Import Trades is organized around a Schwab command center, secondary imports, and data management.
- Reports now opens the polished Performance Report as the primary reporting page.
- Analytics is now a Decision Hub with Options, Patterns, and Risk tabs.
- Focused tests cover Webull parsing, options analysis, and shared analytics calculations.

## Verification

- `npm test`
- `npm run build`

## Previous Stable Release

The previous stable release was `v1.5.0-stable` on January 16, 2026, focused on Schwab P&L precision, 180-day sync behavior, duplicate prevention, and calendar navigation.
