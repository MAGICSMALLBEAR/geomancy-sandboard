# 新對話的開工提示詞

使用前先讓 Codex／Claude Code 開啟本包所在專案目錄，或把整個 ZIP 附上。若只是一般聊天，代理未必能讀本機檔案。以下提示詞本身不包含全部規格，必須與檔案一起提供。

## 首次開工：複製這段

```text
請直接開始實作這個「地占沙盤」第一版 App，直到能在手機和桌面瀏覽器試用。

需求、流程和驗收已寫在目前專案資料夾，不要另起一套不同產品，也不要只回覆開發計畫。
先讀 AGENTS.md、README.md、STATUS.md、SPEC.md、TASKS.md，再依工作內容讀 docs/ 裡的
ENGINE-AND-DATA.md、IMPLEMENTATION.md、ACCEPTANCE.md、PILOT.md、RESEARCH.md。
請先確認你確實能讀到這些檔案；如果缺檔，明確指出缺哪一份。

本包有已測試的 TypeScript 地占核心與固定例題。先執行 npm run test:core，
再從 TASKS.md 的 M0 開始，按 M0→M5 連續完成。可自行處理一般工程細節。
採 React + TypeScript + Vite，單一專案、繁體中文、PWA、本機 IndexedDB。
第一版包含提問引導、16 列點沙、快速亂數、手動四母、盾盤／十二宮、
附證據的基礎象徵解讀、日誌、JSON 備份匯入、離線與減少動態效果。

排盤沿用 western-sequential-v1；一點是 bit 1、兩點是 bit 0。
動畫不產生卦，重新整理與保存失敗不能重抽。解讀內容仍是編輯草稿，
畫面要如實標示，不能假裝已完成專家審校或完整傳統斷事。
先不加 AI API、登入、後端、付款、雲端同步或第三方追蹤。

建立真正可操作的畫面與資料流程，不用假的已保存訊息或固定假結果充數。
保留原有檔案和測試；新依賴鎖定版本並保留 lockfile。
每個階段都更新 STATUS.md，寫明已完成、實際測試結果、限制與下一步。
完成後執行型別檢查、lint、核心／UI／端到端測試與 production build，修正問題。
提供本機啟動方式、可試用的預覽、完成清單及待人工驗證項目。
沒有真機時把 iPhone／Android 真機項目列為待驗證，不要把模擬當成真機通過。
本輪先交可試用版本；公開部署或付費服務另依我的指示處理。
```

## 中途換對話：複製這段

```text
請接續目前專案的地占沙盤 App 開發。先讀 AGENTS.md、STATUS.md、TASKS.md、
docs/DECISIONS.md，檢查實際檔案與 Git 狀態，再按未完成里程碑繼續。
需要時回查 SPEC.md、ENGINE-AND-DATA.md 與 ACCEPTANCE.md。
不要重新建立專案、覆蓋既有修改或把已完成的核心換成另一套規則。
先重現最近相關測試，再完成剩餘工作。保持 STATUS.md 與實作一致；
最終交付可操作預覽、測試證據、限制與真機待驗證項目。
```

## 第一輪試用後：複製這段並附回饋

```text
請依 docs/PILOT.md 整理我附上的第一輪試用回饋，和目前實作／STATUS.md 對照。
先分開資料或運算錯誤、操作卡點、解讀不理解、功能建議。
優先修會導致錯盤、遺失資料、無法完成或最常誤解的問題。
每個改動寫出對應觀察、預期改善、影響範圍與驗收方式，再完成已可確定的修正。
不要因個別意見一次加入所有功能，也不要把主觀覺得準當成算法正確證據。
重大新範圍另外列出具體提案，保留現有可用流程。
```

Codex 專案指示檔的依序讀取方式見 [官方 AGENTS.md 文件](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。Claude Code 的 `@` 引用方式見 [官方 memory 文件](https://code.claude.com/docs/en/memory)。這些檔案能提供上下文，不能取代實際測試或保證代理一定遵守每項規格。
