# 演算法、解讀與資料契約

本文件是實作規則，不是占卜入門文章。`src/domain/` 已提供可執行參考；欄位驗證、IndexedDB 與 UI 還須依下列規格完成。

## 1. 版本與表示法

| 名稱 | 第一版值 | 變更原則 |
|---|---|---|
| `schemaVersion` | `1` | 儲存與匯出格式；破壞相容性需遷移 |
| `ruleVersion` | `western-sequential-v1` | 算法、順序入宮、解讀技法的集合 |
| `contentVersion` | `zh-TW-basic-draft-v1`；0.7.1 起新記錄為 `zh-TW-basic-draft-v2` | 中文象義與規則文案版本；已發布的版本凍結，改文字要新增版本（§10） |
| `scope` | `basic-symbolic` | 本版只含基礎象徵解讀 |
| `reviewStatus` | `editorial-draft` | 不得自行改成已審核 |

四行由上至下是火、風、水、土；這是行的索引順序，不等於給每個完整卦象套入單一元素。內部 `Figure=[Bit,Bit,Bit,Bit]`；一點為 `1`、兩點為 `0`。例如顯示圖式 `2211` 對應位元 `[0,0,1,1]`。存檔用位元陣列；文字圖式僅展示與交叉驗證，絕對不能當成二進位整數直接算。

`Mothers=[M1,M2,M3,M4]`，每個 Figure 恰好 4 位。`NodeId` 是位置 ID，`FigureId` 是十六象之一；同一 FigureId 可出現在多個 NodeId。

## 2. 來源歸一化

| `CastSource.kind` | 必要資料 | 四母象轉換 |
|---|---|---|
| `dots` | `counts` 長度 16，每數為 1–4096 的整數 | 每數 `n%2`，每連續四數為一母 |
| `auto` | `algorithm='webcrypto-counts-v1'`；`counts` 長度 16，每數為 5–20 的整數 | 與 `dots` 相同：每數 `n%2`，每連續四數為一母 |
| `quick` | `algorithm='webcrypto-16bits-v1'`；`bytes` 恰好兩個 0–255 整數 | 第一 byte 高位至低位，再第二 byte；每四位一母 |
| `manual` | `mothers` 恰好四個合法 Figure | 複製為四母象，不臆造 counts |
| `press` | `algorithm='webcrypto-press-v1'`；`bytes` 恰好四個 0–255 整數 | 第 i 個 byte 的最高四位（bit 7→4）由上到下為第 i 母象；不臆造 counts |

快速模式一次呼叫 `getRandomValues(new Uint8Array(2))`。例如 `[0xAC,0xF0]` 對應位元 `1010 1100 1111 0000`，圖式依序為 `1212,1122,1111,2222`。均勻的 16 位輸入沒有模除偏差；這是軟體轉換性質，不代表人的點沙行為均勻。

自動點沙（2026-10-01 新增，DECISIONS D22）一次呼叫 `getRandomValues(new Uint8Array(16))`，每列粒數為 `5 + (byte & 15)`。低 4 位元均勻，所以 5–20 每個值機率相同，奇偶各半，沒有模除偏差。舊版 App 不認得 `auto`，匯入這類記錄會判為格式不正確，不會進入一般記錄。

四次長按（2026-10-04 新增，DECISIONS D28）每次完整長按放開時呼叫一次 `getRandomValues(new Uint8Array(1))`，取得的 byte 立刻以 `confirmPress` 存入草稿的 `confirmedPresses`，第四次後鎖定為來源。按住時間只決定手勢是否成立（至少 1000 ms、在圓圈內放開、單指），從不進入亂數。保存失敗時重試同一個 byte，不再取數。舊版 App 不認得 `press`，匯入這類記錄會判為格式不正確。

亂數來源只在明確的起卦 action 呼叫；排盤、閱讀結果、動畫、重新整理、React render/effect 都不能呼叫。`random.ts` 是外部取樣邊界，`geomancy.ts` 不含亂數、時間、DOM 或 I/O。測試可注入固定 bytes；正式介面不能讓 debug fixture 冒充隨機起卦。

## 3. 排盤算法與畫面順序

