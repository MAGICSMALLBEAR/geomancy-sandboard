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
    note: '成就技法的研究入口；本版引擎尚未實作。',
    url: 'https://digitalambler.com/2014/06/05/more-about-geomantic-perfection/' },
  { id: 'E01', title: '地占沙盤原創編輯草稿',
    note: '本產品自行撰寫的中文象義摘要與反思提示。內容狀態為編輯草稿，尚未經外部地占專家逐條審校。',
    url: null },
];
export const sourceById = (id: string): SourceEntry | undefined => SOURCES.find(s => s.id === id);
