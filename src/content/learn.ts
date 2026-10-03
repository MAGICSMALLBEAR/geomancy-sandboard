/** Learning-page copy. Original Traditional Chinese editorial drafts; NOT expert-reviewed. */
import type { NodeId } from '../domain/geomancy.ts';

/** Typical matters looked at in each house, as plain examples. Index 0 is house 1. */
export const HOUSE_EXAMPLES = [
  '我目前的狀態、立場與在這件事中的角色',
  '收入、存款、手上可以運用的資源',
  '兄弟姊妹、鄰居、短程往來、訊息與文件',
  '家庭、住處，以及一件事的根基',
  '戀愛、子女、創作與娛樂',
  '日常工作、作息、同事與照料的責任',
  '伴侶、合作對象、合約，以及公開的對手',
  '他人的資源、共同財務、失落與結束',
  '遠行、進修、信念與較長遠的計畫',
  '職業、地位、名聲與上司',
  '朋友、團體、支持與希望',
  '隱藏的困難、自我設限、幕後的事',
] as const;

/** What each family of positions is, in one short paragraph. */
export const ROLE_NOTES: { title: string; nodes: readonly NodeId[]; text: string }[] = [
  { title: '四母象', nodes: ['M1', 'M2', 'M3', 'M4'],
    text: '直接由起卦得出，是整張盤唯一的輸入；其餘十二個位置都由它們推出。依序放在第 1–4 宮。' },
  { title: '四女象', nodes: ['D1', 'D2', 'D3', 'D4'],
    text: '把四母象「橫著讀」：第一女象依序取四個母象的第一行，依此類推。不需要計算，只是換個方向讀。依序放在第 5–8 宮。' },
  { title: '四姪象', nodes: ['N1', 'N2', 'N3', 'N4'],
    text: '相鄰兩象逐行合成：第一、二母象合成第一姪象，第三、四母象合成第二姪象，女象同理。依序放在第 9–12 宮。' },
  { title: '右證人與左證人', nodes: ['RW', 'LW'],
    text: '右證人由母象這一側的兩個姪象合成，左證人由女象這一側的兩個姪象合成。本產品把兩者並列觀察，不固定解作過去與未來。證人不入宮。' },
  { title: '裁判', nodes: ['J'],
    text: '由兩證人合成，是整張盤的總結。裁判一定是偶數點，所以只會是十六象中的八個。裁判不入宮。' },
  { title: '調和者', nodes: ['R'],
    text: '由裁判與第一母象合成，用來在裁判不夠明確時多看一層。部分傳統不使用，所以結果頁預設隱藏。' },
];
