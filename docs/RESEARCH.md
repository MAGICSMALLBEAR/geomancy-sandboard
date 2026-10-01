# 重新研究的結論與來源

查閱日期：2026-09-30。本輪重點是把上一份概念提案變成可直接執行的 MVP；不重複擴張市場清單。本輪重新開啟盾盤、入宮、圖式差異、三個產品文件，以及瀏覽器與開發工具官方文件。

研究層級要分清楚：歷史／實務資料支持某種規則確實被使用；競品頁支持產品公開宣稱的功能；本案測試支持自己寫的算術正確；它們都不自動證明解讀能準確預測現實。

## 1. 相較前版，本輪確定下來的事

| 題目 | 本輪結論 | 原因 |
|---|---|---|
| 第一版交付 | 先交可開工規格＋可執行核心，下一對話完成 App | 符合先試用、再迭代，也降低代理猜測規則的風險 |
| 起卦代表體驗 | 16 列點沙；快速／手動也是 P0 | 原始構想的操作感要能被測到，其他入口提供比較與輔助 |
| 四次長按 | 暫列後續比較方案 | 競品有此做法，不表示一定適合本產品 |
| 有效點擊 | 合法 pointerup 才提交，pointercancel 不計 | 比只在 down 計數更能定義取消、拖動與誤觸；這是產品選擇 |
| 解讀 | 本地、確定性、帶證據的基礎象徵層 | 先驗證理解；完整成就技法與內容審校尚待後續 |
| 存檔 | 草稿逐列保存，同 ID 原子完成 | 避免刷新換卦、雙擊多盤、錯誤卻顯示已保存 |
| 離線 | production build＋HTTPS 真機測試 | LAN 上的普通 HTTP 不等於 localhost 安全來源 |
| 開發工具 | 共用 AGENTS.md，CLAUDE.md 薄引用 | 兩種代理讀同一組規格，換對話靠 STATUS 接手 |

前一份建議偏向「內容審校後再呈現解讀」；本版明確區分：私人操作試用可以顯示草稿並如實標示，專業完整斷事需要另行審校。這個範圍修訂避免把 UI 驗證一直卡在完整學術／內容工程之前。

## 2. 競品再核對：值得借鏡什麼

