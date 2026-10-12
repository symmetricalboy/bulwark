import type { Mailbox, Email } from '@/lib/jmap/types';
import { getComailAccountHeaders } from './comail-headers';
import { parseGoogleEmailId } from './gmail-mapper';

export async function fetchGoogleMailboxes(googleAccountId?: string): Promise<Mailbox[]> {
  const url = googleAccountId
    ? `/api/google/mail/labels?googleAccountId=${encodeURIComponent(googleAccountId)}`
    : '/api/google/mail/labels';

  const res = await fetch(url, {
    headers: getComailAccountHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google mailboxes (${res.status})`);
  }

  const data = await res.json();
  return data.mailboxes || [];
}

export interface FetchGoogleEmailsOptions {
  mailboxId?: string;
  googleAccountId?: string;
  query?: string;
  pageToken?: string;
  maxResults?: number;
}

export async function fetchGoogleEmails(options: FetchGoogleEmailsOptions = {}): Promise<{
  emails: Email[];
  nextPageToken?: string;
  total?: number;
}> {
  const url = new URL('/api/google/mail/messages', window.location.origin);
  if (options.mailboxId) url.searchParams.set('mailboxId', options.mailboxId);
  if (options.googleAccountId) url.searchParams.set('googleAccountId', options.googleAccountId);
  if (options.query) url.searchParams.set('q', options.query);
  if (options.pageToken) url.searchParams.set('pageToken', options.pageToken);
  if (options.maxResults) url.searchParams.set('maxResults', String(options.maxResults));

  const res = await fetch(url.toString(), {
    headers: getComailAccountHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google emails (${res.status})`);
  }

  const data = await res.json();
  return {
    emails: data.emails || [],
    nextPageToken: data.nextPageToken,
    total: data.total,
  };
}

export async function fetchGoogleEmail(emailId: string): Promise<Email> {
  const parsed = parseGoogleEmailId(emailId);
  const rawId = parsed ? parsed.messageId : emailId;
  const url = new URL(`/api/google/mail/messages/${encodeURIComponent(rawId)}`, window.location.origin);
  if (parsed) {
    url.searchParams.set('googleAccountId', parsed.accountEmail);
  }

  const res = await fetch(url.toString(), {
    headers: getComailAccountHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google email (${res.status})`);
  }

  const data = await res.json();
  return data.email;
}

export async function updateGoogleEmail(
  emailId: string,
  updates: {
    read?: boolean;
    starred?: boolean;
    action?: 'trash' | 'untrash';
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
): Promise<Email | { success: boolean }> {
  const parsed = parseGoogleEmailId(emailId);
  const rawId = parsed ? parsed.messageId : emailId;
  const url = new URL(`/api/google/mail/messages/${encodeURIComponent(rawId)}`, window.location.origin);
  if (parsed) {
    url.searchParams.set('googleAccountId', parsed.accountEmail);
  }

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getComailAccountHeaders(),
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error(`Failed to update Google email (${res.status})`);
  }

  const data = await res.json();
  return data.email || data;
}

export async function deleteGoogleEmail(emailId: string, permanent = false): Promise<boolean> {
  const parsed = parseGoogleEmailId(emailId);
  const rawId = parsed ? parsed.messageId : emailId;
  const url = new URL(`/api/google/mail/messages/${encodeURIComponent(rawId)}`, window.location.origin);
  if (parsed) {
    url.searchParams.set('googleAccountId', parsed.accountEmail);
  }
  if (permanent) {
    url.searchParams.set('permanent', 'true');
  }

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: getComailAccountHeaders(),
  });

  return res.ok;
}
