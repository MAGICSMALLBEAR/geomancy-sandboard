# 已固定的產品與工程決策

日期：2026-09-30。以下是第一輪可執行基線，後續修改須追加原因並同步相關規格。

| ID | 決定 | 理由／影響 |
|---|---|---|
| D01 | 初學者、繁體中文、單頁 PWA | 先測同一套手機／電腦流程，不先分兩個原生 App |
| D02 | 順序十二宮，western-sequential-v1 | 流派固定，便於核對與版本化 |
| D03 | 十六列點沙＋快速＋手動 | 保留核心操作感並提供比較／檢查入口 |
| D04 | 有效 pointerup 計點 | 取代前版較粗略的 pointerdown 計數敘述，取消不算點 |
| D05 | 基礎解讀草稿可用於私人試用 | 全流程可測；畫面如實標示，不冒充已審校完整斷事 |
| D06 | 本機 IndexedDB，無會員／AI | 降低初期成本與私人資料流動 |
| D07 | 快速 RNG 與 UI 分開、來源保存後揭示 | 重整與重試不換盤；暫存例外必須標示 |
| D08 | 已完成核心＋開發交接包 | 本輪交可直接開工的材料；完整 UI 是 M0–M5 工作 |
| D09 | AGENTS.md 共用、CLAUDE.md 引用 | 新對話與兩種代理共享規則 |

2026-10-01 實作階段新增：

