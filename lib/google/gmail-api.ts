import type {
  GmailLabel,
  GmailMessage,
  GmailListMessagesResponse,
} from './types';
import { logger } from '@/lib/logger';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function getGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const res = await fetch(`${GMAIL_API_BASE}/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error('Failed to list Gmail labels', { status: res.status });
    throw new Error(`Gmail API error listing labels: ${res.status}`);
  }

  const data = (await res.json()) as { labels?: GmailLabel[] };
  const rawLabels = data.labels || [];

  // For key system labels (INBOX, SENT, TRASH, DRAFT, SPAM), fetch full counts
  const labelsWithCounts = await Promise.all(
    rawLabels.map(async (label) => {
      // If messagesTotal/messagesUnread are already present or label is user-created, we can fetch details if needed
      if (['INBOX', 'TRASH', 'SPAM', 'STARRED', 'DRAFT', 'SENT'].includes(label.id.toUpperCase())) {
        try {
          const detailRes = await fetch(`${GMAIL_API_BASE}/labels/${encodeURIComponent(label.id)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (detailRes.ok) {
            return (await detailRes.json()) as GmailLabel;
          }
        } catch {
          // fallback to base label
        }
      }
      return label;
    })
  );

  return labelsWithCounts;
}

export async function listGmailMessages(
  accessToken: string,
  options?: {
    labelIds?: string[];
    q?: string;
    pageToken?: string;
    maxResults?: number;
  }
): Promise<GmailListMessagesResponse> {
  const url = new URL(`${GMAIL_API_BASE}/messages`);
  if (options?.labelIds && options.labelIds.length > 0) {
    for (const lid of options.labelIds) {
      url.searchParams.append('labelIds', lid);
    }
  }
  if (options?.q) {
    url.searchParams.set('q', options.q);
  }
  if (options?.pageToken) {
    url.searchParams.set('pageToken', options.pageToken);
  }
  if (options?.maxResults) {
    url.searchParams.set('maxResults', String(options.maxResults));
  } else {
    url.searchParams.set('maxResults', '30');
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error('Failed to list Gmail messages', { status: res.status });
    throw new Error(`Gmail API error listing messages: ${res.status}`);
  }

  return (await res.json()) as GmailListMessagesResponse;
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
  format: 'full' | 'metadata' | 'raw' = 'full'
): Promise<GmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}?format=${format}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error('Failed to get Gmail message', { messageId, status: res.status });
    throw new Error(`Gmail API error getting message: ${res.status}`);
  }

  return (await res.json()) as GmailMessage;
}

export async function modifyGmailMessage(
  accessToken: string,
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<GmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/modify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });

  if (!res.ok) {
    logger.error('Failed to modify Gmail message', { messageId, status: res.status });
    throw new Error(`Gmail API error modifying message: ${res.status}`);
  }

  return (await res.json()) as GmailMessage;
}

export async function trashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/trash`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error('Failed to trash Gmail message', { messageId, status: res.status });
    throw new Error(`Gmail API error trashing message: ${res.status}`);
  }

  return (await res.json()) as GmailMessage;
}

export async function untrashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/untrash`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error('Failed to untrash Gmail message', { messageId, status: res.status });
    throw new Error(`Gmail API error untrashing message: ${res.status}`);
  }

  return (await res.json()) as GmailMessage;
}

export async function deleteGmailMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    logger.error('Failed to permanently delete Gmail message', { messageId, status: res.status });
    throw new Error(`Gmail API error deleting message: ${res.status}`);
  }
}

export async function sendGmailMessage(
  accessToken: string,
  rawMimeBase64Url: string
): Promise<GmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawMimeBase64Url }),
  });

  if (!res.ok) {
    logger.error('Failed to send Gmail message', { status: res.status });
    throw new Error(`Gmail API error sending message: ${res.status}`);
  }

  return (await res.json()) as GmailMessage;
}

export async function getGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ size: number; data: string }> {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error('Failed to get Gmail attachment', { messageId, attachmentId, status: res.status });
    throw new Error(`Gmail API error getting attachment: ${res.status}`);
  }

  return (await res.json()) as { size: number; data: string };
}
