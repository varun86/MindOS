# E2E Tests

Browser-based end-to-end tests using Playwright.

## Prerequisites

```bash
cd packages/web && npx playwright install
```

## Running

```bash
# Start the dev server first
npm run dev

# Run E2E tests
npx playwright test --config tests/e2e/playwright.config.ts
```

## Screenshots

Failure screenshots are saved automatically to `tests/e2e/results/`. Extra visual-debug screenshots are disabled by default to keep local and pre-release runs faster. Enable them only when inspecting layout changes:

```bash
MINDOS_VISUAL_DEBUG=1 npx playwright test --config tests/e2e/playwright.config.ts
```

## Writing tests

- Each test file should cover a user-facing workflow (e.g. file navigation, search, settings)
- Use `test.describe` to group related scenarios
- Do not call `page.screenshot()` directly for always-on artifacts; use `saveVisualDebugScreenshot()` so screenshots stay opt-in
