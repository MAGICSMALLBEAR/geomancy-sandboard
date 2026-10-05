import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { HOUSES } from '../../domain/catalog.ts';
import { ORIGINAL_TEXT_MAX, type Question } from '../../domain/reading.ts';
import type { Draft } from '../../domain/contracts.ts';
import { useApp } from '../../app/AppContext.tsx';
import { ERROR_TEXT, toAppError, type AppErrorCode } from '../../infrastructure/errors.ts';
import { startPilotSession } from '../../infrastructure/feedback.ts';
import type { CastMethod } from '../../infrastructure/records.ts';
import { METHOD_LABEL, TOPIC_EXAMPLE, TOPIC_HOUSES, TOPIC_LABEL } from '../../content/labels.ts';

const TEXT_MAX = 500, TIMEFRAME_MAX = 80;
const TIMEFRAMES = ['未來一個月', '未來三個月'];
const METHOD_HELP: Record<CastMethod, string> = {
  dots: '在沙面上點十六列，每列的奇偶決定一點或兩點。最有操作感，約需幾分鐘。',
  press: '按住沙盤四次，每次放開時由裝置亂數決定一個母象。比點沙快，仍保留一點儀式感。',
  auto: '不想自己點？按一次，由裝置亂數決定每列落下幾粒沙，再看著沙子自動落下、化約成四個母象。',
  quick: '按一次，由裝置亂數直接產生四個母象。',
  manual: '你已經用紙筆或實體沙盤起好卦，直接輸入四個母象。',
};

/** Small decorative icons for the method cards. */
function MethodIcon({ method }: { method: CastMethod }) {
  return (
    <svg className="method-icon" viewBox="0 0 34 34" aria-hidden="true">
      {method === 'dots' && <><rect x="3" y="6" width="28" height="22" rx="5" />{[[10, 13], [19, 11], [14, 21], [24, 20]].map(([x, y]) => <circle key={x} className="fill" cx={x} cy={y} r="2.2" />)}</>}
      {method === 'press' && <><circle cx="17" cy="17" r="13" /><circle cx="17" cy="17" r="7" /><circle className="fill" cx="17" cy="17" r="2.5" /></>}
      {method === 'auto' && <><rect x="3" y="6" width="28" height="22" rx="5" /><path d="M10 3v5M17 2v6M24 3v5" />{[[10, 16], [17, 20], [24, 15]].map(([x, y]) => <circle key={x} className="fill" cx={x} cy={y} r="2.2" />)}</>}
      {method === 'quick' && <path d="M19 3 8 19h8l-2 12 12-17h-8z" />}
      {method === 'manual' && <><path d="M7 27 25 9l3 3-18 18H7z" /><path d="M21 13l3 3" /></>}
    </svg>
  );
}

/** Counts full-width and ASCII question marks; a rough hint that several questions were written together. */
const questionMarks = (value: string): number => (value.match(/[？?]/g) ?? []).length;

