import { describe, expect, it } from 'vitest';
import { COLOMBIAN_HOLIDAYS_2026, COLOMBIAN_HOLIDAYS_2027 } from './constants';

function assertHolidayList(list: { date: string; name: string }[]) {
  expect(list).toHaveLength(19);

  const dates = new Set<string>();
  let previousDate = '';
  for (const entry of list) {
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.name.length).toBeGreaterThan(0);
    expect(dates.has(entry.date)).toBe(false);
    dates.add(entry.date);
    expect(entry.date > previousDate).toBe(true);
    previousDate = entry.date;
  }
}

describe('Colombian holiday constants', () => {
  it('contains 19 unique sorted holidays for 2026', () => {
    assertHolidayList(COLOMBIAN_HOLIDAYS_2026);
    expect(COLOMBIAN_HOLIDAYS_2026[0].date).toBe('2026-01-01');
    expect(COLOMBIAN_HOLIDAYS_2026[18].date).toBe('2026-12-25');
  });

  it('contains 19 unique sorted holidays for 2027', () => {
    assertHolidayList(COLOMBIAN_HOLIDAYS_2027);
    expect(COLOMBIAN_HOLIDAYS_2027[0].date).toBe('2027-01-01');
    expect(COLOMBIAN_HOLIDAYS_2027[18].date).toBe('2027-12-25');
  });

  it('includes expected movable and fixed dates for 2026', () => {
    const dates = COLOMBIAN_HOLIDAYS_2026.map((h) => h.date);
    expect(dates).toContain('2026-04-02'); // Jueves Santo
    expect(dates).toContain('2026-04-03'); // Viernes Santo
    expect(dates).toContain('2026-04-05'); // Domingo de Resurrección
    expect(dates).toContain('2026-05-18'); // Ascensión (Lunes)
    expect(dates).toContain('2026-07-20'); // Independencia
  });
});
