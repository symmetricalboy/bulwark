import type { GoogleAppMode } from '@/lib/google/types';

export type MicrosoftAppMode = GoogleAppMode;

export interface MicrosoftAccountAppToggles {
  outlook?: boolean;
  onedrive?: boolean;
  calendar?: MicrosoftAppMode | boolean;
  tasks?: MicrosoftAppMode | boolean;
  contacts?: MicrosoftAppMode | boolean;
}

export const DEFAULT_MICROSOFT_APP_TOGGLES: Required<MicrosoftAccountAppToggles> = {
  outlook: false,
  onedrive: false,
  calendar: 'none',
  tasks: 'none',
  contacts: 'none',
};

export function resolveMicrosoftAppMode(value: MicrosoftAppMode | boolean | undefined): MicrosoftAppMode {
  if (value === 'separate' || value === 'sync' || value === 'none') return value;
  if (value === true) return 'separate';
  return 'none';
}

export function isMicrosoftAppEnabled(value: MicrosoftAppMode | boolean | undefined): boolean {
  return resolveMicrosoftAppMode(value) !== 'none';
}

export interface MicrosoftAccountTokens {
  id: string;
  email: string;
  name?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apps?: MicrosoftAccountAppToggles;
  connectedAt?: number;
  updatedAt?: number;
  comailAccountId?: string;
  comailAccountEmail?: string;
}

export interface LinkedMicrosoftAccountPublic {
  id: string;
  email: string;
  name?: string;
  expiresAt?: number;
  apps?: MicrosoftAccountAppToggles;
  enabledApps?: {
    outlook?: boolean;
    drive?: boolean;
    onedrive?: boolean;
    calendar?: MicrosoftAppMode | boolean;
    tasks?: MicrosoftAppMode | boolean;
    contacts?: MicrosoftAppMode | boolean;
  };
}

export interface MicrosoftAccountStatusResponse {
  configured: boolean;
  connected: boolean;
  email?: string;
  name?: string;
  accounts?: LinkedMicrosoftAccountPublic[];
}

export interface MicrosoftSessionData {
  accounts: MicrosoftAccountTokens[];
}

export interface MicrosoftGraphCalendar {
  id: string;
  name: string;
  color?: string;
  hexColor?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
}

export interface MicrosoftGraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType?: 'text' | 'html';
    content?: string;
  };
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  isAllDay?: boolean;
  location?: {
    displayName?: string;
  };
  attendees?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
    type?: 'required' | 'optional' | 'resource';
    status?: {
      response?: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
    };
  }>;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
  lastModifiedDateTime?: string;
}

export interface MicrosoftGraphContact {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  middleName?: string;
  title?: string;
  jobTitle?: string;
  companyName?: string;
  department?: string;
  personalNotes?: string;
  birthday?: string;
  emailAddresses?: Array<{
    name?: string;
    address?: string;
  }>;
  businessPhones?: string[];
  homePhones?: string[];
  mobilePhone?: string;
  businessAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryOrRegion?: string;
  };
  homeAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryOrRegion?: string;
  };
  businessHomePage?: string;
  lastModifiedDateTime?: string;
}

export interface MicrosoftGraphTodoList {
  id: string;
  displayName: string;
  isOwner?: boolean;
  isShared?: boolean;
  wellknownListName?: 'none' | 'defaultList' | 'flaggedEmails' | 'unknownFutureValue';
}

export interface MicrosoftGraphTodoTask {
  id: string;
  title: string;
  status?: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  importance?: 'low' | 'normal' | 'high';
  isReminderOn?: boolean;
  body?: {
    content?: string;
    contentType?: 'text' | 'html';
  };
  dueDateTime?: {
    dateTime?: string;
    timeZone?: string;
  } | null;
  completedDateTime?: {
    dateTime?: string;
    timeZone?: string;
  } | null;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}
