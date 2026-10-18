export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
  email?: string;
  name?: string;
  picture?: string;
}

export type GoogleAppMode = 'none' | 'separate' | 'sync';

export interface GoogleAccountAppToggles {
  gmail?: boolean;
  drive?: boolean;
  calendar?: GoogleAppMode | boolean;
  tasks?: GoogleAppMode | boolean;
  contacts?: GoogleAppMode | boolean;
}

export function normalizeAppMode(val: unknown): GoogleAppMode {
  if (val === 'sync') return 'sync';
  if (val === 'separate' || val === true) return 'separate';
  return 'none';
}

export function isAppEnabled(val: unknown): boolean {
  if (val === true) return true;
  if (val === 'separate' || val === 'sync') return true;
  return false;
}

export const DEFAULT_GOOGLE_APP_TOGGLES: GoogleAccountAppToggles = {
  gmail: false,
  drive: false,
  calendar: 'none',
  tasks: 'none',
  contacts: 'none',
};

export interface LinkedGoogleAccount {
  id: string; // unique identifier (usually email)
  email: string;
  name?: string;
  picture?: string;
  tokens: GoogleTokens;
  enabledApps: GoogleAccountAppToggles;
  connectedAt: number;
  updatedAt?: number;
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
  accountEmail?: string;
  localAccountId?: string;
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
  accountEmail?: string;
  localAccountId?: string;
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
  accountEmail?: string;
  localAccountId?: string;
}

export interface GoogleDriveFilesResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: 'system' | 'user';
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailMessagePartHeader {
  name: string;
  value: string;
}

export interface GmailMessagePartBody {
  attachmentId?: string;
  size: number;
  data?: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailMessagePartHeader[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate: string;
  payload?: GmailMessagePart;
  sizeEstimate?: number;
  raw?: string;
}

export interface GmailThread {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailMessage[];
}

export interface GmailListMessagesResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

