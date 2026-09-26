# GM Interview Scheduling

Candidate-facing page for picking one interview time per panel member. The candidate opens it from an email link (`/schedule?case=…&token=…`), no login.

Built standalone for local review. Before it ships as an Ema Frontier App it has to move into the Frontier App template (see "Porting into the Ema template").

## Run it locally

```bash
export PATH="$HOME/.local/bin:$PATH"   # only needed in shells opened before Node was installed
npm install
npm run dev:fixture
```

The page is at http://localhost:5173 (API on :8787). Fixture state is in memory; stop and restart the server (Ctrl+C, then `npm run dev:fixture`) to reset submitted cases.

| Link | Shows |
|---|---|
| http://localhost:5173/schedule?case=SCHED-1234&token=demo-open | Open → pick one per person (conflicts work) → Submitting → Confirmed |
| http://localhost:5173/schedule?case=SCHED-1235&token=demo-submitted | Already submitted → Confirmed |
| http://localhost:5173/schedule?case=SCHED-1236&token=demo-expired | Expired |
| http://localhost:5173/schedule?case=SCHED-1237&token=demo-error | Error; Try again works (every odd lookup fails) |
| http://localhost:5173/schedule?case=SCHED-1238&token=demo-booking-fails | Open; first booking fails → Error; Try again re-checks, resubmits, succeeds |
| http://localhost:5173/schedule?case=SCHED-1239&token=demo-slot-taken | Open; first booking takes whichever Sarah Teller slot you picked → Slot taken; next submit succeeds |
| http://localhost:5173/schedule?case=SCHED-1234&token=wrong | Invalid link (404) |
| http://localhost:5173/schedule?case=SCHED-1234 | Invalid link (no API call) |
| http://localhost:5173/schedule | Invalid link |

## Checks

```bash
npm run check   # typecheck, lint, test (incl. TZ=America/Los_Angeles run), guard, build
```

`npm run build && CASE_SOURCE=slots npm start` serves the production build on :8787. Production refuses `CASE_SOURCE=fixture`.

## Layout

```
shared/     contract types, wall-clock time formatting, overlap + selection rules (used by both sides)
server/     Hono API: /api/public/case, /api/public/selection, rate limit, idempotency
  sources/  fixture.ts (local demo) and slots.ts (AI Employees via EmuClient)
  platform/ LOCAL STAND-INS for the template's EmuClient and recordAudit
src/        React page; components/ds/ are LOCAL STAND-INS for @ema/design-system
public/brand/gm-logo.svg   the logo (replace this one file to swap assets)
catalog.yaml               DRAFT; regenerate against the template's catalog-schema.md
scripts/guard.mjs          local guard: outside URLs, raw colors, fixture-in-production
```

## Porting into the Ema template

1. Create the app in the Live App Builder ("Create new app"), clone its repo, read its `CLAUDE.md` and `.claude/rules/`.
2. Copy `shared/`, the route handlers from `server/app.ts`, `server/sources/`, and `src/` pieces into the template's layout.
3. Replace `server/platform/emu-client.ts` with the template's EmuClient and `server/platform/audit.ts` with its `recordAudit()`.
4. Swap `src/components/ds/*` for `@ema/design-system` components (check each via `frontier_app_get_component_docs`); map tokens from `src/styles/tokens.css` to DS tokens, with GM blue `#005DAA` as the brand token.
5. Back `ConfirmationStore` with a model (template's `db-model.md`).
6. Declare the three public routes and both AIE slots in `catalog.yaml` per `catalog-schema.md`; bind `CASE_LOOKUP_AIE` and `BOOKING_AIE`.
7. Run the template's typecheck, lint, test, guard, build.
