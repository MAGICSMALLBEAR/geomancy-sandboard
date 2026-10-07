/**
 * "Save as image" for a result (DECISIONS D25): drawn locally on a canvas and downloaded; nothing is uploaded.
 * The question text is left out unless the user asks for it, because images are easily passed around.
 */
import { VISUAL_ROWS, toDots, type Chart, type NodeId, type RuleVersion } from '../../domain/geomancy.ts';
import { figureInfo } from '../../domain/catalog.ts';
import type { Question } from '../../domain/reading.ts';
import { advancedLabels, findPerfection } from '../../domain/advanced.ts';
import { labelsFor } from '../../content/labels.ts';
import type { Lang } from '../../app/lang.ts';

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

export type ShareContent = {
  title: string;
  meta: string;
  question: string | null;
  topic: string;
  /** Shield rows as drawn, first mother on the right; the reconciler is left out. */
  rows: { node: NodeId; dots: string; name: string }[][];
  judgeLabel: string;
  judge: { name: string; latin: string; keywords: string };
  perfection: string;
  footer: string;
};

/** Pure: what goes on the image. */
export function buildShareContent(
  input: { chart: Chart; question: Question; dateLabel: string; methodLabel: string; rule?: RuleVersion; lang?: Lang },
  includeQuestion: boolean,
): ShareContent {
  const { chart, question } = input;
  const en = input.lang === 'en', T = labelsFor(en ? 'en' : 'zh-TW'), LABEL = advancedLabels(T.lang).perfection;
  const judge = figureInfo(chart.J);
  const result = findPerfection(chart, question.targetHouse, input.rule);
  const scope = (house: number) => (en ? `Perfection (house 1 × house ${house}): ` : `成事關係（第 1 宮 × 第 ${house} 宮）：`);
  const perfection = result.status === 'no-quesited'
    ? (en ? 'General reflection: no question house chosen, so perfection is not judged' : '一般反思：沒有選定問題宮，不判斷成事關係')
    : result.hits.length
      ? scope(result.quesited) + LABEL[result.hits[0].mode] + (result.hits.length > 1 ? (en ? `, and ${result.hits.length - 1} more` : `　等 ${result.hits.length} 項`) : '')
      : scope(result.quesited) + (en ? 'Denial' : '不成事（Denial）');
  return {
    title: en ? 'Geomancy Sand Tray' : '地占沙盤',
    meta: [input.dateLabel, input.methodLabel].filter(Boolean).join(en ? ' · ' : '・'),
    question: includeQuestion ? question.text : null,
    topic: T.TOPIC_LABEL[question.topic] + (question.targetHouse
      ? (en ? ` · house ${question.targetHouse}: ${T.HOUSES[question.targetHouse - 1]}` : `・第 ${question.targetHouse} 宮：${T.HOUSES[question.targetHouse - 1]}`) : ''),
    rows: VISUAL_ROWS.filter(row => !row.includes('R')).map(row => row.map(node => {
      const info = figureInfo(chart[node]);
      return { node, dots: toDots(chart[node]), name: en ? info.latin : info.zh };
    })),
    judgeLabel: en ? 'Judge · overall theme' : '裁判・整體主題',
    // In English the Latin name is the name, so the second line carries the gloss.
    judge: en ? { name: judge.latin, latin: T.fullName(judge).slice(judge.latin.length + 1), keywords: T.list(T.keywords(judge)) }
      : { name: judge.zh, latin: judge.latin, keywords: judge.keywords.join('、') },
    perfection,
    footer: en ? 'A symbolic reading · draft content, not expert-reviewed. Not a prediction; important decisions still need real information.'
      : '象徵性解讀・內容草稿，未經專家審校。不是預測，重要決定仍需要實際資訊。',
  };
}

type Theme = { bg: string; card: string; text: string; muted: string; accent: string; line: string; dot: string; head: string; body: string; latin: string };

function readTheme(): Theme {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const accent = v('--accent', '#4F5A35'), text = v('--text', '#2F271C');
  return {
    bg: v('--bg', '#EEE6D5'), card: v('--card', '#F8F3E8'), text, muted: v('--muted', '#5C5039'), accent, line: v('--line', '#CDBB98'),
    dot: document.documentElement.dataset.theme === 'ritual' ? accent : text,
    head: v('--font-head', 'serif'), body: v('--font-body', 'sans-serif'), latin: v('--font-latin', 'serif'),
  };
}

