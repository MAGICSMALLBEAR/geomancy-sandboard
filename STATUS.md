# 目前實際狀態

最後更新：2026-10-01 · App 版本 0.3.0（測試版）

**M0–M5 已實作，可在電腦瀏覽器從提問走到回顧記錄。自動測試全部通過。真機（iPhone／Android）、Safari、讀屏與 200% 縮放尚未由人實測；M6 使用者試用與專家審校尚未開始。**

## 已完成（實際做過）

- [x] **M0** Vite＋React＋TypeScript 設定、lockfile、`typecheck/lint/test:unit/test:e2e/build/dev/preview` 命令。
- [x] **M1** 問題表單（三主題、手動選宮）、IndexedDB `geomancy-local` v1、Repository 交易、結果頁（解讀卡＋依據、盾盤 SVG、依位置瀏覽、十二宮卡）、日誌、筆記、教學例題。
- [x] **M2** 十六列點沙（Pointer Events、取消／多指／拖動不計、鍵盤替代、逐列保存、母象回顧、草稿恢復）、快速起卦（只在按鈕 handler 取樣一次）、手動四母、Canvas 沙粒與列化約、成盤動畫與略過、減少動態效果、兩分頁 revision 衝突。
- [x] **M3** 主題篩選與搜尋、刪除、JSON 匯出（超過 100 筆或 10 MiB 自動分檔）、匯入 validator（白名單重建、由來源重算盤與解讀逐項比對）、重複／衝突另存副本／不支援版本只讀封存、清除全部、暫存模式、暫存結果。
- [x] **M4** Manifest、自製圖示、precache、提示式更新（起卦中與筆記未保存時不提示）、安裝按鈕與 iOS 說明、360／768／1440 px 版面。
- [x] **M5** 結果頁 3 題回饋、本機試用事件（預設關閉）、回饋匯出與清除、文件更新。

## 本次實際驗證

環境：Windows 11，Node v24.11.1，npm 11.6.2。套件版本見 `package-lock.json`（React 19.3.0、Vite 8.3.1、TypeScript 6.0.3、react-router 7.18.4、idb 8.0.3、vite-plugin-pwa 1.3.0、Vitest 5.0.3、Playwright 1.63.0）。

| 命令 | 結果 |
|---|---|
| `npm run typecheck` | 通過，0 錯誤 |
| `npm run lint` | 通過，0 錯誤 0 警告 |
| `npm run test:core` | 10 通過／0 失敗；輸出在 [core-test-report.tap](docs/core-test-report.tap) |
| `npm run test:unit` | 3 個檔案、46 項通過（手勢判定、點沙 reducer、Repository 在 fake-indexeddb 與記憶體兩種實作、匯入匯出邊界） |
| `npm run build` | 成功；入口 JS gzip 135.14 KiB（目標 ≤250），precache 14 項 |
| `npm run test:e2e` | 19 項通過，Playwright Chromium 153.0.8010.12，對 production build（`vite preview`）執行 |
| `PW_EDGE=1 npx playwright test --project=msedge` | 19 項通過，本機安裝的 Microsoft Edge 154.0.4258.37 |

端到端涵蓋（對應 [ACCEPTANCE](docs/ACCEPTANCE.md)）：

- **P01** 以真實滑鼠點擊輸入 fixture 的 224 點：16 個位置逐一與 fixture 相同、第 10 宮為 N2、依據、筆記、日誌重開同 ID。
- **P02** 5 列後刷新、第 8 列後刷新（再次顯示母象回顧），完成後只有一筆記錄。
- **P03** 由測試端注入固定位元與一次寫入失敗：連按只取樣 1 次、重試保存同一組位元、刷新與切頁不再取樣。另測「暫存結果」路徑。
- **P04** 手動四母→筆記→匯出→全新瀏覽器 context 匯入→逐欄相等→再匯入為重複→竄改 D2 被拒→筆記不同為衝突並另存副本→未知規則版本進只讀封存→HTML 問題文字以純文字顯示、未執行。
- **P05** production build 首次載入→顯示「已可離線使用」且頁面受 worker 控制→斷網→關閉分頁重開→起卦、解讀、十六象、筆記、匯出、重新整理皆可用。
- **C01–C09、S04–S07、R01、R03、E02、E04、E05**：見 `tests/e2e/interaction.spec.ts`。I02–I09、S01–S03、E03、E06、C11 在 `tests/unit/`。
- 版面：360／768／1440 px 各主要頁面無橫向溢出，點沙按鈕 ≥44 px；截圖在 [docs/evidence/](docs/evidence/)（每次跑 e2e 會覆寫）。
- 色彩對比（以色票計算，非儀器量測）：正文 13.2:1、次要文字 6.3:1、強調色文字 6.2:1、按鈕反白 6.9:1，皆高於 4.5:1。

