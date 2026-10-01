# 目前實際狀態

最後更新：2026-10-01 · App 版本 0.4.0（測試版）

**M0–M5 已實作，可在電腦瀏覽器從提問走到回顧記錄。0.4.0 依產品負責人試用回饋加入：點沙判定放寬、自動點沙、三種外觀主題、進階解讀（成事關係、點之道、證人與裁判、十二宮逐宮，草稿）。自動測試全部通過，含 Chromium、Edge、Firefox、Playwright WebKit 與模擬縮放。真機（iPhone／Android）、macOS Safari、讀屏尚未由人實測；M6 使用者試用與專家審校尚未開始。**

## 已完成（實際做過）

- [x] **M0** Vite＋React＋TypeScript 設定、lockfile、`typecheck/lint/test:unit/test:e2e/build/dev/preview` 命令。
- [x] **M1** 問題表單（三主題、手動選宮）、IndexedDB `geomancy-local` v1、Repository 交易、結果頁（解讀卡＋依據、盾盤 SVG、依位置瀏覽、十二宮卡）、日誌、筆記、教學例題。
- [x] **M2** 十六列點沙（Pointer Events、取消／多指／拖動不計、鍵盤替代、逐列保存、母象回顧、草稿恢復）、快速起卦（只在按鈕 handler 取樣一次）、手動四母、Canvas 沙粒與列化約、成盤動畫與略過、減少動態效果、兩分頁 revision 衝突。
- [x] **M3** 主題篩選與搜尋、刪除、JSON 匯出（超過 100 筆或 10 MiB 自動分檔）、匯入 validator（白名單重建、由來源重算盤與解讀逐項比對）、重複／衝突另存副本／不支援版本只讀封存、清除全部、暫存模式、暫存結果。
- [x] **M4** Manifest、自製圖示、precache、提示式更新（起卦中與筆記未保存時不提示）、安裝按鈕與 iOS 說明、360／768／1440 px 版面。
- [x] **M5** 結果頁 3 題回饋、本機試用事件（預設關閉）、回饋匯出與清除、文件更新。
- [x] **補測（2026-10-01）** Firefox／WebKit e2e；更新提示、資料庫被其他分頁升級、儲存空間不足、本機記錄純文字檢視、真實瀏覽器匯入回復；200%／400%／文字 200% 縮放。過程中修了兩個問題，見下方「本輪修正」。
- [x] **0.4.0（2026-10-01，產品負責人試用回饋）**
  - 點沙「輕點」的移動門檻 12 → 30 px（D21）：快速連點不再常被判成拖動。
  - 第四種起卦方式「自動點沙（裝置亂數）」（D22）：按一次由裝置亂數決定 16 列各 5–20 粒，先保存再播放落沙動畫，可略過。
  - 外觀主題（D23）：安靜沙盤（預設）、古典手稿、現代儀式（深色），設定頁切換；只用系統字型。
  - 進階解讀（D24）：成事關係（同象／接合／轉移／傳遞／不成事）、點之道（可在盾盤標出路徑）、證人與裁判、十二宮逐宮。由盤面即時計算、不存入記錄，文字是未審校草稿。
  - 風格樣板（設計稿）：https://claude.ai/artifact/PK8qZ81vo45c4B7RDBojGy

## 測試網址

**https://magicsmallbear.github.io/geomancy-sandboard/**（GitHub Pages，原始碼 [MAGICSMALLBEAR/geomancy-sandboard](https://github.com/MAGICSMALLBEAR/geomancy-sandboard)，見 DECISIONS D20）。

2026-10-01 部署後實測（桌面 Chromium，Playwright 對線上網址）：主要檔案皆 200 且 HTTPS；Service Worker 接管頁面；設定頁顯示「已可離線使用」；斷網後開新分頁讀取教學頁正常；console 無錯誤。這只是桌面冒煙測試，不代表真機已驗證。

更新網站：commit 後執行 `npm run deploy`（build 並強制推送 `dist/` 到 `gh-pages` 分支，約 1 分鐘後生效）。已開啟過的使用者會看到更新提示。

## 本次實際驗證

環境：Windows 11，Node v24.19.0，npm 11.17.0（2026-10-01 由 24.11.1 升級後重跑全部命令）。套件版本見 `package-lock.json`（React 19.3.0、Vite 8.3.1、TypeScript 6.0.3、react-router 7.18.4、idb 8.0.3、vite-plugin-pwa 1.3.0、Vitest 5.0.3、Playwright 1.63.0）。

