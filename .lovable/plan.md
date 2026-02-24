

## Make Only BetSlip and Parlays Require Login

### Current State
- **Parlays** (`/parlays`) -- already has an auth guard (shows "Sign In" prompt if not logged in)
- **BetSlip** (`/betslip`) -- currently has NO auth guard
- **Profile** (`/profile`) -- redirects to auth if not logged in (this is correct since it's user-specific settings)
- All other pages (Player Profile, Team Profile, Decisions, Leaderboard, Matchup, etc.) -- already public, no auth required

### What Needs to Change

Only one change is needed:

**Add an auth guard to the BetSlip page** (`src/pages/BetSlip.tsx`)
- Import `useAuth` hook
- Check if the user is logged in
- If not, show a prompt similar to Parlays (with a "Sign In / Sign Up" button) instead of the bet slip content
- This matches the existing pattern used in the Parlays page

Everything else is already set up correctly -- all other pages are accessible without signing in.

### Technical Details

**File: `src/pages/BetSlip.tsx`**
- Add `import { useAuth } from '@/hooks/useAuth'`
- Add `const { user, loading: authLoading } = useAuth()` inside the component
- Add a guard block (after all hooks) that renders a sign-in prompt when `!authLoading && !user`
- The prompt will match the Parlays page style with a message like "Sign in to build and save your bet slips"

