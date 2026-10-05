/**
 * Zodiac and element correspondences (DECISIONS D36). GENERATED from the tables in sources G11 and G12 as published;
 * values are kept exactly as listed there, including entries that look inconsistent. Do not edit by hand.
 */
export type Element = 'fire' | 'air' | 'water' | 'earth';
export const ELEMENT_LABEL: Record<Element, string> = { fire: '火', air: '風', water: '水', earth: '土' };

/** Zodiac sign per figure: Agrippa's planetary method and Gerard of Cremona's (G11). */
export const ZODIAC: Record<string, { agrippa: string; gerard: string }> = {
  'via': { agrippa: '巨蟹座', gerard: '獅子座' },
  'populus': { agrippa: '巨蟹座', gerard: '摩羯座' },
  'fortuna-major': { agrippa: '獅子座', gerard: '水瓶座' },
  'fortuna-minor': { agrippa: '獅子座', gerard: '金牛座' },
  'acquisitio': { agrippa: '射手座', gerard: '牡羊座' },
  'amissio': { agrippa: '金牛座', gerard: '天蠍座' },
  'conjunctio': { agrippa: '處女座', gerard: '處女座' },
  'carcer': { agrippa: '摩羯座', gerard: '雙魚座' },
  'laetitia': { agrippa: '雙魚座', gerard: '金牛座' },
  'tristitia': { agrippa: '水瓶座', gerard: '天蠍座' },
  'puer': { agrippa: '牡羊座', gerard: '雙子座' },
  'puella': { agrippa: '天秤座', gerard: '天秤座' },
  'albus': { agrippa: '雙子座', gerard: '巨蟹座' },
  'rubeus': { agrippa: '天蠍座', gerard: '雙子座' },
  'caput-draconis': { agrippa: '摩羯座', gerard: '處女座' },
  'cauda-draconis': { agrippa: '天蠍座', gerard: '射手座' },
};

/** Seven element systems compared in G12, oldest first. */
export const ELEMENT_SYSTEMS: readonly { id: string; label: string; year: string; work: string; values: Record<string, Element> }[] = [
  { id: 'cattan', label: 'Cattan', year: '1591', work: 'Christopher Cattan《The Geomancie》', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'earth', 'fortuna-minor': 'fire', 'acquisitio': 'air', 'amissio': 'fire', 'conjunctio': 'air', 'carcer': 'earth', 'laetitia': 'air', 'tristitia': 'earth', 'puer': 'air', 'puella': 'water', 'albus': 'water', 'rubeus': 'fire', 'caput-draconis': 'earth', 'cauda-draconis': 'fire' } },
  { id: 'agrippa-vulgar', label: 'Agrippa（通俗）', year: '1655', work: 'Agrippa《Of Geomancy》所列的通俗系統', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'earth', 'fortuna-minor': 'fire', 'acquisitio': 'air', 'amissio': 'fire', 'conjunctio': 'air', 'carcer': 'earth', 'laetitia': 'air', 'tristitia': 'earth', 'puer': 'air', 'puella': 'water', 'albus': 'water', 'rubeus': 'fire', 'caput-draconis': 'earth', 'cauda-draconis': 'fire' } },
  { id: 'agrippa-planet', label: 'Agrippa（行星推導）', year: '1655', work: 'Agrippa《Of Geomancy》依行星推導', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'fire', 'fortuna-minor': 'air', 'acquisitio': 'water', 'amissio': 'fire', 'conjunctio': 'air', 'carcer': 'earth', 'laetitia': 'air', 'tristitia': 'earth', 'puer': 'fire', 'puella': 'air', 'albus': 'earth', 'rubeus': 'fire', 'caput-draconis': 'earth', 'cauda-draconis': 'water' } },
  { id: 'agrippa-sign', label: 'Agrippa（星座推導）', year: '1655', work: 'Agrippa《Of Geomancy》依星座推導', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'fire', 'fortuna-minor': 'fire', 'acquisitio': 'water', 'amissio': 'earth', 'conjunctio': 'earth', 'carcer': 'earth', 'laetitia': 'fire', 'tristitia': 'air', 'puer': 'fire', 'puella': 'earth', 'albus': 'air', 'rubeus': 'water', 'caput-draconis': 'earth', 'cauda-draconis': 'water' } },
  { id: 'heydon', label: 'Heydon', year: '1663', work: 'John Heydon', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'fire', 'fortuna-minor': 'air', 'acquisitio': 'fire', 'amissio': 'earth', 'conjunctio': 'earth', 'carcer': 'earth', 'laetitia': 'water', 'tristitia': 'air', 'puer': 'fire', 'puella': 'air', 'albus': 'air', 'rubeus': 'water', 'caput-draconis': 'earth', 'cauda-draconis': 'fire' } },
  { id: 'fludd', label: 'Fludd', year: '1687', work: 'Robert Fludd', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'earth', 'fortuna-minor': 'fire', 'acquisitio': 'air', 'amissio': 'fire', 'conjunctio': 'air', 'carcer': 'earth', 'laetitia': 'air', 'tristitia': 'earth', 'puer': 'air', 'puella': 'water', 'albus': 'water', 'rubeus': 'fire', 'caput-draconis': 'earth', 'cauda-draconis': 'earth' } },
  { id: 'case', label: 'Case', year: '1697', work: 'John Case', values: { 'via': 'water', 'populus': 'water', 'fortuna-major': 'fire', 'fortuna-minor': 'air', 'acquisitio': 'fire', 'amissio': 'earth', 'conjunctio': 'earth', 'carcer': 'earth', 'laetitia': 'water', 'tristitia': 'air', 'puer': 'fire', 'puella': 'air', 'albus': 'air', 'rubeus': 'water', 'caput-draconis': 'earth', 'cauda-draconis': 'fire' } },
];

/**
 * Cattan (1591, the oldest listed and the text the plan names for checking) is the reference column. A head count
 * would mislead: three of the seven columns are Agrippa's own variants, and two figures tie 3–3.
 */
export const REFERENCE_SYSTEM = 'cattan';
export function elementAgreement(figureId: string): { element: Element; same: number } {
  const element = ELEMENT_SYSTEMS.find(s => s.id === REFERENCE_SYSTEM)!.values[figureId];
  return { element, same: ELEMENT_SYSTEMS.filter(s => s.values[figureId] === element).length };
}
