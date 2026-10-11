import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCalendarStore } from '../calendar-store';
import { useSettingsStore } from '../settings-store';
import type { IJMAPClient } from '@/lib/jmap/client-interface';
import type { Calendar } from '@/lib/jmap/types';

function createMockCal(overrides: Partial<Calendar>): Calendar {
  return {
    id: 'cal-1',
    name: 'Personal',
    color: '#3b82f6',
    sortOrder: 0,
    isSubscribed: true,
    isVisible: true,
    isDefault: false,
    includeInAvailability: 'all',
    timeZone: null,
    shareWith: null,
    myRights: {
      mayReadFreeBusy: true,
      mayReadItems: true,
      mayWriteAll: true,
      mayWriteOwn: true,
      mayUpdatePrivate: true,
      mayRSVP: true,
      mayShare: true,
      mayDelete: true,
    },
    ...overrides,
  } as Calendar;
}

describe('calendar default preference', () => {
  beforeEach(() => {
    useSettingsStore.setState({ defaultCalendarId: null });
    useCalendarStore.setState({ calendars: [], selectedCalendarIds: [], error: null });
  });

  it('sets a Comail calendar as default and notifies client and settings store', async () => {
    const mockClient = {
      setDefaultCalendar: vi.fn().mockResolvedValue(undefined),
    } as unknown as IJMAPClient;

    const cal1 = createMockCal({ id: 'c1', name: 'Work', isDefault: false });
    const cal2 = createMockCal({ id: 'c2', name: 'Home', isDefault: true });

    useCalendarStore.setState({ calendars: [cal1, cal2] });

    await useCalendarStore.getState().setDefaultCalendar(mockClient, 'c1');

    expect(mockClient.setDefaultCalendar).toHaveBeenCalledWith('c1', undefined);
    expect(useSettingsStore.getState().defaultCalendarId).toBe('c1');

    const state = useCalendarStore.getState();
    expect(state.calendars.find((c) => c.id === 'c1')?.isDefault).toBe(true);
    expect(state.calendars.find((c) => c.id === 'c2')?.isDefault).toBe(false);
  });

  it('sets a Google calendar as default without throwing or invoking JMAP client', async () => {
    const mockClient = {
      setDefaultCalendar: vi.fn(),
    } as unknown as IJMAPClient;

    const googleCal = createMockCal({
      id: 'google:user@gmail.com::primary',
      originalId: 'primary',
      localAccountId: 'google:user@gmail.com',
      name: 'Google Work',
      isDefault: false,
    });
    const regularCal = createMockCal({ id: 'c1', name: 'Default Comail', isDefault: true });

    useCalendarStore.setState({ calendars: [regularCal, googleCal] });

    await useCalendarStore.getState().setDefaultCalendar(mockClient, googleCal.id);

    expect(mockClient.setDefaultCalendar).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().defaultCalendarId).toBe(googleCal.id);

    const state = useCalendarStore.getState();
    expect(state.calendars.find((c) => c.id === googleCal.id)?.isDefault).toBe(true);
    expect(state.calendars.find((c) => c.id === 'c1')?.isDefault).toBe(false);
  });

  it('preserves the preferred default calendar on subsequent fetchCalendars', async () => {
    const preferredId = 'cal-preferred';
    useSettingsStore.setState({ defaultCalendarId: preferredId });

    const serverCals = [
      createMockCal({ id: 'cal-default', name: 'Server Default', isDefault: true }),
      createMockCal({ id: preferredId, name: 'Preferred Cal', isDefault: false }),
    ];

    const mockClient = {
      getAllCalendarsWithFailures: vi.fn().mockResolvedValue({
        calendars: serverCals,
        failedAccountIds: [],
      }),
      getParticipantIdentities: vi.fn().mockResolvedValue([]),
    } as unknown as IJMAPClient;

    await useCalendarStore.getState().fetchCalendars(mockClient);

    const state = useCalendarStore.getState();
    expect(state.calendars.find((c) => c.id === preferredId)?.isDefault).toBe(true);
    expect(state.calendars.find((c) => c.id === 'cal-default')?.isDefault).toBe(false);
  });
});
