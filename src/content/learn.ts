/** Learning-page copy. Original Traditional Chinese editorial drafts with English versions (DECISIONS D43); NOT expert-reviewed. */
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
export const HOUSE_EXAMPLES_EN = [
  'My present state, my stance and my part in the matter',
  'Income, savings and the resources I have to hand',
  'Siblings, neighbours, short trips, messages and documents',
  'Family, home, and the foundation of a matter',
  'Romance, children, creative work and pleasure',
  'Daily work, routine, colleagues and duties of care',
  'Partners, collaborators, contracts, and open opponents',
  "Other people's resources, shared money, loss and endings",
  'Long journeys, study, beliefs and longer-range plans',
  'Career, status, reputation and superiors',
  'Friends, groups, support and hopes',
  'Hidden difficulties, self-imposed limits, things behind the scenes',
] as const;

/** What each family of positions is, in one short paragraph. */
export const ROLE_NOTES: { title: string; titleEn: string; nodes: readonly NodeId[]; text: string; textEn: string }[] = [
  { title: '四母象', titleEn: 'The four Mothers', nodes: ['M1', 'M2', 'M3', 'M4'],
    text: '直接由起卦得出，是整張盤唯一的輸入；其餘十二個位置都由它們推出。依序放在第 1–4 宮。',
    textEn: 'They come straight from the cast and are the only input to the whole chart; the other twelve positions are all derived from them. Under the sequential rule they go into houses 1–4.' },
  { title: '四女象', titleEn: 'The four Daughters', nodes: ['D1', 'D2', 'D3', 'D4'],
    text: '把四母象「橫著讀」：第一女象依序取四個母象的第一行，依此類推。不需要計算，只是換個方向讀。依序放在第 5–8 宮。',
    textEn: 'The Mothers read sideways: the First Daughter takes the first line of each Mother in turn, and so on. Nothing is computed; it is just reading the other way. Under the sequential rule they go into houses 5–8.' },
  { title: '四姪象', titleEn: 'The four Nieces', nodes: ['N1', 'N2', 'N3', 'N4'],
    text: '相鄰兩象逐行合成：第一、二母象合成第一姪象，第三、四母象合成第二姪象，女象同理。依序放在第 9–12 宮。',
    textEn: 'Each pair of neighbours is combined line by line: the First and Second Mothers make the First Niece, the Third and Fourth Mothers the Second Niece, and likewise for the Daughters. Under the sequential rule they go into houses 9–12.' },
  { title: '右證人與左證人', titleEn: 'The Right and Left Witnesses', nodes: ['RW', 'LW'],
    text: '右證人由母象這一側的兩個姪象合成，左證人由女象這一側的兩個姪象合成。本產品把兩者並列觀察，不固定解作過去與未來。證人不入宮。',
    textEn: "The Right Witness combines the two Nieces on the Mothers' side, the Left Witness the two on the Daughters' side. This App looks at them side by side and does not fix them as past and future. Witnesses are not placed in houses." },
  { title: '裁判', titleEn: 'The Judge', nodes: ['J'],
    text: '由兩證人合成，是整張盤的總結。裁判一定是偶數點，所以只會是十六象中的八個。裁判不入宮。',
    textEn: 'Combined from the two Witnesses, it sums up the whole chart. The Judge always has an even number of dots, so only eight of the sixteen figures can appear there. The Judge is not placed in a house.' },
  { title: '調和者', titleEn: 'The Reconciler', nodes: ['R'],
    text: '由裁判與第一母象合成，用來在裁判不夠明確時多看一層。部分傳統不使用，所以結果頁預設隱藏。',
    textEn: 'Combined from the Judge and the First Mother, it gives one more layer when the Judge is unclear. Some traditions do not use it, so the result page hides it by default.' },
];

/**
 * Planetary rulers (source G09). Two figures per planet, the nodes for Caput/Cauda Draconis. Signs and elements,
 * where traditions disagree, are in correspondences.ts with every listed version (DECISIONS D33, D36).
 */
export const PLANET: Record<string, { zh: string; latin: string }> = {
  via: { zh: '月亮', latin: 'Moon' }, populus: { zh: '月亮', latin: 'Moon' },
  albus: { zh: '水星', latin: 'Mercury' }, conjunctio: { zh: '水星', latin: 'Mercury' },
  puella: { zh: '金星', latin: 'Venus' }, amissio: { zh: '金星', latin: 'Venus' },
  'fortuna-major': { zh: '太陽', latin: 'Sun' }, 'fortuna-minor': { zh: '太陽', latin: 'Sun' },
  puer: { zh: '火星', latin: 'Mars' }, rubeus: { zh: '火星', latin: 'Mars' },
  acquisitio: { zh: '木星', latin: 'Jupiter' }, laetitia: { zh: '木星', latin: 'Jupiter' },
  tristitia: { zh: '土星', latin: 'Saturn' }, carcer: { zh: '土星', latin: 'Saturn' },
  'caput-draconis': { zh: '月交點（北交點）', latin: 'North Node' }, 'cauda-draconis': { zh: '月交點（南交點）', latin: 'South Node' },
};
