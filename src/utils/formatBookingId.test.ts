import { describe, expect, it } from 'vitest';
import { formatBookingId } from './formatBookingId';

describe('formatBookingId', () => {
  it('formats booking id with string ids', () => {
    expect(formatBookingId('2026-04-06', 'court-a', 'slot-1')).toBe(
      '2026-04-06-court-a-slot-1'
    );
  });

  it('formats booking id with numeric ids', () => {
    expect(formatBookingId('2026-04-06', 7, 14)).toBe('2026-04-06-7-14');
  });

  it('supports mixed id types', () => {
    expect(formatBookingId('2026-04-06', 'equipment-2', 3)).toBe(
      '2026-04-06-equipment-2-3'
    );
  });
});
