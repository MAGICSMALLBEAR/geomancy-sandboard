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
| D26 | 2026-10-03：產品負責人選擇下一步做「學習／十六象圖鑑」 | 擴充教學區：十六象頁加結構資訊與相關象、新增「十二宮與盤位」與「推盤練習」兩頁；不改起卦規則、資料格式與解讀 | 試用目標要求初學者能說出「為何這一列變成一點或兩點」，逐步練習與對答案直接對應這個目標。練習頁的「換一組四母象」用固定的位元輪換，不呼叫 Web Crypto，避免和起卦取樣混淆；練習不寫入資料庫。星體／元素對應因各傳統差異大且未能核對來源，本輪不加入 | `figureRelations.ts`、`content/learn.ts`、`LearnPages.tsx`、`HousesPage.tsx`、`PracticePage.tsx`、`Derivation.tsx`（由 `ChartPanel.tsx` 抽出）；`tests/unit/figureRelations.test.ts`、`tests/e2e/learn.spec.ts`、`zoom.spec.ts` |
| D27 | 2026-10-04：專家審校後要改解讀文字，但匯入與開啟記錄時會用目前程式重組文字逐字比對，升版會讓所有舊記錄變成只讀封存（R05 未實作） | 已發布的內容版本凍結成獨立模組（`readingV1.ts`，自帶文字，不讀 `catalog.ts`），`buildReading` 依記錄的 `contentVersion` 分派；驗證時舊記錄用自己的版本重組比對。`reviewStatus` 型別預留 `expert-reviewed` | 舊記錄必須保留當時的文字快照且仍能驗證竄改；只凍結一份文字的代價是重複一張 16 象表，換來改文字時不會誤傷舊資料。本次沒有改任何解讀文字，內容版本仍是 v1 | `readingV1.ts`、`reading.ts`、`contracts.ts`、`importExport.ts`、`ENGINE-AND-DATA.md` §10；`tests/unit/contentVersions.test.ts` |
| D28 | 2026-10-04：產品負責人選擇 P1 先做「四次長按」 | 新增第五種起卦方式「四次長按（裝置亂數）」，來源 `kind: 'press'`、`algorithm: 'webcrypto-press-v1'`、四個 byte。每次按住至少 1000 ms 並在圓圈內放開，才在放開的 handler 取 1 個 byte，取到就存入草稿（`confirmPress`，和點沙逐列保存同一套 revision 防重）；保存失敗重試同一 byte，未保存時離開頁面會先提醒。鍵盤可按住空白鍵或 Enter，自動重複不計 | 依規劃書 §11：長按是數位取數，時長只控制動畫，不以時間、座標或按壓長度當亂數；不偽造點數。逐次保存讓重新整理後保留已完成的長按。舊版 App 匯入含 `press` 的記錄會判為格式不正確 | `geomancy.ts`、`random.ts`、`contracts.ts`、`records.ts`、`repository.ts`、`db.ts`、`importExport.ts`、`PressCasting.tsx`、`CastPage.tsx`、`Derivation.tsx`、`NewQuestionPage.tsx`、`HomePage.tsx`、`app.css`；`tests/unit/press.test.ts`、`tests/e2e/press.spec.ts`（C15） |
| D29 | 2026-10-05：基礎解讀「問題所屬範圍」卡片寫著「本版尚未計算它與第 1 宮之間的成就關係」，但 0.4.0 起進階解讀已經計算成事關係 | 新增內容版本 `zh-TW-basic-draft-v2`，這一句改為「它與第 1 宮之間有沒有成事關係，請看下方進階解讀的『成事關係』」；其餘文字與 v1 相同。新記錄用 v2，舊記錄保留 v1 文字 | 產品負責人選擇先修正。這是事實錯誤，不是象義判斷，不需等專家；左右證人說法不一致等內容問題仍留給專家審校。仍是 `editorial-draft` | `readingV2.ts`、`readingV1.ts`（只把表格改成 export）、`reading.ts`、`catalog.ts`；`tests/unit/contentVersions.test.ts`、`tests/e2e/content.spec.ts` |
| D30 | 2026-10-05：產品負責人要求補做企劃書中尚未完成的「日後觀察」：讓使用者回頭記下事情後來的發展 | 記錄新增選填欄位 `outcome { status, text, recordedAt }`，四種狀態「和解讀相符／部分相符／和解讀不同／還看不出來」，文字上限 2000 字；與筆記共用 revision 防重；可修改、可刪除。匯出／匯入逐欄驗證，不合規則整筆拒絕；`schemaVersion` 仍為 1（新增的是選填欄位，舊記錄不受影響）。日誌可依回顧狀態篩選，首頁提示超過一週未回顧的記錄 | 用語刻意是「和解讀對照」，不是「準不準」，避免把反思工具變成預測評分。資料庫結構不變（IndexedDB 不需升版）。已知限制：0.7.x 以前的 App 匯入含回顧的備份時會忽略這個欄位（不會報錯，回顧不會被帶入） | `contracts.ts`、`records.ts`、`repository.ts`、`db.ts`、`importExport.ts`、`errors.ts`、`OutcomeEditor.tsx`、`ResultPage.tsx`、`JournalPage.tsx`、`HomePage.tsx`、`labels.ts`；`tests/unit/followup.test.ts`、`tests/e2e/followup.spec.ts` |
| D31 | 2026-10-05：補做進階解讀的「相位」與「象的重現」 | 進階解讀升為 `zh-TW-advanced-draft-v2`。相位：十二宮排成一圈，相隔 2 宮六分、3 宮四分、4 宮三分、6 宮對分，相鄰與相隔 5 宮無主要相位；列出第 1 宮與問題宮本身的相位，以及兩個代表象重現到其他宮時與對方宮位的相位；六分、三分標為助力，四分、對分標為張力。相位不算成事。象的重現：列出在十二宮出現兩次以上的象，以及裁判的象出現在哪些宮；代表象優先。十二宮檢視新增圓盤與相位連線 | 仍是即時計算、不存入記錄（同 D24），不影響舊記錄驗證。規則依常見西方實務整理（來源 G08，Greer 書目），本案未能直接核對原書頁碼；文字為未審校草稿 | `advanced.ts`、`AdvancedReading.tsx`、`HouseWheel.tsx`、`ChartPanel.tsx`、`ResultView.tsx`、`sources.ts`；`tests/unit/followup.test.ts`（含 65,536 盤性質檢查）、`tests/e2e/followup.spec.ts` |
| D32 | 2026-10-05：產品負責人認為畫面太簡略、提不起興趣；要求三種主題都完整保留、由使用者自行選擇 | 0.8.0 視覺層 `src/styles/visual.css`：三種主題共用同一套結構，各自提供背景紋理、陰影、裝飾色等 token。首頁改為主視覺（真實排盤推導的盾盤動畫）、四階段流程、主題選擇卡（每張預覽用自己的主題繪製）、十六象一覽；結果頁頂端新增「證人＋證人→裁判」總覽；新增起卦前的「試畫區」（`#/learn/try`，不保存、不取亂數，沿用正式點沙的手勢判定）。預設主題仍為安靜沙盤 | 仍只用系統字型與內嵌 SVG，不連外部服務，離線可用。文字色票未改，原有對比計算仍成立；新增的裝飾色只用於圖形與線條。動畫在「減少動態效果」下停用 | `visual.css`、`app.css`（token）、`Decor.tsx`、`ThemePicker.tsx`、`HomePage.tsx`、`App.tsx`、`SettingsPage.tsx`、`NewQuestionPage.tsx`、`TryPage.tsx`、`LearnPages.tsx`；`tests/e2e/followup.spec.ts`、`themes.spec.ts` |

新增格式：日期／問題／選擇／理由／受影響檔案／驗收。不要以「代理覺得比較好」無痕替換規則或刪除重要錯誤流程。
