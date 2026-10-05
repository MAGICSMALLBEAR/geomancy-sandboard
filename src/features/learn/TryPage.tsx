/**
 * Trial tray: practise the sand gesture and see one row become one or two dots. Nothing here is stored,
 * no draft is created and no random source is used; it shares only the tap rules and the canvas.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router';
import type { Bit, Figure } from '../../domain/geomancy.ts';
import { useApp } from '../../app/AppContext.tsx';
import { playTap } from '../../app/sound.ts';
import { buzzConfirm, buzzTap } from '../../app/haptics.ts';
import { ROW_MAX_DOTS } from '../../infrastructure/records.ts';
import { ROW_ELEMENT, dotWord, figureOf } from '../../content/labels.ts';
import { FigureGlyph } from '../../components/FigureGlyph.tsx';
import { beginTap, judgeRelease, trackTap, type TapCandidate } from '../casting/gesture.ts';
import { REDUCE_MS, SandCanvas, type SandCanvasHandle } from '../casting/SandCanvas.tsx';

export function TryPage() {
  const { settings, reducedMotion } = useApp();
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<number[]>([]);
  const [showCount, setShowCount] = useState(true);
  const [reveal, setReveal] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const [announce, setAnnounce] = useState('');
  const canvas = useRef<SandCanvasHandle>(null);
  const tray = useRef<HTMLDivElement>(null);
  const candidate = useRef<TapCandidate | null>(null);
  const counter = useRef(0);
  const locked = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const done = rows.length === 4;
  const figure = done ? rows.map(n => (n % 2) as Bit) as unknown as Figure : null;

  const addDot = (place: () => void) => {
    if (locked.current || done || counter.current >= ROW_MAX_DOTS) return;
    counter.current += 1;
    place();
    setCount(counter.current);
    setHint('');
    if (settings.sound) playTap();
    if (settings.haptics) buzzTap();
  };
  const relative = (event: ReactPointerEvent) => {
    const rect = tray.current!.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, inside };
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked.current || done) return;
    const next = beginTap(candidate.current, { pointerId: event.pointerId, isPrimary: event.isPrimary, button: event.button,
      x: event.clientX, y: event.clientY, time: event.timeStamp });
    if (next === candidate.current) return;
    candidate.current = next;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* best effort */ }
    const point = relative(event);
    canvas.current?.setPending({ x: point.x, y: point.y });
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    candidate.current = trackTap(candidate.current, event.pointerId, event.clientX, event.clientY);
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const point = relative(event);
    const verdict = judgeRelease(candidate.current, { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      time: event.timeStamp, inside: point.inside });
    if (verdict === 'ignored') return;
    candidate.current = null;
    canvas.current?.setPending(null);
    if (verdict === 'tap') addDot(() => canvas.current?.addMark(point.x, point.y));
    else setHint(verdict === 'moved' ? '這次手指移動太多，被當成拖動，沒有算進去。正式起卦也是這樣判定。'
      : verdict === 'too-long' ? '按太久了（超過 1.5 秒），沒有算進去。輕點一下就好。' : '在沙盤外放開，沒有算進去。');
  };
  const onPointerAbort = (event: ReactPointerEvent) => {
    if (candidate.current?.pointerId !== event.pointerId) return;
    candidate.current = null;
    canvas.current?.setPending(null);
  };

  const finishRow = () => {
    if (locked.current || counter.current < 1) return;
    locked.current = true;
    const fixed = counter.current;
    setReveal(fixed);
    if (settings.haptics) buzzConfirm();
    setAnnounce(`這一列 ${fixed} 點，${fixed % 2 === 1 ? '奇數' : '偶數'}，記為${dotWord(fixed % 2)}。`);
    canvas.current?.reduce(fixed % 2 === 1 ? 1 : 2);
    timer.current = window.setTimeout(() => {
      canvas.current?.clear();
      counter.current = 0;
      setCount(0);
      setReveal(null);
      setRows(current => [...current, fixed]);
      locked.current = false;
    }, reducedMotion ? 0 : REDUCE_MS + 900);
  };
  const clearRow = () => {
    if (locked.current) return;
    counter.current = 0;
    setCount(0);
    canvas.current?.clear();
  };
  const restart = () => {
    clearTimeout(timer.current);
    locked.current = false;
    counter.current = 0;
    canvas.current?.clear();
    setCount(0);
    setRows([]);
    setReveal(null);
    setHint('');
  };

  return (
    <div className="try">
      <p className="eyebrow"><Link to="/learn">教學</Link>・試畫區</p>
      <h1 className="page-title">試畫區：先練習點沙</h1>
      <p className="page-lede">在正式起卦前，先感受一下：隨意點幾下、按「完成這列」，看成對的點痕如何消去，剩下一點或兩點。
        點滿四列會組成一個象。<strong>這裡的點不會保存，也不會變成正式的盤。</strong></p>

      {!done && <>
        <p className="cast-progress"><strong>練習第 {rows.length + 1} 列</strong>
          <span className="muted">（{ROW_ELEMENT[rows.length]}行・共 4 列）</span></p>
        <label className="check">
          <input type="checkbox" checked={showCount} onChange={event => setShowCount(event.target.checked)} />
          顯示目前點數（正式起卦時不顯示，避免刻意計數）
        </label>
        {showCount && <p className="try-count" aria-live="off">目前 {count} 點{count > 0 && `（${count % 2 === 1 ? '奇數 → 一點' : '偶數 → 兩點'}）`}</p>}
        <div ref={tray} className={`sand-tray${reveal === null ? '' : ' is-locked'}`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={onPointerAbort} onLostPointerCapture={onPointerAbort} onContextMenu={event => event.preventDefault()}>
          <SandCanvas ref={canvas} reducedMotion={reducedMotion} />
          {reveal !== null && (
            <div className="tray-overlay"><p>{reveal} 點，{reveal % 2 === 1 ? '奇數' : '偶數'} → 兩兩配對消去後剩{dotWord(reveal % 2)}</p></div>
          )}
        </div>
        <p className="hint" role="status">{hint}</p>
        <div className="action-bar">
          <button type="button" disabled={reveal !== null} onKeyDown={event => { if (event.repeat) event.preventDefault(); }}
            onClick={() => addDot(() => canvas.current?.addMarkAuto())}>加入一點</button>
          <button type="button" disabled={reveal !== null || count === 0} onClick={clearRow}>清空本列</button>
          <button type="button" className="primary" disabled={reveal !== null || count === 0} onClick={finishRow}>完成這列</button>
        </div>
      </>}

      {rows.length > 0 && (
        <section className="card" aria-label="練習結果">
          <h2>{done ? '你點出了一個象' : '已完成的練習列'}</h2>
          <div className="try-figure">
            <ol className="try-rows">
              {rows.map((n, i) => (
                <li key={i}><span className="muted">{ROW_ELEMENT[i]}行</span><span>{n} 點</span>
                  <span className="dots" aria-hidden="true">{n % 2 === 1 ? '•' : '• •'}</span><span>{dotWord(n % 2)}</span></li>
              ))}
            </ol>
            {figure && <>
              <FigureGlyph figure={figure} size={56} />
              <p><strong>{figureOf(figure).zh}／{figureOf(figure).latin}</strong><br />
                <span className="muted">象徵主題：{figureOf(figure).keywords.join('、')}</span></p>
            </>}
          </div>
          {done && <>
            <p>正式起卦會點十六列、得到四個這樣的象（四個母象），再推出整張盾盤。</p>
            <div className="dialog-actions">
              <Link className="button primary" to="/new">開始正式占問</Link>
              <button type="button" onClick={restart}>再練習一次</button>
              <Link className="button" to={`/learn/${figureOf(figure!).id}`}>認識「{figureOf(figure!).zh}」</Link>
            </div>
          </>}
        </section>
      )}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
