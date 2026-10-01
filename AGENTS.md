# 地占沙盤專案指示

目標：完成繁體中文、手機與桌面可用的本機優先 PWA 測試版。

先讀 `README.md`、`STATUS.md`、`SPEC.md`、`TASKS.md`。實作前按需要讀 `docs/ENGINE-AND-DATA.md`、`docs/IMPLEMENTATION.md`、`docs/ACCEPTANCE.md`；來源在 `docs/RESEARCH.md`。

## 不可默默更改的契約

- bit 1＝一點、bit 0＝兩點；四行上到下；四女轉置，後續 XOR。
- 規則 `western-sequential-v1`，前十二位依序入宮；邏輯與視覺左右分開。
- 只有明確快速起卦 action 呼叫 Web Crypto；render/effect/動畫/重試不重抽。
- 有效指標放開才加點；cancel／多指／合成 click 不多算；見 SPEC 門檻。
- 每列確認後持久保存；完整結果沿用草稿 ID、交易原子化、防重入。
- 解讀用本機 deterministic claims＋證據。內容是 `editorial-draft`，禁止冒稱專家已審校。
- P0 無後端、帳號、API Key、付款與 AI；不增加外部追蹤或問題上傳。
- 中文用繁體；資料不放 URL／console；匯入資料視為不可信，純文字顯示。
- 不複製競品程式或解讀庫；現有 core 為本案新寫參考。

## 工作方式

依 M0→M5 連續實作，不只提計畫或做靜態頁。保留既有使用者修改。
開工先 `npm run test:core`；現有程式可用 Node 24.12+ 直接跑，無外部依賴。
接上 UI 後補 typecheck、lint、unit、e2e 與 build，並按驗收文件跑相關測試。
現有 Node TypeScript 執行不等於靜態型別檢查。

每階段更新 `STATUS.md`：做了什麼、實際命令與結果、已知問題、下一步。
未測的裝置或功能必須標待驗證。沒有真機不可宣稱 iPhone／Android 驗收通過。
一般實作細節自行決定；重大範圍變更寫進 `docs/DECISIONS.md`。
對外發布、收費、跨裝置資料傳送不是這份啟動任務的預設範圍。