| 命令 | 結果 |
|---|---|
| `npm run typecheck` | 通過，0 錯誤 |
| `npm run lint` | 通過，0 錯誤 0 警告 |
| `npm run test:core` | 10 通過／0 失敗；輸出在 [core-test-report.tap](docs/core-test-report.tap) |
| `npm run test:unit` | 4 個檔案、62 項通過（手勢判定、點沙 reducer、自動點沙來源、Repository 在 fake-indexeddb 與記憶體兩種實作、匯入匯出邊界、成事關係各種情況、65,536 盤點之道性質） |
| `npm run build` | 成功；入口 JS gzip 141.86 KiB（目標 ≤250），precache 14 項 |
| `npm run test:e2e` | 38 通過、1 略過（P05b 只在 WebKit 跑），Playwright Chromium 153.0.8010.12，對 production build（`vite preview`）執行 |
| `PW_EDGE=1 npx playwright test --project=msedge` | 38 通過、1 略過，本機安裝的 Microsoft Edge 154.0.4258.48 |
| `PW_ENGINES=1 npx playwright test` | 114 通過、3 略過：Chromium、Firefox 155.0、WebKit 26.6（Playwright 的 Windows 版，不等於 macOS／iOS Safari）。需先 `npx playwright install firefox webkit` |

端到端涵蓋（對應 [ACCEPTANCE](docs/ACCEPTANCE.md)）：

- **P01** 以真實滑鼠點擊輸入 fixture 的 224 點：16 個位置逐一與 fixture 相同、第 10 宮為 N2、依據、筆記、日誌重開同 ID。
- **P02** 5 列後刷新、第 8 列後刷新（再次顯示母象回顧），完成後只有一筆記錄。
- **P03** 由測試端注入固定位元與一次寫入失敗：連按只取樣 1 次、重試保存同一組位元、刷新與切頁不再取樣。另測「暫存結果」路徑。
- **P04** 手動四母→筆記→匯出→全新瀏覽器 context 匯入→逐欄相等→再匯入為重複→竄改 D2 被拒→筆記不同為衝突並另存副本→未知規則版本進只讀封存→HTML 問題文字以純文字顯示、未執行。
- **P05** production build 首次載入→顯示「已可離線使用」且頁面受 worker 控制→斷網→關閉分頁重開→起卦、解讀、十六象、筆記、匯出、重新整理皆可用。Playwright 的斷網模擬在 Windows WebKit 會讓所有導覽失敗（連 worker 能提供的頁面也是），所以 WebKit 改跑 **P05b**：測試自己開一個預覽伺服器，快取後真的關掉伺服器，再跑同一套離線流程。
- **`tests/e2e/robustness.spec.ts`**：
  - 更新提示：部署新版（改 sw.js）後，筆記未保存或正在點沙時不提示；離開後才提示；按下後頁面確實重新載入，記錄、筆記、未完成草稿都還在。分「第一次造訪」與「再次造訪」兩種情境。
  - 另一分頁把資料庫升到 v2：本分頁關閉連線並顯示「請重新整理」；之後開始起卦顯示「尚未保存」而不是假裝成功；重新整理後因無法開較新的資料庫而提供暫存模式。
  - 儲存空間不足（注入 `QuotaExceededError`）：點沙列與筆記都顯示「瀏覽器儲存空間不足，尚未保存」，點數與筆記文字保留；恢復後重試成功。
  - R04（本機記錄）：直接寫入被竄改與規則版本不支援的記錄，結果頁只以純文字顯示、HTML 未執行、不畫盤不解讀，「匯出原始資料」與資料庫內容逐欄相同；日誌照常開啟。
  - I09（真實 IndexedDB）：兩筆匯入、第二筆寫入時注入失敗，整批回復為 0 筆並提示；移除注入後再按一次匯入 2 筆。
- **`tests/e2e/zoom.spec.ts`**：瀏覽器 200%（640×340 CSS px）、400% 重排（320×170）、只放大文字 200%。每個主要頁面檢查：無橫向溢出、沒有文字被 overflow 裁切、固定區塊不超過畫面 40%；點沙按鈕、對話框按鈕、開始起卦、排盤、保存筆記都能捲到而且點得到。這是版面檢查，不是有人實際用放大瀏覽。
- **C01–C09、S04–S07、R01、R03、E02、E04、E05**：見 `tests/e2e/interaction.spec.ts`。I02–I09、S01–S03、E03、E06、C11 在 `tests/unit/`。
- 版面：360／768／1440 px 各主要頁面無橫向溢出，點沙按鈕 ≥44 px；截圖在 [docs/evidence/](docs/evidence/)（每次跑 e2e 會覆寫）。
- 色彩對比（以色票計算，非儀器量測）：正文 13.2:1、次要文字 6.3:1、強調色文字 6.2:1、按鈕反白 6.9:1，皆高於 4.5:1。

## 待驗證（沒有做過，不可當作通過）

