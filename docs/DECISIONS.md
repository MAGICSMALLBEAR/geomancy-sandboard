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

新增格式：日期／問題／選擇／理由／受影響檔案／驗收。不要以「代理覺得比較好」無痕替換規則或刪除重要錯誤流程。
