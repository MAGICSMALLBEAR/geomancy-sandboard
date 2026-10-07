/**
 * Interface language (DECISIONS D43). Text is written in pairs next to each other — `L('中文', 'English')` —
 * so a change to one language is never far from the other. Domain modules take `lang` as a parameter.
 */
export type Lang = 'zh-TW' | 'en';
export const LANGS: readonly Lang[] = ['zh-TW', 'en'];
export const LANG_LABEL: Record<Lang, string> = { 'zh-TW': '繁體中文', en: 'English' };
export const isLang = (v: unknown): v is Lang => v === 'zh-TW' || v === 'en';

/** First visit: Chinese browsers get Chinese, everyone else English. Afterwards the saved choice wins. */
export function browserLang(nav: { language?: string } | undefined = typeof navigator === 'undefined' ? undefined : navigator): Lang {
  return nav?.language?.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

export type Pick = <T>(zh: T, en: T) => T;
export const pick = (lang: Lang): Pick => (zh, en) => (lang === 'en' ? en : zh);
