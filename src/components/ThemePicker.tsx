import { useState } from 'react';
import { useApp } from '../app/AppContext.tsx';
import { THEMES, type ThemeSetting } from '../infrastructure/repository.ts';

export const THEME_LABEL: Record<ThemeSetting, { name: string; help: string }> = {
  sand: { name: '安靜沙盤', help: '自然沙色、立體沙面與凹痕，柔和安靜。' },
  manuscript: { name: '古典手稿', help: '羊皮紙、墨點、楷體與朱紅標記，像古代地占書。' },
  ritual: { name: '現代儀式', help: '深色星空、金色線條與發光的點，偏神秘感。' },
};
const PREVIEW_DOTS = [[18, 20], [52, 14], [34, 38], [64, 40]];

/** Three cards, each previewed in its own theme. Display only (DECISIONS D23). */
export function ThemePicker({ name = 'theme' }: { name?: string }) {
  const { settings, updateSetting } = useApp();
  const [failed, setFailed] = useState(false);
  const choose = (theme: ThemeSetting) => {
    setFailed(false);
    updateSetting('theme', theme).catch(() => setFailed(true));
  };
  return (
    <>
      <fieldset className="theme-picker">
        <legend className="sr-only">外觀主題</legend>
        {THEMES.map(option => (
          <label key={option} className="theme-option">
            <input type="radio" name={name} checked={settings.theme === option} onChange={() => choose(option)} />
            <span className="theme-preview" data-theme={option} aria-hidden="true">
              <span className="mini-tray">{PREVIEW_DOTS.map(([x, y], i) => <i key={i} style={{ left: x, top: y }} />)}</span>
              <span className="mini-btn">起卦</span>
            </span>
            <span className="theme-text"><strong>{THEME_LABEL[option].name}</strong><span>{THEME_LABEL[option].help}</span></span>
          </label>
        ))}
      </fieldset>
      {failed && <p className="notice is-error" role="alert">主題已套用在這次瀏覽，但沒有保存成功，下次開啟可能會恢復原本的主題。</p>}
    </>
  );
}
