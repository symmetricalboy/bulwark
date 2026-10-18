import type { Calendar, CalendarEvent, CalendarParticipant, CalendarLocation, CalendarRights } from '@/lib/jmap/types';
import type { MicrosoftGraphCalendar, MicrosoftGraphEvent } from './types';

const OUTLOOK_COLOR_MAP: Record<string, string> = {
  auto: '#0078D4',
  lightBlue: '#0078D4',
  lightGreen: '#107C10',
  lightOrange: '#D83B01',
  lightGray: '#5D5A58',
  lightYellow: '#FFB900',
  lightTeal: '#008272',
  lightPink: '#E3008C',
  lightBrown: '#8E562E',
  lightRed: '#D13438',
  maxColor: '#5C2D91',
};

export function mapMicrosoftToJmapCalendar(msCal: MicrosoftGraphCalendar, accountEmail: string): Calendar {
  const accountPrefix = `microsoft:${accountEmail}`;
  const isReadOnly = msCal.canEdit === false;
  const color = msCal.hexColor || (msCal.color ? OUTLOOK_COLOR_MAP[msCal.color] : undefined) || '#0078D4';
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
    id: `${accountPrefix}::${msCal.id}`,
    originalId: msCal.id,
    name: msCal.name || accountEmail,
    description: null,
    color,
    sortOrder: msCal.isDefaultCalendar ? -1 : 0,
    isVisible: true,
    isDefault: Boolean(msCal.isDefaultCalendar),
    isSubscribed: true,
    includeInAvailability: 'all',
    defaultAlertsWithTime: null,
    defaultAlertsWithoutTime: null,
    timeZone: null,
    shareWith: null,
    myRights,
    localAccountId: accountPrefix,
  };
}

