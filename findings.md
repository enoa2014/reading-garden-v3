# Findings: Reading Garden V3

## Requirements Source
- `reading-garden/docs/UI_UX_DESIGN_REQUIREMENTS.md` (dated 2026-02-10)

## Key Product Constraints
- Pure static site; no build step.
- Config-driven: book registries define modules and data files.
- Native HTML/CSS/JS (ES Modules); Cytoscape.js for relationship graphs.

## Data/Assets Observations (Copied From Existing Project)
- `data/books.json` defines 6 books with cover + tags.
- Per-book `data/<bookId>/registry.json` lists modules and module entry JS paths.
- Data shapes vary by book/module:
  - Reading chapters: object-with-`chapters`, array, and lazy-loaded chapter detail files (LOTF).
  - Characters: Cytoscape elements (totto) vs simple nodes/edges (wave).
  - Themes: multiple formats (array w/ steps; object w/ themes; minimal list).
  - Timeline: simple day-based vs multi-timeline (Ove).

## Implementation Notes
- Asset paths in data can be `assets/...` or `../assets/...` while registries are under `data/<bookId>/`. Runtime now normalizes any path containing `assets/` to project root based on registry URL (works whether site is deployed at `/` or `/reading-garden-v3/`).
- Sandbox environment blocks opening local HTTP sockets (`Operation not permitted`), so browser smoke tests need to be done manually; registries were validated via filesystem checks.

## UX Priorities (From Requirements)
- Warm, literary, paper-like feel; avoid cold tech.
- Responsive: mobile-first for parents, projection/desktop for teachers.
- Reading module: comfort, notes, font size control, progress memory, mobile swipe.
- Tab behavior: bottom-fixed on mobile, top horizontal on desktop; fade transitions.
- Accessibility: contrast, focus, keyboard nav, reduced motion.
- Performance: dynamic import modules; lazy images.

## 2026-02-11 Analysis Pass (In Progress)
- Analysis scope: architecture, data flow, module quality, UX/performance/accessibility, technical debt.
- Method: inspect entry HTML, CSS system, runtime JS, module implementations, and per-book data registries.

## Architecture Findings
- Home implementation is now single-path:
  - Active: `index.html` + `js/bookshelf.js` + `css/bookshelf.css`
- Book page is fully runtime-driven:
  - Entry: `book.html` -> `js/app/book.js`
  - Runtime: `js/core/book-runtime.js` dynamically imports module entry files from each book's `registry.json`.
- Runtime path normalization is robust for mixed asset paths (`assets/...`, `../assets/...`).

## Config/Contract Findings
- Main registries (`data/*/registry.json`) are valid: module `entry` and `data` files exist (query strings stripped for fs validation).
- Legacy configs had been broken/stale and are now removed:
  - `data/wonder/registry.legacy.json`
  - `data/wonder/registry.modular.json`
- Registry fields are partially ignored by runtime:
  - `book.logo` is ignored (runtime renders fixed SVG by module id).
  - `capabilities`, `themeMode`, `themeStorageKey`, etc. are not consumed.
- Module naming drift exists: `totto-chan` uses module id `quiz`, while general module is `interactive`.

## Code Quality Findings
- High-risk event-listener leak in reading module:
  - `js/modules/reading-module.js` adds anonymous `change`/`input` listeners on each render, but destroy only removes click/pointer handlers.
  - Re-entering reading tab can stack handlers.
- Potential UI lock bug:
  - Reading drawer sets `document.body.style.overflow = "hidden"` on open.
  - Module destroy does not force restore overflow if module is switched while drawer is open.
- Remaining cleanup opportunities:
  - CSS: multiple unreferenced theme/legacy files and backup (`css/ove-theme.css.bak`)

## UX/Performance/A11y Findings
- Strengths:
  - Dynamic `import()` per module.
  - Lazy image loading is used widely.
  - Keyboard support exists for tabs and modal escape/focus trap.
  - `prefers-reduced-motion` is respected at base CSS level.
- Gaps:
  - No automated tests (unit/integration/e2e).
  - Some ARIA state semantics are incomplete (for collapsible reading sidebar/drawer controls).
- Browser-level cross-device regression testing has not been automated.

## Data/Safety Findings
- Suicide module UI is intentionally non-actionable, but raw data still contains explicit method/preparation fields in `data/a-man-called-ove/suicide_attempts.json`.
- If stricter safety/privacy posture is required, sensitive fields should be removed at data source, not only hidden in UI.

## 2026-02-11 Fixes Applied
- Fixed reading module listener accumulation:
  - Converted delegated `change` / `input` handlers to tracked state handlers.
  - Added symmetric removal in `destroy`.
- Fixed swipe listener cleanup target:
  - Swipe listeners were bound on `#rgChapterBody` but previously removed from `panelEl`.
  - Added `swipeTargetEl` tracking and proper cleanup.
- Added body scroll unlock safeguard on reading module destroy:
  - Prevents lingering `document.body.style.overflow = "hidden"` when switching modules with drawer open.
- Removed stale artifacts:
  - Deleted old/unreferenced JS files: `js/app/home.js`, `js/book-template-app.js`, `js/modules/shared/mobile-swipe.js`, `js/modules/shared/story-modal.js`
  - Deleted invalid wonder legacy registries.
  - Synced `README.md` metrics and tree with current file state.
