# Task Plan: Reading Garden (Reading Garden) V3 Re-Implementation (UI/UX Requirements 2026-02-10)

## Goal
Rebuild a new static, config-driven "阅读花园" site in `reading-garden-v3/` using native HTML/CSS/JS (ES Modules), matching `reading-garden/docs/UI_UX_DESIGN_REQUIREMENTS.md` (2026-02-10), while reusing copied resources from `reading-garden/` (data + assets).

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] Read UI/UX requirements doc
- [x] Inspect existing project data/assets/module formats
- [x] Generate design system (ui-ux-pro-max) and persist into project
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Decide project structure (pages, runtime, modules, CSS tokens)
- [x] Define module contracts + registry strategy
- [x] Create base skeleton: `index.html`, `book.html`, core runtime, base CSS
- **Status:** complete

### Phase 3: Implementation
- [x] Home page: hero + featured grid + book spine shelf + progress bars
- [x] Book shell: header + theme toggle + teacher mode + responsive tabs
- [x] Modules: reading / characters / themes / timeline / interactive / teaching
- [x] Special modules: totto map + philosophies, wonder precepts wall, story linguistics
- [x] LOTF modules: symbols / discussion / teaching
- [x] Ove sensitive module: suicide topic (non-actionable, content-warning, jump-to-reading)
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Smoke test: home loads + all books open (browser)
- [x] Validate registries: all module entry + data files exist
- [x] Module loading: loading/error/retry UI implemented in runtime
- [ ] Mobile/desktop breakpoints + keyboard accessibility (browser)
- [ ] Performance checks: dynamic imports, lazy images (browser)
- **Status:** in_progress

### Phase 5: Delivery
- [x] Document how to run locally (`reading-garden-v3/README.md`)
- [ ] List new files/structure (optional summary)
- [ ] Provide nanobanana prompt files if new images are required (none so far)
- **Status:** in_progress

## Key Questions
1. Keep per-book HTML pages or a single `book.html?book=<id>` page? (Prefer single page for consistency.)
2. How to map inconsistent existing data shapes to unified modules without rewriting data? (Adapters in modules.)
3. How to handle icons (avoid emoji) while keeping registry compatible? (Runtime icon mapping by `module.id`.)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use single `book.html?book=<id>` | Eliminates duplicated book pages, ensures consistent shell + UX across books |
| Keep copied `data/*/registry.json` but ignore emoji icons | Minimize data churn; runtime provides SVG icons by module id |
| Implement modules as ES modules + dynamic import | Meets performance requirement and config-driven modular architecture |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Sandbox blocks local HTTP requests (Operation not permitted) | 1 | Switched to filesystem validation for registries/entries; browser smoke test to be done manually |
