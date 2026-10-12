import type { Email, Mailbox, EmailAddress, EmailBodyPart, EmailBodyValue, Attachment } from '@/lib/jmap/types';
import type { GmailLabel, GmailMessage, GmailMessagePart } from './types';

export function isGoogleMailboxId(id: string): boolean {
  return id.startsWith('google:');
}

export function parseGoogleMailboxId(namespacedId: string): { accountEmail: string; labelId: string } | null {
  if (!namespacedId.startsWith('google:')) return null;
  const withoutPrefix = namespacedId.slice(7);
  const parts = withoutPrefix.split('::');
  if (parts.length < 2) return null;
  return {
    accountEmail: parts[0],
    labelId: parts.slice(1).join('::'),
  };
}

export function isGoogleEmailId(id: string): boolean {
  return id.startsWith('google:');
}

export function parseGoogleEmailId(namespacedId: string): { accountEmail: string; messageId: string } | null {
  if (!namespacedId.startsWith('google:')) return null;
  const withoutPrefix = namespacedId.slice(7);
  const parts = withoutPrefix.split('::');
  if (parts.length < 2) return null;
  return {
    accountEmail: parts[0],
    messageId: parts.slice(1).join('::'),
  };
}

const SYSTEM_LABEL_ROLES: Record<string, { role: string; sortOrder: number; displayName: string }> = {
  INBOX: { role: 'inbox', sortOrder: 1, displayName: 'Inbox' },
  STARRED: { role: 'starred', sortOrder: 2, displayName: 'Starred' },
  SENT: { role: 'sent', sortOrder: 3, displayName: 'Sent' },
  DRAFT: { role: 'drafts', sortOrder: 4, displayName: 'Drafts' },
  IMPORTANT: { role: 'important', sortOrder: 5, displayName: 'Important' },
  SPAM: { role: 'junk', sortOrder: 90, displayName: 'Spam' },
  TRASH: { role: 'trash', sortOrder: 99, displayName: 'Trash' },
};

export function googleLabelToMailbox(label: GmailLabel, accountEmail: string): Mailbox {
  const meta = SYSTEM_LABEL_ROLES[label.id.toUpperCase()];
  const role = meta?.role;
  const name = meta?.displayName || label.name;
  const sortOrder = meta?.sortOrder ?? 10;

  return {
    id: `google:${accountEmail}::${label.id}`,
    originalId: label.id,
    name,
    role,
    sortOrder,
    totalEmails: label.messagesTotal || 0,
    unreadEmails: label.messagesUnread || 0,
    totalThreads: label.threadsTotal || 0,
    unreadThreads: label.threadsUnread || 0,
    isSubscribed: true,
    accountId: `google:${accountEmail}`,
    accountName: accountEmail,
    isShared: false,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: false,
      mayRename: label.type === 'user',
      mayDelete: label.type === 'user',
      maySubmit: true,
    },
  };
}

/**
 * Parses address headers like:
 * "John Doe <john@example.com>, jane@example.com"
 */
export function parseEmailAddresses(headerValue?: string): EmailAddress[] {
  if (!headerValue) return [];

  const results: EmailAddress[] = [];
  // Split on commas that are outside quotes
  const addressTokens = headerValue.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  for (const token of addressTokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const angleMatch = trimmed.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/);
    if (angleMatch) {
      results.push({
        name: angleMatch[1]?.trim() || undefined,
        email: angleMatch[2].trim(),
      });
    } else {
      results.push({
        email: trimmed.replace(/^<|>$/g, ''),
      });
    }
  }

  return results;
}

function decodeBase64Url(data?: string): string {
  if (!data) return '';
  try {
    return Buffer.from(data, 'base64url').toString('utf-8');
  } catch {
    return '';
  }
}

interface ExtractedBodies {
  textParts: EmailBodyPart[];
  htmlParts: EmailBodyPart[];
  bodyValues: Record<string, EmailBodyValue>;
  attachments: Attachment[];
}

function extractParts(part?: GmailMessagePart, counter = { val: 0 }): ExtractedBodies {
  const result: ExtractedBodies = {
    textParts: [],
    htmlParts: [],
    bodyValues: {},
    attachments: [],
  };

  if (!part) return result;

  const mimeType = (part.mimeType || '').toLowerCase();
  const filename = part.filename;
  const isAttachment = Boolean(filename || part.body?.attachmentId);

  if (isAttachment && filename) {
    const partId = part.partId || `att-${counter.val++}`;
    const blobId = part.body?.attachmentId || `blob-${counter.val++}`;
    result.attachments.push({
      partId,
      blobId,
      name: filename,
      type: part.mimeType || 'application/octet-stream',
      size: part.body?.size || 0,
    });
  } else if (mimeType === 'text/plain' && part.body?.data) {
    const partId = part.partId || `text-${counter.val++}`;
    const blobId = part.body?.attachmentId || partId;
    const value = decodeBase64Url(part.body.data);
    result.textParts.push({ partId, blobId, type: 'text/plain', size: part.body.size || value.length });
    result.bodyValues[partId] = { value, isTruncated: false };
  } else if (mimeType === 'text/html' && part.body?.data) {
    const partId = part.partId || `html-${counter.val++}`;
    const blobId = part.body?.attachmentId || partId;
    const value = decodeBase64Url(part.body.data);
    result.htmlParts.push({ partId, blobId, type: 'text/html', size: part.body.size || value.length });
    result.bodyValues[partId] = { value, isTruncated: false };
  }

  if (part.parts && part.parts.length > 0) {
    for (const subPart of part.parts) {
      const subResult = extractParts(subPart, counter);
      result.textParts.push(...subResult.textParts);
      result.htmlParts.push(...subResult.htmlParts);
      result.attachments.push(...subResult.attachments);
      Object.assign(result.bodyValues, subResult.bodyValues);
    }
  }

  return result;
}

