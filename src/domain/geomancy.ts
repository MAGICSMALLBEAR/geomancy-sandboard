/** Pure arithmetic. Bit 1 = one dot; bit 0 = two dots; rows = fire, air, water, earth. */
export type Bit = 0 | 1;
export type Figure = readonly [Bit, Bit, Bit, Bit];
export type Mothers = readonly [Figure, Figure, Figure, Figure];
export const RULE_VERSION = 'western-sequential-v1' as const;
export const NODES = ['M1', 'M2', 'M3', 'M4', 'D1', 'D2', 'D3', 'D4',
  'N1', 'N2', 'N3', 'N4', 'RW', 'LW', 'J', 'R'] as const;
export type NodeId = typeof NODES[number];
export type Chart = Readonly<Record<NodeId, Figure>>;
export const HOUSE_NODES = NODES.slice(0, 12) as readonly NodeId[];
export const VISUAL_ROWS: readonly (readonly NodeId[])[] = [
  ['D4', 'D3', 'D2', 'D1', 'M4', 'M3', 'M2', 'M1'],
  ['N4', 'N3', 'N2', 'N1'], ['LW', 'RW'], ['J'], ['R'],
];
export const PARENTS: Readonly<Partial<Record<NodeId, readonly NodeId[]>>> = {
  D1: ['M1', 'M2', 'M3', 'M4'], D2: ['M1', 'M2', 'M3', 'M4'],
  D3: ['M1', 'M2', 'M3', 'M4'], D4: ['M1', 'M2', 'M3', 'M4'],
  N1: ['M1', 'M2'], N2: ['M3', 'M4'], N3: ['D1', 'D2'], N4: ['D3', 'D4'],
  RW: ['N1', 'N2'], LW: ['N3', 'N4'], J: ['RW', 'LW'], R: ['J', 'M1'],
};

export function assertFigure(value: unknown): asserts value is Figure {
  if (!Array.isArray(value) || value.length !== 4 ||
      !Array.from(value).every(x => x === 0 || x === 1)) throw new Error('INVALID_FIGURE');
}
export function assertMothers(value: unknown): asserts value is Mothers {
  if (!Array.isArray(value) || value.length !== 4) throw new Error('INVALID_MOTHERS');
  Array.from(value).forEach(assertFigure);
}
export function fromDots(dots: string): Figure {
  if (!/^[12]{4}$/.test(dots)) throw new Error('INVALID_DOTS');
  return dots.split('').map(x => x === '1' ? 1 : 0) as unknown as Figure;
}
export function toDots(figure: Figure): string {
  assertFigure(figure);
  return figure.map(x => x === 1 ? '1' : '2').join('');
}
export function xor(a: Figure, b: Figure): Figure {
  assertFigure(a); assertFigure(b);
  return a.map((x, i) => (x ^ b[i]) as Bit) as unknown as Figure;
}
export function transpose(mothers: Mothers): Mothers {
  assertMothers(mothers);
  return [0, 1, 2, 3].map(row => mothers.map(m => m[row])) as unknown as Mothers;
}
export function mothersFromCounts(counts: readonly number[]): Mothers {
  if (!Array.isArray(counts) || counts.length !== 16 ||
      !Array.from(counts).every(x => Number.isSafeInteger(x) && x > 0 && x <= 4096)) {
    throw new Error('INVALID_COUNTS');
  }
  return [0, 4, 8, 12].map(start => counts.slice(start, start + 4)
    .map(n => n % 2 as Bit)) as unknown as Mothers;
}
export function constructChart(mothers: Mothers): Chart {
  assertMothers(mothers);
  const [M1, M2, M3, M4] = mothers.map(m => [...m] as unknown as Figure);
  const [D1, D2, D3, D4] = transpose(mothers);
  const N1 = xor(M1, M2), N2 = xor(M3, M4), N3 = xor(D1, D2), N4 = xor(D3, D4);
  const RW = xor(N1, N2), LW = xor(N3, N4), J = xor(RW, LW), R = xor(J, M1);
  return { M1, M2, M3, M4, D1, D2, D3, D4, N1, N2, N3, N4, RW, LW, J, R };
}
export function houseNode(house: number): NodeId {
  if (!Number.isInteger(house) || house < 1 || house > 12) throw new Error('INVALID_HOUSE');
  return HOUSE_NODES[house - 1];
}

export type CastSource =
  | { kind: 'dots'; counts: readonly number[] }
  | { kind: 'quick'; algorithm: 'webcrypto-16bits-v1'; bytes: readonly [number, number] }
  | { kind: 'manual'; mothers: Mothers };

export function sourceToMothers(source: CastSource): Mothers {
  if (!source || typeof source !== 'object') throw new Error('INVALID_SOURCE');
  if (source.kind === 'dots') return mothersFromCounts(source.counts);
  if (source.kind === 'manual') {
    assertMothers(source.mothers);
    return source.mothers.map(m => [...m]) as unknown as Mothers;
  }
  if (source.kind === 'quick') {
    if (source.algorithm !== 'webcrypto-16bits-v1' || !Array.isArray(source.bytes) ||
        source.bytes.length !== 2 || !Array.from(source.bytes).every(x => Number.isInteger(x) && x >= 0 && x <= 255)) {
      throw new Error('INVALID_RANDOM_BYTES');
    }
    const bits = source.bytes.flatMap(byte => [7, 6, 5, 4, 3, 2, 1, 0].map(shift => (byte >> shift) & 1));
    return [0, 4, 8, 12].map(i => bits.slice(i, i + 4)) as unknown as Mothers;
  }
  throw new Error('INVALID_SOURCE');
}
