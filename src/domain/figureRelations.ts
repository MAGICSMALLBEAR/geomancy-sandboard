/** Structural facts about a single figure for the learning pages. Pure arithmetic; no interpretation. */
import type { Bit, Figure } from './geomancy.ts';

/** Inversion: every row swaps one dot and two dots. */
export const invert = (figure: Figure): Figure => figure.map(bit => (1 - bit) as Bit) as unknown as Figure;
/** Reversal: the figure turned upside down (fire row becomes earth row). */
export const reverse = (figure: Figure): Figure => [...figure].reverse() as unknown as Figure;
/** Conversion: inverted and reversed. */
export const convert = (figure: Figure): Figure => invert(reverse(figure));

/** Points as drawn: a one-dot row counts 1, a two-dot row counts 2. */
export const totalPoints = (figure: Figure): number => figure.reduce<number>((sum, bit) => sum + (bit === 1 ? 1 : 2), 0);
/** Every judge has an even number of points, so only figures with an even total can sit in that position. */
export const canBeJudge = (figure: Figure): boolean => totalPoints(figure) % 2 === 0;
