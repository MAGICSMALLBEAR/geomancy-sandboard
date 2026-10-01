import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { CastSource } from '../../domain/geomancy.ts';
import { drawQuickSource } from '../../domain/random.ts';
import { ERROR_TEXT } from '../../infrastructure/errors.ts';

/**
 * The only place that reaches the device RNG, and only from the button's click handler.
 * Once drawn, the source is handed to the page, which saves it before anything is revealed.
 */
export function QuickCasting({ onSource }: { onSource: (source: CastSource) => void }) {
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
        <p>{ERROR_TEXT.RNG_UNAVAILABLE}</p>
        <p>請放棄這筆草稿，回到新增占問改選其他起卦方式。</p>
        <Link to="/new">回到新增占問</Link>
      </div>
    );
  }
  return (
    <section className="card quick">
      <h2>快速起卦</h2>
      <p>由裝置亂數產生四母象：按一次按鈕，裝置會產生十六個隨機位元，每四個位元組成一個母象。
        這是數位亂數取樣，不是從實體沙或其他訊號取得。</p>
      <p className="muted">結果在按下的瞬間就固定並保存；之後的動畫只是顯示它，重新整理也不會換一盤。</p>
      <button type="button" className="primary big" disabled={started} onClick={cast}>
        {started ? '正在保存…' : '由裝置亂數起卦'}
      </button>
    </section>
  );
}