export function mapMicrosoftToJmapEvent(
  msEvent: MicrosoftGraphEvent,
  namespacedCalendarId: string,
  accountEmail: string
): CalendarEvent {
  const accountPrefix = `microsoft:${accountEmail}`;
  const showAllDay = Boolean(msEvent.isAllDay);
  let start = new Date().toISOString();
  let timeZone = 'UTC';

  if (msEvent.start?.dateTime) {
    start = showAllDay
      ? `${msEvent.start.dateTime.slice(0, 10)}T00:00:00`
      : msEvent.start.dateTime;
    if (msEvent.start.timeZone) {
      timeZone = msEvent.start.timeZone;
    }
  }

  let duration = 'PT1H';
  if (msEvent.start?.dateTime && msEvent.end?.dateTime) {
    const sTime = new Date(msEvent.start.dateTime).getTime();
    const eTime = new Date(msEvent.end.dateTime).getTime();
    if (!isNaN(sTime) && !isNaN(eTime) && eTime > sTime) {
      if (showAllDay) {
        const diffDays = Math.max(1, Math.round((eTime - sTime) / (1000 * 60 * 60 * 24)));
        duration = `P${diffDays}D`;
      } else {
        const diffMinutes = Math.max(1, Math.round((eTime - sTime) / (1000 * 60)));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        let dStr = 'PT';
        if (hours > 0) dStr += `${hours}H`;
        if (mins > 0 || hours === 0) dStr += `${mins}M`;
        duration = dStr;
      }
    }
  }

  const participants: Record<string, CalendarParticipant> = {};
  if (msEvent.attendees && msEvent.attendees.length > 0) {
    msEvent.attendees.forEach((att, idx) => {
      const email = att.emailAddress?.address || '';
      const key = email || `attendee-${idx}`;
      let participationStatus: CalendarParticipant['participationStatus'] = 'needs-action';
      const resp = att.status?.response;
      if (resp === 'accepted' || resp === 'organizer') participationStatus = 'accepted';
      else if (resp === 'declined') participationStatus = 'declined';
      else if (resp === 'tentativelyAccepted') participationStatus = 'tentative';

      participants[key] = {
        '@type': 'Participant',
        name: att.emailAddress?.name || email || 'Attendee',
        email,
        roles: {
          attendee: true,
          chair: resp === 'organizer',
          optional: att.type === 'optional',
        },
        participationStatus,
        calendarAddress: email || null,
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
    });
  }

  const locations: Record<string, CalendarLocation> | null = msEvent.location?.displayName
    ? {
        'loc-1': {
          '@type': 'Location',
          name: msEvent.location.displayName,
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
    id: `${accountPrefix}::${msEvent.id}`,
    originalId: msEvent.id,
    uid: msEvent.id,
    calendarIds: { [namespacedCalendarId]: true },
    title: msEvent.subject || '(No Title)',
    description: (msEvent.body?.contentType === 'text' ? msEvent.body.content : msEvent.bodyPreview) || '',
    descriptionContentType: 'text/plain',
    start,
    duration,
    timeZone: timeZone || null,
    showWithoutTime: showAllDay,
    status: 'confirmed',
    freeBusyStatus: msEvent.showAs === 'free' ? 'free' : 'busy',
    privacy: msEvent.sensitivity === 'private' || msEvent.sensitivity === 'confidential' ? 'private' : 'public',
    locations,
    participants: Object.keys(participants).length > 0 ? participants : null,
    localAccountId: accountPrefix,
    isDraft: false,
    isOrigin: true,
    utcStart: null,
    utcEnd: null,
    created: msEvent.lastModifiedDateTime || null,
    updated: msEvent.lastModifiedDateTime || null,
    sequence: 0,
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

export function mapJmapToMicrosoftEvent(jmapEvent: Partial<CalendarEvent>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (jmapEvent.title !== undefined) {
    payload.subject = jmapEvent.title;
  }
  if (jmapEvent.description !== undefined) {
    payload.body = {
      contentType: 'Text',
      content: jmapEvent.description || '',
    };
  }

  if (jmapEvent.locations) {
    const firstLoc = Object.values(jmapEvent.locations)[0];
    payload.location = { displayName: firstLoc?.name || '' };
  }

  if (jmapEvent.start) {
    const startObj = new Date(jmapEvent.start);
    const tz = jmapEvent.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (jmapEvent.showWithoutTime) {
      payload.isAllDay = true;
      const datePart = jmapEvent.start.split('T')[0];
      let daysToAdd = 1;
      if (jmapEvent.duration) {
        const match = jmapEvent.duration.match(/P(\d+)D/);
        if (match) daysToAdd = parseInt(match[1], 10);
      }
      const endDate = new Date(`${datePart}T00:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + daysToAdd);
      const endPart = endDate.toISOString().split('T')[0];
      payload.start = { dateTime: `${datePart}T00:00:00`, timeZone: tz };
      payload.end = { dateTime: `${endPart}T00:00:00`, timeZone: tz };
    } else {
      payload.isAllDay = false;
      let msToAdd = 60 * 60 * 1000;
      if (jmapEvent.duration) {
        const hMatch = jmapEvent.duration.match(/(\d+)H/);
        const mMatch = jmapEvent.duration.match(/(\d+)M/);
        const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
        const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
        if (hours > 0 || mins > 0) {
          msToAdd = (hours * 60 + mins) * 60 * 1000;
        }
      }
      const endObj = new Date(startObj.getTime() + msToAdd);
      payload.start = { dateTime: startObj.toISOString(), timeZone: 'UTC' };
      payload.end = { dateTime: endObj.toISOString(), timeZone: 'UTC' };
    }
  }

  if (jmapEvent.participants) {
    payload.attendees = Object.values(jmapEvent.participants)
      .filter((p) => p.email)
      .map((p) => ({
        emailAddress: {
          address: p.email,
          ...(p.name ? { name: p.name } : {}),
        },
        type: p.roles?.optional ? 'optional' : 'required',
      }));
  }

  return payload;
}
