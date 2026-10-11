import type {
  Calendar,
  CalendarEvent,
  CalendarParticipant,
  CalendarLocation,
  CalendarRights,
} from '@/lib/jmap/types';
import type { GoogleCalendarItem, GoogleEvent } from './types';
import { differenceInDays, differenceInMinutes, parseISO, addMinutes, addDays, format } from 'date-fns';

export const GOOGLE_BIRTHDAY_CALENDAR_ID = '#birthdays';
export const GOOGLE_BIRTHDAY_CALENDAR_COLOR = '#eab308';

export function isGoogleBirthdayCalendarId(calendarId: string): boolean {
  if (!calendarId) return false;
  const cleanId = calendarId.includes('::') ? calendarId.split('::')[1] : calendarId;
  return (
    cleanId === GOOGLE_BIRTHDAY_CALENDAR_ID ||
    cleanId === '#birthdays' ||
    cleanId.includes('contacts@group.v.calendar.google.com')
  );
}

export function isGoogleBirthdayEvent(event: GoogleEvent): boolean {
  return (
    (event as unknown as { eventType?: string }).eventType === 'birthday' ||
    Boolean((event as unknown as { birthdayProperties?: unknown }).birthdayProperties)
  );
}

export function createGoogleBirthdayCalendar(accountEmail: string): Calendar {
  const accountPrefix = `google:${accountEmail}`;
  return {
    id: `${accountPrefix}::${GOOGLE_BIRTHDAY_CALENDAR_ID}`,
    originalId: GOOGLE_BIRTHDAY_CALENDAR_ID,
    name: 'Birthdays',
    description: 'Google Contacts birthdays',
    color: GOOGLE_BIRTHDAY_CALENDAR_COLOR,
    sortOrder: 10,
    isVisible: true,
    isSubscribed: true,
    isDefault: false,
    includeInAvailability: 'none',
    defaultAlertsWithTime: null,
    defaultAlertsWithoutTime: null,
    timeZone: null,
    shareWith: null,
    myRights: {
      mayReadFreeBusy: true,
      mayReadItems: true,
      mayWriteAll: false,
      mayWriteOwn: false,
      mayUpdatePrivate: false,
      mayRSVP: false,
      mayShare: false,
      mayDelete: false,
    },
    localAccountId: accountPrefix,
  };
}

export function googleCalendarToJmap(item: GoogleCalendarItem, accountEmail: string): Calendar {
  const accountPrefix = `google:${accountEmail}`;
  const namespacedId = `${accountPrefix}::${item.id}`;
  const isBirthday = isGoogleBirthdayCalendarId(item.id) || item.summary?.toLowerCase() === 'birthdays';
  const isReadOnly = isBirthday || item.accessRole === 'reader' || item.accessRole === 'freeBusyReader';

  const myRights: CalendarRights = {
    mayReadFreeBusy: true,
    mayReadItems: true,
    mayWriteAll: !isReadOnly,
    mayWriteOwn: !isReadOnly,
    mayUpdatePrivate: !isReadOnly,
    mayRSVP: true,
    mayShare: false,
    mayDelete: !isReadOnly,
  };

  return {
    id: namespacedId,
    originalId: item.id,
    name: item.summary,
    description: item.description || null,
    color: item.backgroundColor || (isBirthday ? GOOGLE_BIRTHDAY_CALENDAR_COLOR : '#4285F4'),
    sortOrder: item.primary ? -1 : isBirthday ? 10 : 0,
    isVisible: item.selected !== false,
    isSubscribed: true,
    isDefault: Boolean(item.primary),
    includeInAvailability: isBirthday ? 'none' : 'all',
    defaultAlertsWithTime: null,
    defaultAlertsWithoutTime: null,
    timeZone: null,
    shareWith: null,
    myRights,
    localAccountId: accountPrefix,
  };
}

