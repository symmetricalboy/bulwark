import { describe, expect, it } from 'vitest';
import { applySpeedyMeetings } from '../calendar-utils';

const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m);

describe('applySpeedyMeetings', () => {
  it('leaves the end untouched when disabled', () => {
    expect(applySpeedyMeetings(at(9), at(10), false)).toEqual(at(10));
  });

  it('trims 30-minute meetings by 5 minutes', () => {
    expect(applySpeedyMeetings(at(9), at(9, 30), true)).toEqual(at(9, 25));
  });

  it('trims longer meetings by 10 minutes', () => {
    expect(applySpeedyMeetings(at(9), at(10), true)).toEqual(at(9, 50));
  });

  it('never trims meetings of 15 minutes or less', () => {
    expect(applySpeedyMeetings(at(9), at(9, 15), true)).toEqual(at(9, 15));
  });
});
