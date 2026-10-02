import { describe, expect, test } from 'vitest';
import { activeElapsedMs, buildFeedbackExport, makePilotEvent, notePageHidden, startPilotSession, takeSessionLeft } from '../../src/infrastructure/feedback.ts';

describe('pilot timing and session_left (docs/PILOT.md §3)', () => {
  test('time spent in the background is not counted', () => {
    startPilotSession(1_000);
    expect(activeElapsedMs(4_000)).toBe(3_000);
    notePageHidden(true, 4_000);
    // Still hidden: the clock stops at the moment the page went away.
    expect(activeElapsedMs(60_000)).toBe(3_000);
    notePageHidden(false, 64_000);
    expect(activeElapsedMs(66_000)).toBe(5_000);
    // Repeated hidden/visible signals do not double count.
    notePageHidden(true, 66_000);
    notePageHidden(true, 70_000);
    notePageHidden(false, 76_000);
    notePageHidden(false, 80_000);
    expect(activeElapsedMs(80_000)).toBe(9_000);
  });

  test('a new session starts from zero', () => {
    startPilotSession(1_000);
    notePageHidden(true, 2_000);
    notePageHidden(false, 9_000);
    startPilotSession(10_000);
    expect(activeElapsedMs(12_000)).toBe(2_000);
  });

  test('session_left is taken once per started session', () => {
    startPilotSession();
    expect(takeSessionLeft()).toBe(true);
    expect(takeSessionLeft()).toBe(false);
    startPilotSession();
    expect(takeSessionLeft()).toBe(true);
  });

  test('events carry only whitelisted fields, and the export explains the timing', () => {
    startPilotSession();
    const entry = makePilotEvent('session_left');
    expect(entry.kind === 'event' && Object.keys(entry.event).sort()).toEqual(['elapsedMs', 'name', 'schemaVersion', 'sessionId']);
    const file = JSON.parse(buildFeedbackExport([entry], '2026-10-02T00:00:00.000Z').text);
    expect(file.note).toContain('已扣除頁面在背景的時間');
    expect(file.events[0].name).toBe('session_left');
  });
});
