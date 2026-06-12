# Layout rule unification audit - 2026-06-13

## Scope

This audit looks for layout rules that are currently mixed across page components instead of flowing through one shared rule. It focuses on global layout surfaces: page shells, sidebars, modal/dialog shells, titlebar geometry, TOC/right-side reserve, and z-index layers.

The worktree is dirty, so this document is intentionally review-only. Do not treat every finding as safe to batch into one refactor.

## Findings

### 1. Z-index semantics are documented, but not enforced

Severity: major

The design rule says z-index should use the semantic 10/20/30/40/50 scale. In code, several layout-level surfaces use arbitrary values:

- `components/ActivityBar.tsx`: `z-[31]`, `z-[32]`
- `components/ask/*`: several popovers use `z-[60]`
- `components/walkthrough/WalkthroughOverlay.tsx`: `z-[100]`, `z-[101]`
- `components/walkthrough/WalkthroughTooltip.tsx`: `z-[102]`
- `components/SidebarLayout.tsx`: skip link uses `z-[60]`

Why it matters: these values encode real layer ordering decisions, but the decisions are invisible to the design system. Future modal, panel, walkthrough, and popover work can accidentally cover or sit under the wrong surface.

Recommended fix: introduce a small semantic layer map before changing values, for example `LAYOUT_Z` / CSS utility classes for `rail`, `panel`, `rightPanel`, `modal`, `popover`, `walkthrough`, and `skipLink`. Either fit them into 10/20/30/40/50 or update the design rule with named exceptions. Do not blindly replace `z-[31]` with `z-30`, because rail-over-panel ordering may be intentional.

### 2. Modal/dialog shells are split across multiple hand-rolled patterns

Severity: major

There is a shared `components/ui/dialog.tsx`, but core product modals still hand-roll overlay, placement, dimensions, and radius:

- `components/SearchModal.tsx`: command palette, `md:pt-[15vh]`, `md:max-w-xl`
- `components/AskModal.tsx`: bottom sheet on mobile, `md:pt-[10vh]`, `md:max-w-2xl`, `md:max-h-[75vh]`
- `components/SettingsModal.tsx`: large settings shell, `md:max-w-4xl lg:max-w-5xl`, `h-[88vh] md:h-[80vh]`
- `components/ImportModal.tsx`: centered compact modal, `max-w-lg max-h-[80vh]`
- `components/ExportModal.tsx` and `components/CreateSpaceModal.tsx`: compact centered modals
- `components/KeyboardShortcuts.tsx`, `components/agents/CustomAgentModal.tsx`, and several agent modals repeat related shell rules

Why it matters: the product has legitimate modal variants, but the variants are encoded as copied class strings. This makes mobile sheet behavior, desktop top offset, max-height, backdrop choice, and close behavior drift over time.

Recommended fix: add a `ModalShell` or `DialogFrame` component with variants such as `compact`, `command`, `ask`, `settings`, and `fullscreenSetup`. Keep `ui/dialog.tsx` for Base UI primitive dialogs, but route app-specific modal chrome through one shell. Migrate one modal at a time, starting with `ExportModal` / `CreateSpaceModal` before touching `AskModal` or `SettingsModal`.

### 3. Page content shells are partially unified, but still mixed

Severity: major

`ContentPageShell` now covers workbench-style pages like Agents and Inbox. Other pages still hand-write related page container rules:

- `components/WikiHomeContent.tsx`: `content-width px-4 md:px-6 py-10 md:py-14`
- `components/explore/ExploreContent.tsx`: `content-width px-4 md:px-6 py-8 md:py-12`
- `components/agents/AgentDetailContent.tsx`: `content-width px-4 md:px-6 py-8 md:py-10`
- `app/changelog/ChangelogClient.tsx`: `max-w-4xl mx-auto px-4 md:px-6`
- `app/loading.tsx` and `app/view/[...path]/loading.tsx`: repeat skeleton shell spacing
- `app/capture/history/page.tsx` and `app/inbox/history/page.tsx`: local narrow/empty-state shells

Why it matters: page spacing and width are now partly controlled by `ContentPageShell`, partly by `.content-width`, and partly by local `max-w-*` classes. The product will keep getting "this page feels slightly different" reports unless page archetypes are explicit.

Recommended fix: extend the shell concept into named page archetypes instead of one universal shell:

- `WorkbenchPageShell`: app surfaces such as Agents, Inbox, Channels
- `ReadingPageShell`: markdown/wiki-style content using user-controlled `.content-width`
- `NarrowPageShell`: login, history empty states, setup-style forms
- `LoadingPageShell`: skeleton pages sharing the same padding as their target page

Do not force all pages into `ContentPageShell`; reading pages and chat/home are different mental models.

### 4. TOC/right-side reserve still has hardcoded `220px` pockets

Severity: minor-to-major, depending on page

