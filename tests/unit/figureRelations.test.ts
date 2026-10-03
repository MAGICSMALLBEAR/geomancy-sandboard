import { describe, expect, test } from 'vitest';
import { constructChart, fromDots, toDots, type Bit, type Mothers } from '../../src/domain/geomancy.ts';
import { FIGURES } from '../../src/domain/catalog.ts';
import { canBeJudge, convert, invert, reverse, totalPoints } from '../../src/domain/figureRelations.ts';

const name = (dots: string) => FIGURES.find(f => f.dots === dots)!.latin;

describe('learning pages: figure relations', () => {
  test('inversion, reversal and conversion map the sixteen figures onto themselves and undo themselves', () => {
    for (const f of FIGURES) {
      const figure = fromDots(f.dots);
      for (const op of [invert, reverse, convert]) {
        expect(FIGURES.some(other => other.dots === toDots(op(figure)))).toBe(true);
        expect(toDots(op(op(figure)))).toBe(f.dots);
      }
    }
  });

  test('known pairs', () => {
    expect(name(toDots(invert(fromDots('2211'))))).toBe('Fortuna Minor');
    expect(name(toDots(reverse(fromDots('1222'))))).toBe('Tristitia');
    expect(name(toDots(invert(fromDots('1111'))))).toBe('Populus');
    expect(toDots(reverse(fromDots('1111')))).toBe('1111');
    expect(name(toDots(reverse(fromDots('2111'))))).toBe('Cauda Draconis');
    expect(name(toDots(convert(fromDots('2111'))))).toBe('Tristitia');
  });

  test('points: Via has 4, Populus has 8, Puella has 5', () => {
    expect(totalPoints(fromDots('1111'))).toBe(4);
    expect(totalPoints(fromDots('2222'))).toBe(8);
    expect(totalPoints(fromDots('1211'))).toBe(5);
  });

  test('canBeJudge matches exactly the judges that appear across all 65,536 sets of mothers', () => {
    const judges = new Set<string>();
    for (let n = 0; n < 65536; n++) {
      const bits = Array.from({ length: 16 }, (_, i) => ((n >> (15 - i)) & 1) as Bit);
      const mothers = [0, 4, 8, 12].map(i => bits.slice(i, i + 4)) as unknown as Mothers;
      judges.add(toDots(constructChart(mothers).J));
    }
    const predicted = FIGURES.filter(f => canBeJudge(fromDots(f.dots))).map(f => f.dots);
    expect(predicted).toHaveLength(8);
    expect([...judges].sort()).toEqual([...predicted].sort());
  });
});
