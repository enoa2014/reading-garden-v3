# Progress Log: Reading Garden V3

## 2026-02-10
- Created `reading-garden-v3/` and copied `assets/` + `data/` from `reading-garden/`.
- Read and extracted UI/UX requirements; inspected existing data/module formats.
- Implemented missing modules and updated registries:
  - `js/modules/linguistics-module.js` (双画布动画 + 播放/暂停 + 速度滑块)
  - `js/modules/suicide-module.js`（内容提示 + 非可操作呈现 + 跳转阅读）
  - `js/modules/symbols-module.js`, `js/modules/discussion-module.js`, `js/modules/teaching-module.js`（蝇王）
- Fixed runtime asset resolution to work whether deployed at site root or under `/reading-garden-v3/`.
- Replaced header book logo emoji with SVG mark (avoid emoji icons).
- Added module CSS for new modules; added `README.md` with local run instructions.
- Note: sandbox blocks local HTTP requests, so only filesystem-level validation was performed here.