export function parseDurationMinutes(duration: string): number {
  if (!duration) return 60;
  if (duration.startsWith('P') && duration.includes('D')) {
    const days = parseInt(duration.replace(/[^0-9]/g, ''), 10) || 1;
    return days * 24 * 60;
  }
  const hoursMatch = duration.match(/(\d+)H/);
  const minsMatch = duration.match(/(\d+)M/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
  return hours * 60 + mins || 60;
}

export function formatDurationFromMinutes(minutes: number, isAllDay = false): string {
  if (isAllDay) {
    const days = Math.max(1, Math.round(minutes / (24 * 60)));
    return `P${days}D`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours > 0 && remainingMins > 0) return `PT${hours}H${remainingMins}M`;
  if (hours > 0) return `PT${hours}H`;
  return `PT${remainingMins}M`;
}

export function googleEventToJmap(
  event: GoogleEvent,
  calendarId: string,
  accountEmail: string,
): CalendarEvent {
  const accountPrefix = `google:${accountEmail}`;
  const isBirthday = isGoogleBirthdayEvent(event) || isGoogleBirthdayCalendarId(calendarId);
  const effectiveCalendarId = isBirthday ? GOOGLE_BIRTHDAY_CALENDAR_ID : calendarId;
  const namespacedCalendarId = `${accountPrefix}::${effectiveCalendarId}`;
  const namespacedEventId = `${accountPrefix}::${event.id}`;

  const isAllDay = Boolean(event.start.date && !event.start.dateTime);
  let start = '';
  let duration = 'PT1H';

  if (isAllDay) {
    start = event.start.date || '';
    if (event.end.date && event.start.date) {
      const days = differenceInDays(parseISO(event.end.date), parseISO(event.start.date));
      duration = `P${Math.max(1, days)}D`;
    } else {
      duration = 'P1D';
    }
  } else {
    start = event.start.dateTime || '';
    if (event.start.dateTime && event.end.dateTime) {
      const mins = differenceInMinutes(parseISO(event.end.dateTime), parseISO(event.start.dateTime));
      duration = formatDurationFromMinutes(Math.max(15, mins));
    }
  }

  const participants: Record<string, CalendarParticipant> = {};
  if (event.attendees) {
    for (const attendee of event.attendees) {
      let participationStatus: CalendarParticipant['participationStatus'] = 'needs-action';
      if (attendee.responseStatus === 'accepted') participationStatus = 'accepted';
      else if (attendee.responseStatus === 'declined') participationStatus = 'declined';
      else if (attendee.responseStatus === 'tentative') participationStatus = 'tentative';

      participants[attendee.email] = {
        '@type': 'Participant',
        name: attendee.displayName || attendee.email,
        email: attendee.email,
        participationStatus,
        roles: { attendee: true },
        calendarAddress: attendee.email,
        description: null,
        sendTo: null,
        kind: 'individual',
        memberOf: null,
        locationId: null,
        expectReply: false,
        participationComment: null,
        scheduleAgent: 'server',
        scheduleForceSend: false,
        scheduleId: null,
        scheduleSequence: 0,
        scheduleStatus: null,
        scheduleUpdated: null,
        invitedBy: null,
        delegatedTo: null,
        delegatedFrom: null,
        language: null,
        links: null,
      };
    }
  }

  const locations: Record<string, CalendarLocation> | null = event.location
    ? {
        loc: {
          '@type': 'Location',
          name: event.location,
          description: null,
          locationTypes: null,
          coordinates: null,
          timeZone: null,
          links: null,
          relativeTo: null,
        },
      }
    : null;

  return {
    '@type': 'Event',
    id: namespacedEventId,
    originalId: event.id,
    uid: event.id,
    title: event.summary || '(No title)',
    description: event.description || '',
    descriptionContentType: 'text/plain',
    start,
    duration,
    showWithoutTime: isAllDay,
    timeZone: event.start.timeZone || null,
    calendarIds: { [namespacedCalendarId]: true },
    locations,
    status: event.status === 'cancelled' ? 'cancelled' : 'confirmed',
    participants: Object.keys(participants).length > 0 ? participants : null,
    localAccountId: accountPrefix,
    isDraft: false,
    isOrigin: true,
    utcStart: null,
    utcEnd: null,
    created: event.updated || null,
    updated: event.updated || null,
    sequence: 0,
    freeBusyStatus: 'busy',
    privacy: 'public',
    color: null,
    keywords: null,
    categories: null,
    locale: null,
    replyTo: null,
    organizerCalendarAddress: null,
    mayInviteSelf: false,
    mayInviteOthers: false,
    hideAttendees: false,
    recurrenceId: null,
    recurrenceIdTimeZone: null,
    recurrenceRules: null,
    recurrenceOverrides: null,
    excludedRecurrenceRules: null,
    useDefaultAlerts: false,
    alerts: null,
    virtualLocations: null,
    links: null,
    relatedTo: null,
  };
}

export function jmapEventToGoogle(input: Partial<CalendarEvent>): Partial<GoogleEvent> {
  const googleEvent: Partial<GoogleEvent> = {
    summary: input.title || '',
    description: input.description || '',
  };

  if (input.locations) {
    const loc = Object.values(input.locations)[0];
    if (loc?.name) googleEvent.location = loc.name;
  }

  if (input.showWithoutTime) {
    const startDate = input.start ? input.start.slice(0, 10) : format(new Date(), 'yyyy-MM-dd');
    const days = input.duration ? parseInt(input.duration.replace(/[^0-9]/g, ''), 10) || 1 : 1;
    const endDate = format(addDays(parseISO(startDate), days), 'yyyy-MM-dd');
    googleEvent.start = { date: startDate };
    googleEvent.end = { date: endDate };
  } else if (input.start) {
    const startTime = parseISO(input.start);
    const durationMins = input.duration ? parseDurationMinutes(input.duration) : 60;
    const endTime = addMinutes(startTime, durationMins);
    googleEvent.start = {
      dateTime: startTime.toISOString(),
      timeZone: input.timeZone || undefined,
    };
    googleEvent.end = {
      dateTime: endTime.toISOString(),
      timeZone: input.timeZone || undefined,
    };
  }

  return googleEvent;
}