- [ ] **iPhone Safari、Android Chrome 真機**：多點觸控、防誤觸、軟鍵盤、旋轉、背景切換、加入主畫面、離線重開。`tests/e2e/touch.spec.ts` 只是桌面 Chromium 的觸控模擬。檢查表見 [DEVICE-CHECKLIST](docs/DEVICE-CHECKLIST.md)。
- [ ] macOS／iOS Safari：Playwright WebKit（Windows 版）已通過，但不是真正的 Safari。
- [ ] 讀屏（NVDA／VoiceOver）實際朗讀、完整鍵盤走查、人實際用放大瀏覽。程式已加上標籤、live region 與鍵盤替代，縮放有自動版面檢查，但沒有用輔助工具實測。
- [ ] 資料庫 `blocked` 提示（「另一個分頁正在使用舊版資料」）：目前資料庫是 v1，第一次建立時不可能有更舊的連線，這條路徑要等未來升到 v2 才可能出現；那時要補測。
- [ ] 真實的儲存空間不足：自動測試是注入瀏覽器會丟出的同一種錯誤，沒有真的把磁碟配額用完。
- [ ] 手機經區網 `http://192.168.x.x` 開啟：不是安全來源，預期沒有離線與安裝功能；這個情境沒有實測。真機測試請改用上方 HTTPS 測試網址。
- [ ] M6：5–8 位使用者試用、地占專家逐條審校中文解讀。

## 已知限制與問題

- 進階解讀的文字（成事、點之道、證人與裁判、十二宮逐宮）是本產品原創草稿，十二宮逐宮是「象在宮中的傾向 × 宮位問題」的組合式文字，全部未經地占專家審校。成事規則依 G06、點之道依 G07；Greer 原書未能直接核對。宮位環狀相鄰、摘要排序是本產品的明確選擇（D24）。
- 進階解讀不存入記錄，規則或文字更新後，舊記錄重開會看到新版本的進階解讀（基礎解讀仍是當時的快照）。
- 古典手稿主題使用系統楷體：Apple 裝置有楷體、Windows 用標楷體；Android 通常沒有楷體，會顯示一般襯線字。
- 舊版 App（0.3.x）不認得自動點沙的來源，匯入含自動點沙的備份會判為格式不正確。
- 三個引擎同時跑完整 e2e 時，偶爾有個別測試因負載超時（本輪見過 S05、P01 各一次），單獨重跑三次都通過；完整重跑全部通過。

- 解讀是 `basic-symbolic`／`editorial-draft`：沒有成就、相位、點之道，不判斷成敗；文案未經專家審校。
- 列化約動畫播放的約 0.8 秒內沙盤鎖定，這段時間的點擊不計（可按「略過」）。
- 試用事件沒有記 `session_left`；`elapsedMs` 未扣除背景停留（匯出檔內有註明）。
- 音效只有一個合成的短音，預設關閉。
- 一次只保留一筆進行中的草稿；快速／手動模式未按下確認前的輸入不跨刷新保留（依規格）。
- 本機資料庫已被較新版本升級（例如之後部署了 v2 又退回舊版）時，舊版開啟會顯示「無法使用本機儲存（可能是私密瀏覽模式、儲存空間已滿…）」並提供暫存模式。行為安全，但原因說明不精確；目前只有 v1，暫不處理。
- 測試網址是公開的，拿到網址的人都能開；原始碼 repo 也是公開的。沒有後端、帳號、AI、付費或第三方追蹤，資料只存在各自的瀏覽器。

## 本輪修正（2026-10-01）

- **第一次造訪後按「更新並重新載入」沒有反應**：分頁第一次開啟時還沒受 worker 控制，workbox 把之後的新版當成 external，vite-plugin-pwa 只在 `isUpdate` 時重新載入，結果新版已啟用但頁面不重載、提示一直留著。`src/app/pwa.ts` 的 `acceptUpdate` 改為自己監聽 `controllerchange` 後重新載入。已確認拿掉修正時「第一次造訪」測試會失敗。
- **400% 縮放時點沙頁底部操作列蓋住約 70% 畫面**：視窗高度 ≤300 CSS px 時操作列改為不固定（`src/styles/app.css`）。手機直放、橫放都高於這個值，行為不變。已確認拿掉修正時 400% 測試會失敗。

## 啟動方式

```sh
npm install          # 首次
npm run dev          # 開發：http://localhost:5173
npm run build        # 產生 dist/
npm run preview      # 預覽 production build：http://localhost:4173（離線與安裝要用這個測）
```

`dist/` 是純靜態檔，可放到任何支援 HTTPS 的靜態主機；路由用 hash，不需要伺服器改寫規則。換網域等於換一個本機資料庫，記錄要靠匯出／匯入搬移。

## 下一位接手者的第一步

讀本檔與 `docs/DECISIONS.md`，執行 `npm run test:core && npm run test:unit && npm run test:e2e` 重現結果。接著依 [DEVICE-CHECKLIST](docs/DEVICE-CHECKLIST.md) 用上方測試網址做真機驗證，再依 [PILOT](docs/PILOT.md) 安排 M6。
