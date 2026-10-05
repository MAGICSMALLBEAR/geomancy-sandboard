# 地占沙盤

版本 0.9.0（測試版） · 2026-10-05 · 繁體中文 · React＋TypeScript＋Vite 的本機優先 PWA

**第一版 App 已可在電腦瀏覽器試用：提問（保留原句與整理後的問題）、五種起卦、起卦前的試畫區、盾盤與十二宮圓盤、附依據的基礎象徵解讀與進階解讀（成事、相位、象的重現、點之道等，草稿）、學習區、日誌與事後回顧、古典禁例與行星對應、三種可自選的外觀主題、可選的震動回饋、JSON 備份匯入、離線。** 自動測試全部通過；測試網址 https://magicsmallbear.github.io/geomancy-sandboard/ 已上線（GitHub Pages），iPhone／Android 真機、Safari 與讀屏尚未實測。實際狀態以 [STATUS.md](STATUS.md) 為準。

## 第一版做什麼

使用者寫下一個問題，選擇十六列點沙、快速起卦或手動四母象，觀看盾盤形成，閱讀附有盤位依據的基礎象徵解讀，結果自動存成日誌。整個核心流程能在首次成功快取後離線使用。同一個網址支援手機與電腦；記錄保存在各自裝置的瀏覽器，跨裝置要靠匯出／匯入。

試用時先測三件事：使用者能否自行完成、是否喜歡點沙操作、是否能理解解讀的依據。AI 長篇解卦、付費、會員、雲端同步與進階流派，等試用結果再排序。

## 如何執行

需要 Node.js 24.12 以上。

```sh
npm install
npm run dev        # 開發伺服器 http://localhost:5173
npm run build      # 型別檢查後產生 dist/
npm run preview    # 預覽 production build http://localhost:4173；離線與安裝用這個測
npm run deploy     # build 後發布到 GitHub Pages（gh-pages 分支），需先 commit
```

檢查命令：

```sh
npm run typecheck
npm run lint
npm run test:core  # Node 原生測試：排盤核心，含 65,536 組四母象枚舉
npm run test:unit  # Vitest：手勢、reducer、儲存交易、匯入匯出
npm run test:e2e   # Playwright：對 production build 跑 P01–P05 等流程
```

第一次跑 `test:e2e` 前要先 `npx playwright install chromium`。要在 Firefox 與 WebKit 也跑，先 `npx playwright install firefox webkit`，再執行 `PW_ENGINES=1 npx playwright test`（PowerShell：`$env:PW_ENGINES=1; npx playwright test`）。

要在手機上完整試用（含離線與安裝），需要把 `dist/` 放到 HTTPS 網址；用區網 IP 的 http 開啟時沒有離線與安裝功能。真機檢查表見 [docs/DEVICE-CHECKLIST.md](docs/DEVICE-CHECKLIST.md)。

## 文件

| 文件 | 用途 |
|---|---|
| [STATUS.md](STATUS.md) | 實際完成了什麼、測試結果、待驗證項目、已知限制 |
| [SPEC.md](SPEC.md) | 產品範圍、畫面、流程、操作與錯誤規則 |
| [TASKS.md](TASKS.md) | M0–M6 里程碑與完成條件 |
| [docs/ENGINE-AND-DATA.md](docs/ENGINE-AND-DATA.md) | 排盤算法、資料契約、匯入規則 |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | 技術架構與約束 |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | 驗收要求（不是測試報告） |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 產品與工程決策紀錄 |
| [docs/DEVICE-CHECKLIST.md](docs/DEVICE-CHECKLIST.md) | 真機與人工檢查表（尚未執行） |
| [docs/PILOT.md](docs/PILOT.md) | 第一輪使用者試用方法 |
| [docs/RESEARCH.md](docs/RESEARCH.md) | 研究結論與來源索引 |
| [START-PROMPT.md](START-PROMPT.md) | 換對話接續開發用的提示詞 |

`AGENTS.md` 是 Codex／Claude Code 共用的專案指示；`CLAUDE.md` 以 `@AGENTS.md` 引用同一份內容。

## 程式結構

```text
src/domain/          純排盤核心、十六象、解讀組合（不依賴 React／儲存／亂數）
src/infrastructure/  IndexedDB、Repository、匯入匯出驗證、回饋
src/features/        question、casting、result、journal、learn、settings、home
src/components/      FigureGlyph、ShieldChart、ChartPanel、ResultView、Dialog
src/app/             路由、全域狀態、PWA、音效
tests/core.test.mjs  Node 核心測試      tests/unit/  Vitest      tests/e2e/  Playwright
```

## 目前的界線

| 已完成並有自動測試 | 尚未完成或尚未驗證 |
|---|---|
| 排盤運算、三種起卦來源、逐列保存與恢復 | iPhone／Android 真機、Safari、Firefox |
| 盾盤、十二宮、附依據的基礎解讀、日誌與筆記 | 讀屏與 200% 縮放的人工檢查 |
| 匯出、匯入驗證、衝突與封存、暫存模式 | 地占專家對中文解讀的逐條審校 |
| PWA 離線（Chromium／Edge 桌面） | 使用者試用（M6）、公開部署 |

程式運算通過測試，不代表解讀已經過專家審核或證實能預測現實事件。解讀內容標示為 `editorial-draft`，畫面如實顯示「基礎象徵解讀・內容草稿」，不可自行升格為完整傳統斷事。
