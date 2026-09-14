# 012S Jelly Sudoku｜水母數獨

012S Jelly World 主題的區域型邏輯益智遊戲。每一關在 `N × N` 棋盤放置 `N` 隻水母，必須同時滿足：每行一隻、每列一隻、每個區域一隻，且以每隻水母為中心的九宮格內不能有另一隻水母（周圍八格都不能放置）。

## Development

```bash
npm install
npm run dev
```

驗證指令：

```bash
npm run typecheck
npm test
npm run build
```

正式 build 預設使用 `/012s-jelly-sudoku/` base，適合部署至 GitHub Pages 的 `012s-jelly-sudoku` repository；如需不同路徑，可設定 `VITE_BASE_PATH`。

## Architecture

- `src/game/`：純 TypeScript rules、solver 與 level validator。
- `src/data/levels/`：30 個正式關卡的生成式資料來源；生成後逐關通過唯一解檢查。
- `src/storage/`：`jellySudokuSave.v1` LocalStorage adapter、進度與解鎖。
- `src/audio/`：可 graceful fallback 的音效與震動 adapter。
- `src/config/assets.ts`：集中管理可替換的水母角色素材。
- `src/App.tsx`、`src/styles.css`：手機優先的首頁、關卡頁與遊戲頁。

## Phase 1 content

- 基礎 6×6：10 關
- 普通 8×8：10 關
- 挑戰 10×10：10 關
- EMPTY → MARKED → JELLY → EMPTY
- 提交答案後統一判定與衝突回饋、系統輔助標示、提示、計時、重新開始、過關統計、鍵盤操作與進度恢復

## Beginner progression (revision 2)

Basic 1–3 each contain exactly one singleton region. Basic 4–5 introduce vertical strips; 6–7 mix vertical and horizontal strips. Basic 8–10 require progressively more shared exclusions. All ten are connected, uniquely solvable, and accepted by a no-search logical solver (`src/game/difficulty.ts`). Its deduction count is a structural proxy for difficulty, not a measured player completion time.

Regenerate this sequence deterministically with `python scripts/generate_beginner_levels.py`, then run `npm test`. Normal and challenge puzzles remain unchanged. Beginner puzzle revisions reset incompatible in-progress boards and separate best records, while retaining completion and unlock progress.

## Normal progression (revision 2)

Normal 1–3 start with both vertical and horizontal strip regions; 4–6 retain vertical openings; 7–10 introduce longer deduction chains. No normal puzzle has a singleton region. All ten must pass connectivity, unique-solution, and no-guess deduction tests with nondecreasing shared-exclusion counts.

Regenerate with `python scripts/generate_normal_levels.py`. This updates only normal puzzles. Old normal boards reset on entry because their layout revision differs; unlocks and completion remain available, and new best records are stored separately.

## Tutorial mode

The home page opens four independent lessons: click cycle and singleton regions, vertical/horizontal strips, the jelly-centred 3×3 exclusion area, and a 6×6 practice puzzle. Tutorials do not time or count mistakes, allow unlimited hints and assistance toggling, and validate only when submitted. Lesson three protects its preset jelly and includes a full 3×3 diagram for the edge-of-board example. Completion is saved separately under `jellySudokuTutorial.v1`; practice boards restart when selecting or reopening a lesson. Players can skip to basic level one or replay any lesson.
