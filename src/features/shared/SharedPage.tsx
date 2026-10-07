/** A chart opened from a share link (DECISIONS D40). Read-only: rebuilt here from the link, never saved. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { constructChart } from '../../domain/geomancy.ts';
import { buildReading } from '../../domain/reading.ts';
import { CONTENT_VERSION } from '../../domain/catalog.ts';
import { CONTENT_EN1 } from '../../domain/readingEn1.ts';
import { useApp } from '../../app/AppContext.tsx';
import { NO_QUESTION_TEXT_EN, parseShareQuery } from '../../infrastructure/shareLink.ts';
import { ResultView } from '../../components/ResultView.tsx';

export function SharedPage() {
  const [params] = useSearchParams();
  const { reducedMotion, lang, L } = useApp();
  const [animate, setAnimate] = useState(true);
  const shared = useMemo(() => parseShareQuery(params), [params]);

  if (!shared) {
    return (
      <div className="card">
        <h1>{L('無法開啟這個分享連結', 'This share link cannot be opened')}</h1>
        <p>{L('連結可能不完整、被截斷，或來自較新版本的 App。請對方重新分享一次。', 'The link may be incomplete, cut off, or from a newer version of the App. Ask the sharer to share it again.')}</p>
        <p><Link className="button primary" to="/new">{L('自己起一盤', 'Cast your own chart')}</Link>　<Link to="/">{L('回首頁', 'Back to home')}</Link></p>
      </div>
    );
  }
  const { mothers, hasQuestion, rule } = shared;
  // The reading is rebuilt in the viewer's language; it only reads the topic and house, never the text.
  const question = hasQuestion || lang !== 'en' ? shared.question : { ...shared.question, text: NO_QUESTION_TEXT_EN };
  return (
    <>
      <ResultView
        question={question} dateLabel="" source={{ kind: 'manual', mothers }}
        methodLabel={L('分享的盤面', 'Shared chart')} manualNote={L('分享的盤面：這個母象來自分享連結，不知道對方當初怎麼起卦。', 'Shared chart: this Mother came from a share link; how the sharer cast it is unknown.')}
        chart={constructChart(mothers)} reading={buildReading(mothers, question, lang === 'en' ? CONTENT_EN1 : CONTENT_VERSION, rule)}
        animate={animate && !reducedMotion} onSkipAnimation={() => setAnimate(false)}
        banner={
          <div className="notice" role="note">
            <strong>{L('別人分享的盤面', 'A chart someone shared')}</strong>{L(`：連結只帶著四個母象、問題範圍與宮位配置${hasQuestion ? '，以及對方附上的問題' : ''}。盤面與解讀由這個 App 依目前版本重新計算，不會存進你的日誌。`,
              `: the link carries only the four Mothers, the question scope and the house rule${hasQuestion ? ', plus the question the sharer included' : ''}. This App rebuilds the chart and reading with its current version; nothing is saved to your journal.`)}
            {!hasQuestion && L(' 對方沒有附上問題，解讀只依問題範圍來看。', ' The sharer did not include a question, so the reading looks only at the question scope.')}
          </div>
        }
      />
      <nav className="result-actions" aria-label={L('接下來', 'Next')}>
        <Link className="button primary" to="/new">{L('自己起一盤', 'Cast your own chart')}</Link>
        <Link className="button" to="/learn/practice">{L('用推盤練習看懂這張盤', 'Understand this chart with the derivation practice')}</Link>
      </nav>
    </>
  );
}