| 產品與一手頁面 | 公開資料可確認 | 本案採取的做法 |
|---|---|---|
| [Simple Geomancy／Google Play](https://play.google.com/store/apps/details?hl=en&id=io.kodular.msonrm.SimpleGeomancy) | 點擊生成、盾盤、兩種宮位配置、圖片保存分享；頁面明說不提供象與盤的解讀 | 排盤工具已存在；本案更需測「新手能否看懂依據」，不只多一張盤 |
| [geomancy.live 起卦說明](https://geomancy.live/en/learn/casting) | 公開描述四次長按生成四母、盾盤／十二宮及 AI 深入解讀入口 | 長按作後續操作比較；先固定資料來源與基礎解讀，避免動畫來源含糊 |
| [Geofancy 作者專案](https://github.com/ThomasShetler/GeomancyApp) | 作者列盾盤、十二宮、成就、點之道與原創解讀資料；標示 PolyForm Noncommercial | 進階功能可作路線參考；本案自己寫核心與文案，不搬用其程式／語料 |

這一輪沒有購買服務、登入付費層、逐一真機操作或審查它們的內部亂數。上表不能用來推論操作順暢、付費值得或演算法正確，也不以商店安裝量推算市場需求。前一份較廣的競品清單仍可當背景，但開發優先級以自己的試用資料決定。

## 3. 地占規則的取捨

同一十六象系統有不同術語、圖式名稱與入宮方法。第一版鎖定常見盾盤構造與前十二位順序入宮，並保留規則版本。選定規則包不等於宣稱所有傳統都只有這一種。[G01](https://digitalambler.com/2020/05/08/how-to-construct-the-shield-chart-of-geomancy/)、[G02](https://digitalambler.com/2020/05/04/on-making-the-house-chart-from-the-shield-chart/)、[G05](https://www.princeton.edu/~ezb/geomancy/figures.html)

逐行奇偶、四女轉置與後續合成可以完全確定地實作。本包另以顯示點數的加法作獨立測試算法，枚舉所有四母組合。這降低運算錯誤，但不代替對歷史內容或應用判讀的審核。

成就、相位、點之道、轉宮等有更高的解讀複雜度；例如 occupation、conjunction、mutation、translation 不能只靠看到某個單象就判成功。2026-10-01 起依產品負責人決定，以 G06 的四種成事定義與 G07 的點之道規則實作「進階解讀（草稿）」，見 DECISIONS D24；仍需專家案例與審校。[G06](https://digitalambler.com/2014/06/05/more-about-geomantic-perfection/)

## 4. 來源索引：供程式 claim.sourceIds 對照

以下 G／E ID 是內容系統使用的穩定來源 ID。開發者應將這份索引整理為 App 內可顯示的本地來源清單，不能把 claim 上的 ID 留成無法點開的假連結。

| ID | 來源 | 本案用途與限制 |
|---|---|---|
| G01 | [The Digital Ambler：How to Construct the Shield Chart](https://digitalambler.com/2020/05/08/how-to-construct-the-shield-chart-of-geomancy/) | 作者的盾盤構造實務說明；用於算法與位置關係 |
| G02 | [The Digital Ambler：House Chart from Shield Chart](https://digitalambler.com/2020/05/04/on-making-the-house-chart-from-the-shield-chart/) | 入宮方法與歷史討論；本案選順序入宮 |
| G03 | [Geomancy 歷史刊文 PDF](https://www.100thmonkeypress.com/biblio/acrowley/periodicals/geomancy/geomancy.pdf) | 1918 刊文影本的十六象圖式；前輪已看圖核對，不整篇搬入 App |
| G04 | [Elizabeth Bennett／Princeton：Medieval Geomancy 步驟](https://www.princeton.edu/~ezb/geomancy/geostep.html) | 地占步驟與解讀背景；不是本案中文模板原文 |
| G05 | [Elizabeth Bennett／Princeton：The Geomantic Figures](https://www.princeton.edu/~ezb/geomancy/figures.html) | 圖式與名稱歷史變體提醒 |
| G06 | [The Digital Ambler：More About Geomantic Perfection](https://digitalambler.com/2014/06/05/more-about-geomantic-perfection/) | 四種成事關係與不成事的定義；進階解讀依此計算（D24） |
| G07 | [The Digital Ambler：Via Puncti](https://digitalambler.com/2012/12/18/de-geomanteia-via-puncti-follow-the-yellow-brick-road/) | 點之道：從裁判火行往上追溯到母象或女象；一點時唯一路徑，兩點時可能分岔或中斷（D24） |
| E01 | 本包 `src/domain/catalog.ts`、`reading.ts` | 本案原創中文編輯草稿與反思提示；reviewStatus 為 editorial-draft，未經外部專家逐條審校 |

來源連結是引用與查核用途，不能推論對方授權本產品使用整套語料。產品內摘要與反思文字為新寫，不複製競品付費內容；現代網站與程式碼是否可商用，仍以其實際授權為準。

## 5. 工程與工具一手文件

| 主題 | 來源 | 實作所需結論 |
|---|---|---|
| Codex 指示 | [AGENTS.md 官方文件](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | 在專案放精簡指示，細節連到規格 |
| Claude Code 指示 | [Memory 官方文件](https://code.claude.com/docs/en/memory) | CLAUDE.md 可用 `@AGENTS.md` 共享內容；不假設所有舊版都自動讀 AGENTS |
| Node TypeScript | [官方說明](https://nodejs.org/api/typescript.html) | 原生去型別執行不含靜態型別檢查；App 必須另跑 tsc |
| Vite | [官方指南](https://vite.dev/guide/) | 前端建置，依實際安裝版核對 Node 條件 |
| 觸控取消 | [MDN pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event) | 被取消的 gesture 不能當成有效放開 |
| 數位亂數 | [MDN getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues) | 使用 Web Crypto；自己固定輸入順序與保存時機 |
| 離線安全來源 | [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) | HTTPS／localhost 條件，手機 LAN HTTP 需另處理 |
| 離線快取 | [web.dev Serving](https://web.dev/learn/pwa/serving) | 首次成功快取後才可離線，不只加 manifest |
| 儲存限制 | [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | 配額與清除須可恢復，提供備份 |
| PWA 工具 | [Vite PWA Guide](https://vite-pwa-org.netlify.app/guide/) | 產生 worker／manifest；本案用提示更新以保護進行中草稿 |
| 資料庫 wrapper | [idb 作者文件](https://github.com/jakearchibald/idb) | Promise 介面與 transaction.done；避免交易中等待外部工作 |

技術選擇是針對本案的工程判斷。開工時仍以實際套件版本、官方 API 與測試結果修正實作細節，保持規則、資料與使用者流程契約不變。

## 6. 尚未由研究解決的問題

點沙 16 列是否太久、四次長按是否更有操作感、解讀是否足夠具體、日誌是否值得回來看，都需要自己的使用者試驗。中文象義與完整斷事準則需要懂地占的人審校；資料查找與測試能縮小不確定性，不能假裝已替代這些驗證。
