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
