export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
  email?: string;
  name?: string;
  picture?: string;
}

export interface GoogleAccountAppToggles {
  calendar: boolean;
  tasks: boolean;
  drive: boolean;
  contacts: boolean;
}

export interface LinkedGoogleAccount {
  id: string; // unique identifier (usually email)
  email: string;
  name?: string;
  picture?: string;
  tokens: GoogleTokens;
  enabledApps: GoogleAccountAppToggles;
  connectedAt: number;
  /** Comail account identifier (AccountEntry.id) that owns this linked account */
  comailAccountId?: string;
  /** Comail account email that owns this linked account */
  comailAccountEmail?: string;
}

export interface GoogleSessionData {
  accounts: LinkedGoogleAccount[];
  activeAccountId?: string;
}

export interface LinkedGoogleAccountPublic {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  enabledApps: GoogleAccountAppToggles;
  connectedAt: number;
  comailAccountId?: string;
  comailAccountEmail?: string;
}

export interface GoogleMultiAccountStatus {
  configured: boolean;
  connected: boolean;
  accounts: LinkedGoogleAccountPublic[];
  email?: string;
  name?: string;
  picture?: string;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  selected?: boolean;
}

export interface GoogleCalendarListResponse {
  kind: string;
  items: GoogleCalendarItem[];
}

export interface GoogleEventDateTime {
  date?: string; // YYYY-MM-DD for all-day events
  dateTime?: string; // RFC3339 timestamp
  timeZone?: string;
}

export interface GoogleEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
  self?: boolean;
}

export interface GoogleEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  recurrence?: string[];
  recurringEventId?: string;
  attendees?: GoogleEventAttendee[];
  updated?: string;
}

export interface GoogleEventsListResponse {
  kind: string;
  items: GoogleEvent[];
  nextPageToken?: string;
  syncToken?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTaskListsResponse {
  kind: string;
  items?: GoogleTaskList[];
  nextPageToken?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
  parent?: string;
  position?: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  links?: Array<{
    type?: string;
    description?: string;
    link?: string;
  }>;
}

export interface GoogleTasksResponse {
  kind: string;
  items?: GoogleTask[];
  nextPageToken?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  shared?: boolean;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  }>;
  capabilities?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
    canDownload?: boolean;
  };
}

export interface GoogleDriveFilesResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}
