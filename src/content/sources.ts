/** Local index for claim.sourceIds (docs/RESEARCH.md §4). External pages need a network connection. */
export type SourceEntry = { id: string; title: string; note: string; url: string | null };

export const SOURCES: readonly SourceEntry[] = [
  { id: 'G01', title: 'The Digital Ambler：How to Construct the Shield Chart',
    note: '盾盤構造的實務說明；用於算法與位置關係。',
    url: 'https://digitalambler.com/2020/05/08/how-to-construct-the-shield-chart-of-geomancy/' },
  { id: 'G02', title: 'The Digital Ambler：House Chart from Shield Chart',
    note: '入宮方法與歷史討論；本產品選擇順序入宮。',
    url: 'https://digitalambler.com/2020/05/04/on-making-the-house-chart-from-the-shield-chart/' },
  { id: 'G03', title: 'Geomancy 歷史刊文（1918 刊文影本）',
    note: '十六象圖式的參照。',
    url: 'https://www.100thmonkeypress.com/biblio/acrowley/periodicals/geomancy/geomancy.pdf' },
  { id: 'G04', title: 'Elizabeth Bennett／Princeton：Medieval Geomancy 步驟',
    note: '地占步驟與解讀背景；不是本產品中文文案的原文。',
    url: 'https://www.princeton.edu/~ezb/geomancy/geostep.html' },
  { id: 'G05', title: 'Elizabeth Bennett／Princeton：The Geomantic Figures',
    note: '圖式與名稱的歷史變體。',
    url: 'https://www.princeton.edu/~ezb/geomancy/figures.html' },
  { id: 'G06', title: 'The Digital Ambler：More About Geomantic Perfection',
    note: '四種成事關係（同象、接合、轉移、傳遞）與不成事的定義；進階解讀依此計算。',
    url: 'https://digitalambler.com/2014/06/05/more-about-geomantic-perfection/' },
  { id: 'G07', title: 'The Digital Ambler：Via Puncti（點之道）',
    note: '點之道的追溯規則：從裁判的火行往上，經證人、姪象到母象或女象；兩點時可能分岔或中斷。',
    url: 'https://digitalambler.com/2012/12/18/de-geomanteia-via-puncti-follow-the-yellow-brick-road/' },
  { id: 'G08', title: 'John Michael Greer：The Art and Practice of Geomancy（2009）',
    note: '書目。宮位相位（六分、四分、三分、對分）與象在多宮重現的常見西方實務；本案依一般占星宮距整理規則，未能直接核對原書頁碼。',
    url: null },
  { id: 'E01', title: '地占沙盤原創編輯草稿',
    note: '本產品自行撰寫的中文象義摘要與反思提示。內容狀態為編輯草稿，尚未經外部地占專家逐條審校。',
    url: null },
];
export const sourceById = (id: string): SourceEntry | undefined => SOURCES.find(s => s.id === id);