| ID | 問題 | 選擇 | 理由 | 受影響檔案／驗收 |
|---|---|---|---|---|
| D10 | TypeScript 最新版 7.0 與 typescript-eslint 8.71 不相容（後者要求 <6.1） | 鎖定 TypeScript 6.0.3 | lint 與 typecheck 都要能跑 | `package.json`；`npm run typecheck`、`npm run lint` |
| D11 | react-router 最新為 8.x | 鎖定 7.18.4，用 `createHashRouter` | 需要 `useBlocker` 攔截未確認的點沙／未保存筆記；採用已熟悉且穩定的 7.x API | `src/app/App.tsx`；e2e「放棄本列並離開」 |
| D12 | Node 24.11.1 在含中文的路徑下 `fs.rmSync` 遞迴刪除會當掉，Vite 清空 dist 因此失敗 | `build.emptyOutDir=false`，改由 `scripts/clean.mjs`（promise 版 `rm`）清目錄 | 專案路徑含中文；已用暫存目錄重現。升級 Node 後可再評估移除 | `vite.config.ts`、`scripts/clean.mjs`；`npm run build` 連跑兩次成功 |
| D12a | 2026-10-01：Node 升級到 24.19.0 後是否保留 D12 的繞道 | 移除 `scripts/clean.mjs`，恢復 Vite 預設清空 `dist/` | 24.19.0 在含中文暫存路徑下 `fs.rmSync` 遞迴刪除正常；`engines` 已要求 ≥24.12，不再需要繞道 | `vite.config.ts`、`scripts/clean.mjs`；`npm run build` 連跑兩次成功 |
| D13 | 匯入邊界用 Zod 或手寫 | 手寫白名單 validator | 逐欄重建新物件、由來源重算後比對，不多一個依賴 | `src/infrastructure/importExport.ts`；`tests/unit/importExport.test.ts` |
| D14 | 同 ID 已有 preparedSource 時再次 prepare | 回傳既有值，不覆寫、不報錯 | 規格允許兩者之一；讓保存失敗後的重試保持冪等 | `records.ts`；單元測試 C11 |
| D15 | 設定「清除全部」的範圍 | 清草稿、日誌、封存、回饋；保留設定與離線快取 | 規格只要求不影響靜態快取；保留顯示偏好較不意外 | `db.ts`；單元測試 |
| D16 | 記錄 ID 產生方式 | 以 `crypto.getRandomValues` 組 UUID v4 | `crypto.randomUUID` 需要安全來源；ID 不是起卦亂數，與快速模式取樣分開 | `records.ts` |
| D17 | 首次安裝 worker 是否接管頁面 | `clientsClaim: true`、不 `skipWaiting` | 首次載入不需重整就受控；更新仍等使用者同意 | `vite.config.ts`；e2e P05 |
| D18 | 長問題在起卦頁的顯示 | 最多三行，完整文字在結果頁 | 避免手機上把沙盤擠出畫面 | `app.css` |
| D19 | 列化約動畫期間的點擊 | 鎖定不計，可略過 | 避免把下一列的點算進剛確認的列 | `DotsCasting.tsx` |
| D20 | 2026-10-01：測試網址放哪裡、怎麼部署 | GitHub Pages，公開 repo `MAGICSMALLBEAR/geomancy-sandboard`；`npm run deploy` 在本機 build 後把 `dist/` 強制推到 `gh-pages` 分支 | 產品負責人選定 GitHub Pages；免費帳號需公開 repo。目前 gh 登入沒有 `workflow` 權限，先不用 GitHub Actions；`base: './'` 與 hash 路由讓子路徑不需改程式 | `scripts/deploy.mjs`、`package.json` |
| D21 | 2026-10-01：產品負責人試用時，快速連點常出現「輕點即可：這次沒有算進去」 | 點擊的最大移動距離由 12 CSS px 放寬為 30 px；1500 ms、多指、取消、盤外放開規則不變 | 手機上快速連點時手指常滑動超過 12 px，被判成拖動。30 px 仍能排除明顯的拖曳 | `gesture.ts`、`SPEC.md` §6、`ACCEPTANCE.md` C03／C04；單元測試與 e2e C03／C04 |
| D22 | 2026-10-01：產品負責人希望有「不想點沙時，由亂數自動點沙」的模式 | 新增第四種起卦方式「自動點沙（裝置亂數）」，來源 `kind: 'auto'`、`algorithm: 'webcrypto-counts-v1'`、16 列粒數 5–20；保留原本瞬間出結果的快速起卦 | 產品負責人選擇新增而非取代快速起卦。粒數由按鈕 handler 一次取樣並先保存，動畫只播放已保存資料，與快速模式同一套防重抽規則；奇偶規則與手動點沙相同。舊版 App 匯入 `auto` 記錄會判為無效 | `geomancy.ts`、`random.ts`、`records.ts`、`importExport.ts`、`AutoCasting.tsx`、`CastPage.tsx`；`SPEC.md` §7、`ENGINE-AND-DATA.md` §2；單元測試與 `tests/e2e/auto.spec.ts`（C13／C14） |
| D23 | 2026-10-01：產品負責人覺得畫面太簡單；看過三種風格樣板後選擇「三種都保留」 | 設定頁新增「外觀主題」：安靜沙盤（預設）、古典手稿、現代儀式（深色）。同一套 CSS 變數三組值，沙盤畫布讀取主題色；主題存在本機設定，不進記錄與匯出 | 只用系統字型（古典手稿用系統楷體：Apple 楷體、Windows 標楷體；Android 沒有楷體會退回襯線字），不從 Google Fonts 下載，維持離線與不連外部服務。三組色票以 WCAG 公式計算，文字對比最低 5.9:1 | `app.css`、`SandCanvas.tsx`、`repository.ts`、`db.ts`、`AppContext.tsx`、`SettingsPage.tsx`；`tests/e2e/themes.spec.ts` |
| D24 | 2026-10-01：產品負責人要求深度解卦（成事關係、十二宮逐宮、點之道、證人與裁判），成事規則採預設的現代西方版本 | 結果頁新增「進階解讀（草稿）」，由盤面即時計算、不存入記錄，版本 `zh-TW-advanced-draft-v1`。成事依 G06：同象、接合、轉移、傳遞，否則為不成事；宮位相鄰採環狀（第 12 宮鄰第 1 宮）、接合不把雙方自己的宮位算進去、傳遞的第三象必須與雙方都不同、摘要依同象→接合→轉移→傳遞排序。點之道依 G07：從裁判火行往上找火行相同的上一代，到母象或女象為止 | 匯入與完整性檢查會用來源重算基礎解讀並逐項比對，改動 `buildReading` 會讓所有舊記錄被判不一致，所以進階層另外計算。Greer 原書未能直接核對（線上文章 403），定義以 G06／G07 為準；環狀相鄰與排序是本產品的明確選擇。十二宮文字為組合式草稿（16 個象在宮中的傾向 × 12 個宮位問題），全部未經專家審校 | `advanced.ts`、`AdvancedReading.tsx`、`ResultView.tsx`、`ShieldChart.tsx`、`sources.ts`；`tests/unit/advanced.test.ts`（含 65,536 盤點之道性質）、`tests/e2e/advanced.spec.ts` |
| D25 | 2026-10-02：結果「存成圖片」（計畫 P1 的圖片分享，不含後端） | 結果頁新增「存成圖片」：在本機以 Canvas 畫 1080×1350 PNG（盾盤、裁判、成事結論、草稿聲明），用目前主題的顏色，下載到裝置；問題文字預設不放，使用者勾選才加入 | 不需後端、不上傳、不新增依賴；圖片容易被轉傳，所以私人的問題文字預設排除 | `shareImage.ts`、`ShareImageDialog.tsx`、`ResultPage.tsx`；`tests/unit/shareImage.test.ts`、`tests/e2e/advanced.spec.ts`（PNG 尺寸、預設不含問題、無網路請求） |

新增格式：日期／問題／選擇／理由／受影響檔案／驗收。不要以「代理覺得比較好」無痕替換規則或刪除重要錯誤流程。