export function NewQuestionPage() {
  const { repo, logEvent } = useApp();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Draft | null | undefined>(undefined);
  const [original, setOriginal] = useState('');
  const [text, setText] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [topic, setTopic] = useState<Question['topic']>('general');
  const [house, setHouse] = useState<Question['targetHouse']>(null);
  const [method, setMethod] = useState<CastMethod>('dots');
  const [problems, setProblems] = useState<{ text?: string; house?: string }>({});
  const [error, setError] = useState<AppErrorCode | null>(null);
  const submitting = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    repo.getActiveDraft().then(d => { if (alive) setExisting(d); }, reason => {
      if (alive) { setExisting(null); setError(toAppError(reason).code); }
    });
    return () => { alive = false; };
  }, [repo]);

  const changeTopic = (next: Question['topic']) => {
    setTopic(next);
    // A house chosen for another topic is never carried over silently.
    setHouse(null);
    setProblems(current => ({ ...current, house: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const found: typeof problems = {};
    if (text.trim().length < 1) found.text = '請先寫下一個問題。';
    if (topic !== 'general' && house === null) found.house = '請選擇這個問題要看的宮位。';
    setProblems(found);
    if (found.text) { textRef.current?.focus(); return; }
    if (found.house) return;

    submitting.current = true;
    setError(null);
    try {
      const draft = await repo.createDraft({ text: text.trim(), timeframe: timeframe.trim(), topic, targetHouse: topic === 'general' ? null : house,
        originalText: original.trim() }, method);
      startPilotSession();
      logEvent('session_started');
      logEvent('method_chosen', { method });
      navigate(`/cast/${draft.id}`);
    } catch (reason) {
      const code = toAppError(reason).code;
      if (code === 'DRAFT_EXISTS') setExisting(await repo.getActiveDraft().catch(() => null));
      else setError(code);
    } finally {
      submitting.current = false;
    }
  };

  const discardExisting = async () => {
    if (!existing) return;
    try {
      await repo.discardDraft(existing.id);
      setExisting(null);
    } catch (reason) {
      setError(toAppError(reason).code);
    }
  };

  if (existing === undefined) return <p role="status">載入中…</p>;
  if (existing) {
    return (
      <section className="card">
        <h1>你有一筆尚未完成的占問</h1>
        <p className="question-text">{existing.question.text}</p>
        <p className="muted">{METHOD_LABEL[existing.method]}
          {existing.method === 'dots' && `・已確認 ${existing.confirmedCounts.length}／16 列`}
          {existing.method === 'press' && `・已完成 ${existing.confirmedPresses?.length ?? 0}／4 次`}</p>
        <p>一次只保留一筆進行中的占問。要繼續它，還是放棄它並開始新的？</p>
        <div className="dialog-actions">
          <Link className="button primary" to={`/cast/${existing.id}`}>繼續這筆占問</Link>
          <button type="button" className="danger" onClick={() => void discardExisting()}>放棄並新增</button>
        </div>
        {error && <p className="notice is-error" role="alert">{ERROR_TEXT[error]}</p>}
      </section>
    );
  }

  return (
    <form className="new-question" onSubmit={event => void submit(event)} noValidate>
      <h1 className="page-title">新增占問</h1>
      <p className="page-lede">靜下心，把想問的事寫清楚。問題越具體，解讀越容易對照。</p>

      <details className="card field original-box">
        <summary>先把心裡的話寫下來（選填）</summary>
        <p id="original-help" className="hint">想到什麼就寫什麼，不必整理。寫完再從裡面挑出一件事，整理成下方的問題。兩個版本都會保存，日後回顧時可以對照。</p>
        <textarea id="original" aria-label="心裡的話（選填）" aria-describedby="original-help" rows={4} maxLength={ORIGINAL_TEXT_MAX}
          value={original} onChange={event => setOriginal(event.target.value)} />
        <p className="muted">還可以輸入 {ORIGINAL_TEXT_MAX - original.length} 字</p>
        {questionMarks(original) >= 2 && (
          <p className="notice" role="status">看起來不只一個問題。地占一次只問一件事，其他的可以之後另開一筆占問。</p>
        )}
        {original.trim() && !text.trim() && (
          <button type="button" onClick={() => { setText(original.trim().slice(0, TEXT_MAX)); textRef.current?.focus(); }}>帶入下方再修改</button>
        )}
        <ul className="focus-tips">
          <li>只問一件事</li>
          <li>問自己能觀察或能行動的部分</li>
          <li>加上時間範圍，例如「未來三個月」</li>
        </ul>
      </details>

      <div className="field">
        <label htmlFor="question">你想問什麼？</label>
        <p id="question-help" className="hint">請聚焦一件事。解讀提供象徵與反思，重要決定仍需實際資訊。例如：「{TOPIC_EXAMPLE[topic]}」</p>
        <textarea id="question" ref={textRef} rows={4} maxLength={TEXT_MAX} value={text} required
          aria-describedby={`question-help question-count${problems.text ? ' question-error' : ''}`} aria-invalid={Boolean(problems.text)}
          onChange={event => { setText(event.target.value); if (problems.text) setProblems({ ...problems, text: undefined }); }} />
        <p id="question-count" className="muted">還可以輸入 {TEXT_MAX - text.length} 字</p>
        {problems.text && <p id="question-error" className="field-error" role="alert">{problems.text}</p>}
      </div>

      <div className="field">
        <label htmlFor="timeframe">時間範圍（選填）</label>
        <input id="timeframe" type="text" maxLength={TIMEFRAME_MAX} value={timeframe} onChange={event => setTimeframe(event.target.value)} />
        <div className="chips">
          {TIMEFRAMES.map(option => <button key={option} type="button" onClick={() => setTimeframe(option)}>{option}</button>)}
          <button type="button" onClick={() => setTimeframe('')}>清空</button>
        </div>
      </div>

      <fieldset className="field">
        <legend>主題</legend>
        <div className="choice-row">
          {(Object.keys(TOPIC_LABEL) as Question['topic'][]).map(option => (
            <label key={option} className="choice">
              <input type="radio" name="topic" checked={topic === option} onChange={() => changeTopic(option)} />
              <span>{TOPIC_LABEL[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {topic !== 'general' && (
        <fieldset className="field" aria-describedby={problems.house ? 'house-error' : undefined}>
          <legend>這個問題要看哪一宮？</legend>
          <p className="hint">App 不會替你判斷，請自己選最接近的一項。</p>
          <div className="choice-col">
            {TOPIC_HOUSES[topic].map(option => (
              <label key={option.house} className="choice">
                <input type="radio" name="house" checked={house === option.house}
                  onChange={() => { setHouse(option.house); setProblems({ ...problems, house: undefined }); }} />
                <span><strong>{option.label}</strong>（第 {option.house} 宮：{HOUSES[option.house - 1]}）</span>
              </label>
            ))}
          </div>
          {problems.house && <p id="house-error" className="field-error" role="alert">{problems.house}</p>}
        </fieldset>
      )}

      <fieldset className="field">
        <legend>起卦方式</legend>
        <div className="method-grid">
          {(['dots', 'press', 'auto', 'quick', 'manual'] as CastMethod[]).map(option => (
            <label key={option} className="choice">
              <input type="radio" name="method" checked={method === option} onChange={() => setMethod(option)} />
              <MethodIcon method={option} />
              <span><strong>{METHOD_LABEL[option]}</strong><br />{METHOD_HELP[option]}</span>
            </label>
          ))}
        </div>
        {method === 'dots' && <p className="hint">第一次點沙？可以先到<Link to="/learn/try">試畫區</Link>練習，不會保存。</p>}
      </fieldset>

      {error && <p className="notice is-error" role="alert">{ERROR_TEXT[error]}</p>}
      <p className="hint">按下開始後，問題就會鎖定；要改問題請重新新增一筆占問。</p>
      <button type="submit" className="primary big">開始起卦</button>
    </form>
  );
}