The TOC width is already dynamic through `--toc-width` / `--toc-extra-right`, but some non-view content manually reserves a similar width with `xl:mr-[220px]`:

- `components/changes/ChangesContentPage.tsx`
- `components/TrashPageClient.tsx`
- `components/renderers/todo/TodoRenderer.tsx`

Why it matters: `220px` is a layout policy copied into pages. If TOC width changes, or if a page should not reserve TOC space, these pages will diverge.

Recommended fix: introduce a named utility such as `.toc-reserved-content` or a shell prop like `reserveTocSpace`. Back it with a CSS variable rather than `xl:mr-[220px]`. Confirm visually before changing, because these pages may have been optically aligned to reading pages on purpose.

### 5. Titlebar geometry is already well governed

Severity: pass

The titlebar/layout height problem already has a strong contract:

- `__tests__/components/titlebar-geometry.test.ts` scans source for illegal bare viewport heights and bad document-level sticky offsets.
- `__tests__/components/header-toc-vertical-alignment.test.ts` protects TOC and FindInPage offsets.
- `wiki/41-dev-pitfall-patterns.md` documents the invariant.

Recommended fix: do not create another abstraction here unless a real bug appears. The current test-backed rule is stronger than a helper component would be.

### 6. Small popover/menu dimensions are repeated, but lower priority

Severity: minor

Context menus, small popovers, and tooltips repeat patterns like `fixed z-50 min-w-[160px]`, `max-w-[260px]`, and `rounded-lg border shadow-lg` across file tree, inbox rows, home inbox, model input, and ask capsules.

Why it matters: this creates minor visual drift, but these are local component details, not page layout contracts.

Recommended fix: defer until after page shell and modal shell work. If cleaned, use small primitives such as `FloatingMenuFrame` and `TooltipFrame`, not global page-layout tokens.

## Recommended order

1. Z-index semantic map and enforcement test.
2. Modal shell variants, starting with compact modals.
3. Page shell archetypes and a source-level contract test for page containers.
4. TOC reserve utility, with screenshot verification on Changes, Trash, and Todo.
5. Small popover/menu frame cleanup.

## Suggested verification

- Source-level tests for forbidden arbitrary layout literals after each rule is centralized.
- Playwright screenshots for at least one page per shell archetype.
- Keep existing titlebar geometry tests unchanged unless the titlebar contract itself changes.

## Implementation pass - 2026-06-13

Implemented the first cleanup slice:

- Added semantic app-layer tokens in `packages/web/lib/config/layout-layers.ts` and matching `z-app-*` CSS utilities.
- Replaced unnamed app-level escape hatches such as `z-[31]`, `z-[32]`, `z-[60]`, `z-[100+]`, and `zIndex: 99999` with named layer utilities or `LAYOUT_Z`.
- Added `ModalShell` for app-specific modal chrome and migrated compact modals: `ExportModal`, `CreateSpaceModal`, and `KeyboardShortcuts`.
- Extended `ContentPageShell` into named shells: `WorkbenchPageShell`, `ReadingPageShell`, `NarrowPageShell`, and `LoadingPageShell`.
- Migrated Wiki home, Explore, Agent detail, Changelog, and loading skeleton wrappers onto named shells.
- Replaced copied `xl:mr-[220px]` pockets in Changes, Trash, and Todo renderer with `.toc-reserved-content`.
- Added `packages/web/__tests__/components/layout-rules-contract.test.ts` to prevent unnamed app-layer z-index values, copied TOC reserve literals, and hand-rolled compact modal shells from coming back.
- Updated `wiki/21-design-principle.md` and `wiki/22-page-design.md` to document the new named-shell and named-layer rules.

Verified:

```bash
pnpm --filter @mindos/web exec vitest run \
  __tests__/components/layout-rules-contract.test.ts \
  __tests__/components/sidebar-width-contract.test.ts \
  __tests__/lib/panel-sizes.test.ts \
  __tests__/components/titlebar-geometry.test.ts \
  __tests__/components/header-toc-vertical-alignment.test.ts
```

Result: 5 files passed, 15 tests passed.

Screenshots saved:

- `/tmp/mindos-layout-wiki.png`
- `/tmp/mindos-layout-explore.png`
- `/tmp/mindos-layout-agent-detail.png`
- `/tmp/mindos-layout-changelog.png`
- `/tmp/mindos-layout-changes-toc-reserve.png`
- `/tmp/mindos-layout-trash-toc-reserve.png`
- `/tmp/mindos-layout-keyboard-modal.png`
- `/tmp/mindos-layout-create-space-modal.png`

Known unrelated verification blocker:

- `pnpm --filter @mindos/web typecheck` currently fails in the dirty worktree at `packages/web/lib/agent/ask-compat.ts` with an `AskMode` vs `"organize"` comparison error. This file is outside the layout-rule cleanup slice.
