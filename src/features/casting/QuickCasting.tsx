import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { CastSource } from '../../domain/geomancy.ts';
import { drawQuickSource } from '../../domain/random.ts';
import { useApp } from '../../app/AppContext.tsx';

/**
 * The only place that reaches the device RNG, and only from the button's click handler.
 * Once drawn, the source is handed to the page, which saves it before anything is revealed.
 */
export function QuickCasting({ onSource }: { onSource: (source: CastSource) => void }) {
  const { L, T } = useApp();
  const locked = useRef(false);
  const [started, setStarted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const cast = () => {
    if (locked.current) return;
    locked.current = true;
    let source: CastSource;
    try {
      source = drawQuickSource();
    } catch {
      // No fallback generator: the user picks another method instead.
      setUnavailable(true);
      return;
    }
    setStarted(true);
    onSource(source);
  };

  if (unavailable) {
    return (
      <div className="notice is-error" role="alert">
        <p>{T.error('RNG_UNAVAILABLE')}</p>
        <p>{L('請放棄這筆草稿，回到新增占問改選其他起卦方式。', 'Please discard this draft and choose another casting method on the new-question page.')}</p>
        <Link to="/new">{L('回到新增占問', 'Back to new question')}</Link>
      </div>
    );
  }
  return (
    <section className="card quick">
      <h2>{L('快速起卦', 'Quick cast')}</h2>
      <p>{L('由裝置亂數產生四母象：按一次按鈕，裝置會產生十六個隨機位元，每四個位元組成一個母象。這是數位亂數取樣，不是從實體沙或其他訊號取得。',
        "The four Mothers come from your device's random number generator: press once and it produces sixteen random bits, four for each Mother. This is digital random sampling, not taken from real sand or any other signal.")}</p>
      <p className="muted">{L('結果在按下的瞬間就固定並保存；之後的動畫只是顯示它，重新整理也不會換一盤。', 'The result is fixed and saved the moment you press. The animation afterwards only shows it; reloading will not give a different chart.')}</p>
      <button type="button" className="primary big" disabled={started} onClick={cast}>
        {started ? L('正在保存…', 'Saving…') : L('由裝置亂數起卦', 'Cast with device random')}
      </button>
    </section>
  );
}