/** Breaks text into lines that fit `width`, character by character (works for Chinese without spaces). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > width && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else line += ch;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join('').length;
  if (used < [...text].length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + '…';
  return lines;
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glyph(ctx: CanvasRenderingContext2D, dots: string, cx: number, top: number, gap: number, spread: number, radius: number) {
  [...dots].forEach((d, row) => {
    const y = top + row * gap;
    for (const x of d === '1' ? [cx] : [cx - spread, cx + spread]) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function drawShareImage(canvas: HTMLCanvasElement, content: ShareContent): void {
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  const t = readTheme();
  const M = 64;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ctx.textBaseline = 'alphabetic';

  let y = 104;
  ctx.fillStyle = t.text;
  ctx.font = `700 48px ${t.head}`;
  ctx.fillText(content.title, M, y);
  ctx.fillStyle = t.muted;
  ctx.font = `400 28px ${t.body}`;
  ctx.textAlign = 'right';
  ctx.fillText(content.meta, SHARE_WIDTH - M, y);
  ctx.textAlign = 'left';

  y += 58;
  ctx.fillStyle = t.accent;
  ctx.font = `700 30px ${t.body}`;
  ctx.fillText(content.topic, M, y);
  if (content.question) {
    ctx.fillStyle = t.text;
    ctx.font = `700 38px ${t.head}`;
    for (const line of wrap(ctx, content.question, SHARE_WIDTH - 2 * M, 3)) {
      y += 54;
      ctx.fillText(line, M, y);
    }
  }

  // Shield: 8 / 4 / 2 / 1, first mother on the right.
  y += 44;
  const rowH = 150, gap = 10;
  content.rows.forEach((row, r) => {
    const isJudge = r === content.rows.length - 1;
    const width = SHARE_WIDTH - 2 * M;
    const cellW = (width - gap * 7) / 8 * (r === 0 ? 1 : r === 1 ? 1.6 : r === 2 ? 2 : 2.4);
    const total = cellW * row.length + gap * (row.length - 1) * (r === 0 ? 1 : 4);
    let x = (SHARE_WIDTH - total) / 2;
    for (const cell of row) {
      box(ctx, x, y, cellW, rowH - 16, isJudge ? 18 : 12);
      ctx.fillStyle = isJudge ? t.accent : t.card;
      ctx.fill();
      ctx.strokeStyle = isJudge ? t.accent : t.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = isJudge ? t.bg : t.dot;
      glyph(ctx, cell.dots, x + cellW / 2, y + 22, 19, 13, 6);
      ctx.fillStyle = isJudge ? t.bg : t.muted;
      ctx.font = `500 22px ${t.body}`;
      ctx.textAlign = 'center';
      ctx.fillText(cell.name, x + cellW / 2, y + rowH - 24);
      ctx.textAlign = 'left';
      x += cellW + gap * (r === 0 ? 1 : 4);
    }
    y += rowH;
  });

  // Judge and perfection.
  y += 12;
  box(ctx, M, y, SHARE_WIDTH - 2 * M, 236, 18);
  ctx.fillStyle = t.card;
  ctx.fill();
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = t.muted;
  ctx.font = `400 26px ${t.body}`;
  ctx.fillText(content.judgeLabel, M + 32, y + 52);
  ctx.fillStyle = t.text;
  ctx.font = `700 52px ${t.head}`;
  ctx.fillText(content.judge.name, M + 32, y + 118);
  const nameW = ctx.measureText(content.judge.name).width;
  ctx.fillStyle = t.muted;
  ctx.font = `400 34px ${t.latin}`;
  ctx.fillText(content.judge.latin, M + 52 + nameW, y + 118);
  ctx.fillStyle = t.text;
  ctx.font = `400 30px ${t.body}`;
  ctx.fillText(content.judge.keywords, M + 32, y + 166);
  ctx.fillStyle = t.accent;
  ctx.font = `700 28px ${t.body}`;
  ctx.fillText(wrap(ctx, content.perfection, SHARE_WIDTH - 2 * M - 64, 1)[0] ?? '', M + 32, y + 212);

  ctx.fillStyle = t.muted;
  ctx.font = `400 24px ${t.body}`;
  wrap(ctx, content.footer, SHARE_WIDTH - 2 * M, 2).forEach((line, i) => ctx.fillText(line, M, SHARE_HEIGHT - 76 + i * 34));
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG_FAILED'))), 'image/png'));
}
