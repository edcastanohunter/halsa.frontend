import { aBogotaLocal, bogotaLocalAIso, finDelDiaBogota } from '@halsa/core';

describe('Bogotá wall-clock helpers', () => {
  it('reads a datetime-local value as Bogotá time', () => {
    expect(bogotaLocalAIso('2026-10-17T15:30')).toBe('2026-10-17T15:30:00-05:00');
    expect(Date.parse(bogotaLocalAIso('2026-10-17T21:00')!)).toBe(
      Date.parse('2026-10-18T02:00:00Z'),
    );
    expect(bogotaLocalAIso('2026-02-30T10:00')).toBeNull();
    expect(bogotaLocalAIso('2026-10-17T24:00')).toBeNull();
    expect(bogotaLocalAIso('')).toBeNull();
  });

  it('shows an instant as a Bogotá datetime-local value', () => {
    // 02:00 UTC on the 18th is 21:00 on the 17th in Bogotá.
    expect(aBogotaLocal('2026-10-18T02:00:00Z')).toBe('2026-10-17T21:00');
    expect(aBogotaLocal('no')).toBeNull();
  });

  it('round-trips', () => {
    const local = '2026-01-01T00:05';
    expect(aBogotaLocal(bogotaLocalAIso(local)!)).toBe(local);
  });

  it('"vence antes de" a date means before the next Bogotá midnight', () => {
    expect(finDelDiaBogota('2026-10-17')).toBe('2026-10-18T00:00:00-05:00');
    expect(finDelDiaBogota('2026-12-31')).toBe('2027-01-01T00:00:00-05:00');
    expect(finDelDiaBogota('2026-13-01')).toBeNull();
  });
});