對 `A[i]`、`B[i]` 逐行 XOR。以顯示點數解釋：1+1→2、2+2→2、1+2→1、2+1→1。

```text
D1 = [M1[0], M2[0], M3[0], M4[0]]
D2 = [M1[1], M2[1], M3[1], M4[1]]
D3 = [M1[2], M2[2], M3[2], M4[2]]
D4 = [M1[3], M2[3], M3[3], M4[3]]

N1 = M1 XOR M2       N2 = M3 XOR M4
N3 = D1 XOR D2       N4 = D3 XOR D4
RW = N1 XOR N2       LW = N3 XOR N4
J  = RW XOR LW       R  = J XOR M1
```

四女是矩陣轉置，不是 XOR，也不是把整個點陣轉 90 度後隨便依視覺順序讀。公式與盤位來源可查 [盾盤原文](https://digitalambler.com/2020/05/08/how-to-construct-the-shield-chart-of-geomancy/)。

邏輯順序與視覺順序分開固定：

```text
邏輯：M1 M2 M3 M4 D1 D2 D3 D4 N1 N2 N3 N4 RW LW J R

畫面左 → 右：
D4   D3   D2   D1   M4   M3   M2   M1
   N4        N3        N2        N1
         LW                  RW
                     J
             R（預設收合）
```

線段依 `PARENTS` 真實關係畫，不以 DOM 相鄰推算。R 放在裁判下方是產品排版選擇。15 位盾盤只是隱藏 R，運算與保存仍有全部 16 位。

十二宮固定順序：1–4→M1–M4；5–8→D1–D4；9–12→N1–N4。來源選擇參照 [順序入宮說明](https://digitalambler.com/2020/05/04/on-making-the-house-chart-from-the-shield-chart/)。不混入 Golden Dawn 的另一種入宮法，也不把 13–16 位當成另外四個占星宮。

## 4. 十六象唯一對照表

圖式為顯示點數，拉丁 ID 穩定，中文為工作譯名。此版以 [歷史圖式頁 G03](https://www.100thmonkeypress.com/biblio/acrowley/periodicals/geomancy/geomancy.pdf) 為圖式參照；Puer／Puella 等歷史差異見 [G05](https://www.princeton.edu/~ezb/geomancy/figures.html)。

| FigureId | 拉丁名／中文工作譯名 | 圖式 |
|---|---|---|
| `via` | Via／道路 | 1111 |
| `populus` | Populus／群眾 | 2222 |
| `fortuna-major` | Fortuna Major／大幸運 | 2211 |
| `fortuna-minor` | Fortuna Minor／小幸運 | 1122 |
| `acquisitio` | Acquisitio／獲得 | 2121 |
| `amissio` | Amissio／失去 | 1212 |
| `conjunctio` | Conjunctio／交會 | 2112 |
| `carcer` | Carcer／囚牢 | 1221 |
| `laetitia` | Laetitia／喜悅 | 1222 |
| `tristitia` | Tristitia／悲傷 | 2221 |
| `puer` | Puer／少年 | 1121 |
| `puella` | Puella／少女 | 1211 |
| `albus` | Albus／白 | 2212 |
| `rubeus` | Rubeus／紅 | 2122 |
| `caput-draconis` | Caput Draconis／龍首 | 2111 |
| `cauda-draconis` | Cauda Draconis／龍尾 | 1112 |

不要根據中文名稱猜圖式。資料編輯器或程式更新須保證 16 個圖式不重複且完整覆蓋 2⁴ 種組合。

## 5. 固定教學例題與不變量

輸入 `fixtures/teaching.json`：

```text
M1 原始 13 15 12 17 → 1121 Puer
M2 原始 12 13 15 17 → 2111 Caput Draconis
M3 原始 12 14 16 13 → 2221 Tristitia
M4 原始 12 14 13 16 → 2212 Albus

D1 1222  D2 1122  D3 2121  D4 1112
N1 1212  N2 2211  N3 2122  N4 1211
RW 1221  LW 1111  J 2112   R 1211
```

此例第 10 宮是 N2／Fortuna Major；裁判為 Conjunctio。驗收時用這個固定例題核對手機、桌面、匯入後重開的每個位置，不能只確認裁判。

現有 10 項測試涵蓋以下數學性質：

- `x XOR x = Populus`；`x XOR Populus = x`。
- 母象轉置兩次回到原母象。
- 完整 65,536 組輸入皆與「顯示點數相加再取奇偶」的獨立測試算法一致。
- 裁判只有 Via、Populus、Fortuna Major、Fortuna Minor、Acquisitio、Amissio、Conjunctio、Carcer 八種；每種恰有 8192 組四母輸入。
- `N1 XOR J = M2 XOR R = N2 XOR LW`。
- 含 R 的 16 個位置一定存在重複的象；不能用「抽滿 16 象」驗證。
- 快速模式全部 65,536 個 byte pair 與四母組合一一對應。

這些是自行枚舉驗證的運算性質；不能把裁判偶數點檢查用作「這個問題可以問／不可以問」的占斷。

## 6. 基礎解讀的組合規則

`buildReading(mothers, question)` 重算盤面，查本機內容表，回傳結構化 claims。所有模板是本案原創草稿；引用來源提供術語與傳統背景，不表示來源作者認可這套 App 的現代文案。

| claimId | ruleId | 需要的證據 | 實際輸出 |
|---|---|---|---|
| `overall` | `basic.judge-theme.v1` | J | 裁判象名、關鍵詞及範圍說明 |
| `witnesses` | `basic.witness-pair.v1` | RW、LW | 兩證人象義並列；不固定時序 |
| `querent` | `basic.house-context.v1` | M1／第 1 宮 | 自己與當下處境的象徵主題 |
| `topic` | `basic.house-context.v1` | 所選宮對應位置 | 問題宮的象義；一般主題省略 |
| `reflection` | `editorial.reflection.v1` | J＋主題模板 | 原創反思問題，標記為反思 |

每個 claim 保存 `claimId,ruleId,kind,title,text,evidence[],sourceIds[]`。evidence 含 `nodeId,figureId,dots`，與宮位相關者再加 `house`。同一輸入與版本產出相同文案，順序固定；不存在無依據的自由生成欄位。

現有十六象原創摘要存於 `catalog.ts`；只有 8 種可能出現在裁判，但保留完整 16 象供其他盤位與學習頁使用。不要另做 16×12×主題的重複長文表，先以位置、宮位和象義組合；未來專家若需要特定配對規則，新增獨立 ruleId 與測試。

問題文字不傳給外部模型、不當成程式指令、不以關鍵字偷偷換內容。畫面顯示使用者文字時以純文字處理，不使用 `dangerouslySetInnerHTML` 或可執行 Markdown。

## 7. 儲存資料與交易

TypeScript 介面在 `src/domain/contracts.ts`。完整記錄保存以下資訊：

| 欄位 | 要求 |
|---|---|
| `id` | 起草時建立的 UUID；完整記錄沿用相同 ID |
| `revision` | 完整記錄從 0 開始，每次筆記修改加 1；與時間戳分開作衝突判定 |
| `createdAt/updatedAt` | ISO 8601 UTC；畫面依裝置時區格式化 |
| `question` | text、timeframe、topic、targetHouse |
| `source` | 三選一的原始來源，必須能重建 mothers |
| `mothers/chart` | 固定輸入與完整 16 位置的保存快照 |
| `reading` | 當時版本的 claims 與內容快照 |
| `notes` | 可編輯回顧，不改盤與原始問題 |
| `integrity` | 本機／相容匯入驗證後為 `verified`；不代表真偽認證 |
| `importOrigin` | 選填；衝突另存副本時記原始 ID 與匯入時間 |

所有新資料以目前合法的 rule/content 版本建立。歷史記錄開啟時優先顯示當時 reading；不因部署新的內容庫而整批改寫舊判詞。未來要比較新解讀，須另存一個明確版本，不能覆蓋。

### IndexedDB stores

資料庫名 `geomancy-local`，DB version 1：

| Store | Key／索引 | 用途 |
|---|---|---|
| `drafts` | keyPath `id`；updatedAt | 最多一個進行中草稿 |
| `readings` | keyPath `id`；createdAt、question.topic | 完整記錄；主題索引使用巢狀 keyPath |
| `settings` | keyPath `key` | 音效、動態效果、試用流程開關 |
| `feedback` | keyPath `id`；createdAt | 本機試用評分與事件，與占問分開 |
| `archives` | keyPath `archiveId` | 結構可讀但規則／版本不支援的只讀匯入檔 |

第一次使用無須預放真實日誌。教學 fixture 只在教學與測試入口使用。新增占問發現已有草稿時，顯示「繼續／放棄並新增」，不在背景建立一堆草稿。

### 交易 API（下一階段實作）

```ts
createDraft(question, method): Promise<Draft>
loadDraft(id): Promise<Draft | null>
confirmRow(id, expectedRevision, count): Promise<Draft>
prepareSource(id, expectedRevision, source): Promise<Draft>
finalizeDraft(id): Promise<ReadingRecord>
getReading(id): Promise<ReadingRecord | null>
saveNotes(id, expectedRevision, notes): Promise<ReadingRecord>
deleteReading(id): Promise<void>
```

`confirmRow` 在讀寫交易內讀取草稿、比較 revision、附加一列、遞增 revision；到第 16 列設 `ready-to-finalize` 並填入完整 dots source。不能先更新頁面狀態再假裝 DB 成功。

`prepareSource` 只用於 quick/manual；若已有 preparedSource，回傳既有值或明確拒絕替換，絕不覆寫。進入 `ready-to-finalize` 後輸入鎖定。

`finalizeDraft` 在同一個跨 `drafts/readings` 的原子交易中，先查相同 ID 完整記錄；存在就回傳它。否則讀草稿、驗證來源、同步重算 chart/reading、加入完整記錄、刪草稿。使用 `add` 防止覆寫。交易內不等待網路、亂數、定時器或任意長操作；計算只是小型同步函式。

如果需在交易外做昂貴工作，先取快照計算，再在交易內重讀並比對 revision；本版不需要那種複雜度。筆記保存以記錄的整數 revision 防止兩分頁互相覆蓋，不以可能同毫秒的 updatedAt 當唯一鎖。衝突保留尚未保存的本地文字供使用者選擇。

完成最後一列但尚未成盤就崩潰，恢復時能從 ready 草稿繼續；成盤交易成功後崩潰，則直接找到同 ID 記錄。這是避免重抽與重複記錄的核心。

## 8. 匯出、匯入與不支援版本

匯出外層：`{format:'geomancy-journal',schemaVersion:1,exportedAt,records:[...]}`。格式用 UTF-8 JSON、兩空格縮排；檔名如 `geomancy-backup-2026-09-30.json`。不含未完成草稿、設定或回饋；回饋用另一種格式。

每個檔案最多 100 筆、10 MiB。若備份更大，分割多個檔案，標明 part 編號；不能把超過上限的單檔匯出後又拒絕自家匯入。已知單筆有長度上限，不應超過 10 MiB；遇到超大只讀 archive 提供原檔下載，不重新包進一般記錄。

匯入順序：

1. 先驗 file.size≤10 MiB，再解析 JSON；拒絕非物件、錯誤 format 與過多記錄。解析深度上限 16；不以遞迴合併把未知鍵寫入原型。
2. 只挑出白名單欄位建立新物件；不得用未驗證輸入 `Object.assign` 到既有實例。限制 ID 為 UUID 形式，來源 ID／版本文字各≤80，日期必須可解析成 UTC ISO。
   `revision` 必須是非負安全整數；importOrigin 若存在，也需驗 UUID 與日期。備份格式不能依 TypeScript 型別宣告就跳過這些 runtime 檢查。
3. 已知 schema/rule/content 驗四母與所有 bits、count、bytes、question 組合；問題≤500、時間≤80、notes≤5000。reading最多 16 個 claims；每段 text≤2000、title≤100，每組 evidence≤16、sourceIds≤16。圖式只允許四位 1/2；FigureId/NodeId/house 都驗範圍。
4. 從 source 重算 mothers、chart；任何不合都拒絕該筆，不能只檢查 J。對完全相同 contentVersion，重算 reading 並比對所有已知內容與證據。除 notes／timestamps 等明確可變欄位外，不容許手改判詞冒充本包版本。
5. 版本不支援而結構可安全解析者，列為「只讀封存」。確認後存入 archives：保存原 JSON 與基本時間／問題預覽，所有預覽純文字；不視為 ReadingRecord、不執行規則、不納入一般日誌判讀。可下載原檔，未來支援後另行遷移。
6. 顯示逐筆預覽與錯誤原因，使用者確認後只加入有效選取記錄。全批入庫用一筆交易，失敗全部 rollback，不出現一半成功卻整批顯示成功。

同 ID 處理：完整標準化資料相同就跳過重複；內容或筆記不同列為衝突。使用者可「略過」或「另存副本」；副本產生新 UUID 並填 importOrigin，絕不自動覆寫舊筆記。這不需要引入雲端同步或內容雜湊協定。

`integrity='verified'` 只代表與本機規則一致。匯出檔沒有簽章，無法證明真的由某人點沙、何時點沙、亂數是否真的來自 Web Crypto；產品不提供這種來源認證。

## 9. 錯誤碼與提示

| Code | 建議顯示 | 恢復 |
|---|---|---|
| `INVALID_COUNTS/FIGURE/MOTHERS` | 輸入格式不完整，請檢查四母象／列數 | 保留輸入供修正 |
| `RNG_UNAVAILABLE` | 目前無法使用裝置亂數 | 換方法，不使用替代亂數 |
| `STORAGE_UNAVAILABLE/QUOTA` | 尚未保存，請重試或匯出備份 | 留住記憶體輸入 |
| `REVISION_CONFLICT` | 另一個分頁已更新這筆草稿 | 重新載入，保留本地筆記 |
| `INTEGRITY_MISMATCH` | 盤面與原始資料不一致 | 拒絕匯入／隔離舊記錄 |
| `UNSUPPORTED_VERSION` | 此版本只能封存檢視 | 不重算，允許下載原檔 |
| `IMPORT_TOO_LARGE` | 檔案超過本版容量限制 | 提示分割備份 |

在記錄技術錯誤時只收錯誤碼和版本。問題文字、notes、完整備份不寫到 console、錯誤上報或 URL。

## 10. 新增內容版本（專家審校後改文字）

基礎解讀存進每一筆記錄，匯入與開啟時會用同一版本重組文字逐字比對。所以**已發布的內容版本永遠不能改**，改文字一律新增版本（ACCEPTANCE R05）。

- `src/domain/readingV1.ts` 是 `zh-TW-basic-draft-v1` 的凍結副本，自帶十六象、十二宮與範本文字，不讀 `catalog.ts`。不要編輯。
- `src/domain/readingV2.ts` 是 `zh-TW-basic-draft-v2`（D29）：沿用 v1 的十六象、十二宮與提示表，只改「問題所屬範圍」卡片的最後一句。之後的版本若沿用相同文字，也可以引用這些凍結的表；文字不同就另外凍結一份。
- `src/domain/catalog.ts` 是畫面目前使用的內容（學習區、進階解讀、圖示名稱），可以依審校結果修改。

新增一版的步驟：

1. 修改 `catalog.ts` 的文字，把 `CONTENT_VERSION` 改成新值（例如 `zh-TW-basic-reviewed-v2`）；全部條目都經專家確認時，`reviewStatus` 才能是 `expert-reviewed`。
2. 新增 `readingV2.ts`：複製 `readingV1.ts` 的結構，凍結新版文字。
3. 在 `reading.ts` 的 `BUILDERS` 加入新版本，`ContentVersion` 加入新值。舊版本不能移除。
4. 新記錄自動使用新版本；舊記錄仍以自己的版本驗證，畫面顯示保存時的文字快照。
5. 測試：在 `tests/unit/contentVersions.test.ts` 加一筆新版記錄，確認新舊兩版記錄都能通過 `checkRecord`、互相不能冒充；更新 `fixtures/` 若要以新版當例題。
6. 在 `DECISIONS.md` 記錄改了哪些條目與審校者。

舊版 App 不認得新版本的記錄，匯入時會轉為只讀封存（I06），這是預期行為。