## 待驗證（沒有做過，不可當作通過）

- [ ] **iPhone Safari、Android Chrome 真機**：多點觸控、防誤觸、軟鍵盤、旋轉、背景切換、加入主畫面、離線重開。`tests/e2e/touch.spec.ts` 只是桌面 Chromium 的觸控模擬。檢查表見 [DEVICE-CHECKLIST](docs/DEVICE-CHECKLIST.md)。
- [ ] macOS Safari、Firefox、Playwright WebKit：都沒有跑過。
- [ ] 讀屏（NVDA／VoiceOver）實際朗讀、完整鍵盤走查、瀏覽器 200% 縮放的人工檢查。程式已加上標籤、live region 與鍵盤替代，但沒有用輔助工具實測。
- [ ] 新版本更新提示（`needRefresh`）、資料庫 `blocked／versionchange` 提示、真實配額不足（`QUOTA`）：有程式路徑，沒有自動或人工測試。
- [ ] 本機記錄驗證失敗時的「只能以純文字檢視」畫面：只由單元測試覆蓋判定邏輯，畫面未測。
- [ ] I09 整批匯入 rollback 只在 fake-indexeddb 與記憶體實作測過，沒有在真實瀏覽器注入中途失敗。
- [ ] 手機經區網 `http://192.168.x.x` 開啟：不是安全來源，預期沒有離線與安裝功能；這個情境沒有實測。
- [ ] M6：5–8 位使用者試用、地占專家逐條審校中文解讀。

## 已知限制與問題

- **這台電腦的 Node 是 24.11.1，低於 `engines` 要求的 24.12。** `npm install` 會出現 EBADENGINE 警告。另外，Node 24.11.1 的 `fs.rmSync(…, { recursive: true })` 在含中文的路徑下會讓行程直接當掉（已用暫存目錄重現）；Vite 清空 `dist/` 會踩到，所以 build 改由 `scripts/clean.mjs` 清目錄。升級 Node 後是否還需要這個繞道，尚未確認。詳見 [DECISIONS](docs/DECISIONS.md) D12。
- 解讀是 `basic-symbolic`／`editorial-draft`：沒有成就、相位、點之道，不判斷成敗；文案未經專家審校。
- 列化約動畫播放的約 0.8 秒內沙盤鎖定，這段時間的點擊不計（可按「略過」）。
- 試用事件沒有記 `session_left`；`elapsedMs` 未扣除背景停留（匯出檔內有註明）。
- 音效只有一個合成的短音，預設關閉。
- 一次只保留一筆進行中的草稿；快速／手動模式未按下確認前的輸入不跨刷新保留（依規格）。
- Git 已 `git init`，**尚未建立任何 commit**。
- 沒有公開網址、後端、帳號、AI、付費或第三方追蹤。

## 啟動方式

```sh
npm install          # 首次
npm run dev          # 開發：http://localhost:5173
npm run build        # 產生 dist/
npm run preview      # 預覽 production build：http://localhost:4173（離線與安裝要用這個測）
```

`dist/` 是純靜態檔，可放到任何支援 HTTPS 的靜態主機；路由用 hash，不需要伺服器改寫規則。換網域等於換一個本機資料庫，記錄要靠匯出／匯入搬移。

## 下一位接手者的第一步

讀本檔與 `docs/DECISIONS.md`，執行 `npm run test:core && npm run test:unit && npm run test:e2e` 重現結果。接著依 [DEVICE-CHECKLIST](docs/DEVICE-CHECKLIST.md) 做真機驗證（需要 HTTPS 測試網址，由產品負責人決定），再依 [PILOT](docs/PILOT.md) 安排 M6。