export function googleMessageToEmail(msg: GmailMessage, accountEmail: string): Email {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

  const subject = getHeader('subject') || '(No Subject)';
  const from = parseEmailAddresses(getHeader('from'));
  const to = parseEmailAddresses(getHeader('to'));
  const cc = parseEmailAddresses(getHeader('cc'));
  const bcc = parseEmailAddresses(getHeader('bcc'));
  const replyTo = parseEmailAddresses(getHeader('reply-to'));
  const dateHeader = getHeader('date');
  const messageId = getHeader('message-id');
  const inReplyTo = getHeader('in-reply-to') ? [getHeader('in-reply-to')!] : undefined;
  const references = getHeader('references') ? getHeader('references')!.split(/\s+/) : undefined;

  const internalTimestamp = parseInt(msg.internalDate || Date.now().toString(), 10);
  const receivedAt = new Date(isNaN(internalTimestamp) ? Date.now() : internalTimestamp).toISOString();
  const sentAt = dateHeader ? new Date(dateHeader).toISOString() : receivedAt;

  // Extract bodies and attachments
  const extracted = extractParts(msg.payload);

  // If no body part was matched but payload.body.data exists
  if (
    extracted.textParts.length === 0 &&
    extracted.htmlParts.length === 0 &&
    msg.payload?.body?.data
  ) {
    const mime = (msg.payload.mimeType || '').toLowerCase();
    const isHtml = mime.includes('html');
    const partId = 'body-0';
    const value = decodeBase64Url(msg.payload.body.data);
    if (isHtml) {
      extracted.htmlParts.push({ partId, blobId: partId, type: 'text/html', size: value.length });
    } else {
      extracted.textParts.push({ partId, blobId: partId, type: 'text/plain', size: value.length });
    }
    extracted.bodyValues[partId] = { value, isTruncated: false };
  }

  // Fallback: If still empty body, use snippet as text body
  if (extracted.textParts.length === 0 && extracted.htmlParts.length === 0 && msg.snippet) {
    const partId = 'snippet-body';
    extracted.textParts.push({ partId, blobId: partId, type: 'text/plain', size: msg.snippet.length });
    extracted.bodyValues[partId] = { value: msg.snippet, isTruncated: false };
  }

  // Keywords and Mailboxes mapping
  const mailboxIds: Record<string, boolean> = {};
  const keywords: Record<string, boolean> = {};

  const labels = msg.labelIds || [];
  for (const labelId of labels) {
    mailboxIds[`google:${accountEmail}::${labelId}`] = true;
  }

  // Read status: If UNREAD is absent, it is seen
  if (!labels.includes('UNREAD')) {
    keywords['$seen'] = true;
  }
  if (labels.includes('STARRED')) {
    keywords['$flagged'] = true;
  }
  if (labels.includes('DRAFT')) {
    keywords['$draft'] = true;
  }
  if (labels.includes('IMPORTANT')) {
    keywords['$important'] = true;
  }

  return {
    id: `google:${accountEmail}::${msg.id}`,
    threadId: `google:${accountEmail}::${msg.threadId}`,
    mailboxIds,
    keywords,
    size: msg.sizeEstimate || 0,
    receivedAt,
    sentAt,
    from: from.length > 0 ? from : undefined,
    to: to.length > 0 ? to : undefined,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
    replyTo: replyTo.length > 0 ? replyTo : undefined,
    subject,
    preview: msg.snippet || '',
    textBody: extracted.textParts.length > 0 ? extracted.textParts : undefined,
    htmlBody: extracted.htmlParts.length > 0 ? extracted.htmlParts : undefined,
    bodyValues: Object.keys(extracted.bodyValues).length > 0 ? extracted.bodyValues : undefined,
    attachments: extracted.attachments.length > 0 ? extracted.attachments : undefined,
    hasAttachment: extracted.attachments.length > 0,
    messageId,
    inReplyTo,
    references,
    accountId: `google:${accountEmail}`,
    accountLabel: accountEmail,
    sourceAccountId: `google:${accountEmail}`,
    sourceClientAccountId: `google:${accountEmail}`,
  };
}
