import type { Email, Mailbox, EmailAddress, EmailBodyPart, EmailBodyValue, Attachment } from '@/lib/jmap/types';
import type { GmailLabel, GmailMessage, GmailMessagePart } from './types';
import { matchGmailStar, cleanGmailStarDisplayName } from './gmail-stars';

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

export const SYSTEM_LABEL_ROLES: Record<string, { role: string; sortOrder: number; displayName: string }> = {
  INBOX: { role: 'inbox', sortOrder: 1, displayName: 'Inbox' },
  STARRED: { role: 'starred', sortOrder: 2, displayName: 'Starred' },
  UNREAD: { role: 'unread', sortOrder: 3, displayName: 'Unread' },
  IMPORTANT: { role: 'important', sortOrder: 4, displayName: 'Important' },
  DRAFT: { role: 'drafts', sortOrder: 5, displayName: 'Drafts' },
  DRAFTS: { role: 'drafts', sortOrder: 5, displayName: 'Drafts' },
  SCHEDULED: { role: 'scheduled', sortOrder: 6, displayName: 'Scheduled' },
  SENT: { role: 'sent', sortOrder: 7, displayName: 'Sent' },
  ARCHIVE: { role: 'archive', sortOrder: 8, displayName: 'Archive' },
  SPAM: { role: 'junk', sortOrder: 9, displayName: 'Spam' },
  TRASH: { role: 'trash', sortOrder: 10, displayName: 'Trash' },
  ALL: { role: 'all', sortOrder: 11, displayName: 'All Mail' },
  ALL_MAIL: { role: 'all', sortOrder: 11, displayName: 'All Mail' },
};

export const GOOGLE_SYSTEM_ROLES_ORDER = [
  { role: 'inbox', labelId: 'INBOX', name: 'Inbox', sortOrder: 1 },
  { role: 'starred', labelId: 'STARRED', name: 'Starred', sortOrder: 2 },
  { role: 'unread', labelId: 'UNREAD', name: 'Unread', sortOrder: 3 },
  { role: 'important', labelId: 'IMPORTANT', name: 'Important', sortOrder: 4 },
  { role: 'drafts', labelId: 'DRAFT', name: 'Drafts', sortOrder: 5 },
  { role: 'scheduled', labelId: 'SCHEDULED', name: 'Scheduled', sortOrder: 6 },
  { role: 'sent', labelId: 'SENT', name: 'Sent', sortOrder: 7 },
  { role: 'archive', labelId: 'ARCHIVE', name: 'Archive', sortOrder: 8 },
  { role: 'junk', labelId: 'SPAM', name: 'Spam', sortOrder: 9 },
  { role: 'trash', labelId: 'TRASH', name: 'Trash', sortOrder: 10 },
  { role: 'all', labelId: 'ALL', name: 'All Mail', sortOrder: 11 },
];

export const GMAIL_CATEGORY_METAS: Record<string, { role: string; sortOrder: number; displayName: string }> = {
  CATEGORY_PERSONAL: { role: 'category_personal', sortOrder: 1, displayName: 'Primary' },
  CATEGORY_SOCIAL: { role: 'category_social', sortOrder: 2, displayName: 'Social' },
  CATEGORY_UPDATES: { role: 'category_updates', sortOrder: 3, displayName: 'Updates' },
  CATEGORY_FORUMS: { role: 'category_forums', sortOrder: 4, displayName: 'Forums' },
  CATEGORY_PROMOTIONS: { role: 'category_promotions', sortOrder: 5, displayName: 'Promotions' },
};

export function isGoogleCategoryLabel(idOrRole?: string | null): boolean {
  if (!idOrRole) return false;
  const upper = idOrRole.toUpperCase();
  return (
    upper in GMAIL_CATEGORY_METAS ||
    upper.startsWith('CATEGORY_') ||
    idOrRole.includes('::CATEGORY_') ||
    idOrRole.startsWith('category_')
  );
}

export function isIgnoredGoogleLabel(labelIdOrName?: string | null): boolean {
  if (!labelIdOrName) return false;
  const upper = labelIdOrName.toUpperCase();
  return upper === 'CHAT' || upper.endsWith('::CHAT') || upper === '^CHAT';
}

export function isGoogleSystemFolder(mailbox: Mailbox): boolean {
  if (isIgnoredGoogleLabel(mailbox.originalId) || isIgnoredGoogleLabel(mailbox.id) || isIgnoredGoogleLabel(mailbox.name)) {
    return false;
  }
  if (mailbox.role && ['inbox', 'starred', 'unread', 'important', 'drafts', 'scheduled', 'sent', 'archive', 'junk', 'trash', 'all', 'all_mail'].includes(mailbox.role)) {
    return true;
  }
  const rawId = (mailbox.originalId || mailbox.id).toUpperCase();
  return ['INBOX', 'STARRED', 'UNREAD', 'IMPORTANT', 'DRAFT', 'DRAFTS', 'SCHEDULED', 'SENT', 'ARCHIVE', 'SPAM', 'TRASH', 'ALL', 'ALL_MAIL'].some(
    (k) => rawId === k || rawId.endsWith(`::${k}`)
  );
}

export function ensureGoogleSystemMailboxes(existing: Mailbox[], accountEmail: string): Mailbox[] {
  const result: Mailbox[] = [];
  const handled = new Set<string>();

  for (const sys of GOOGLE_SYSTEM_ROLES_ORDER) {
    const found = existing.find(
      (m) =>
        m.role === sys.role ||
        (m.originalId && m.originalId.toUpperCase() === sys.labelId) ||
        m.id.toUpperCase().endsWith(`::${sys.labelId}`)
    );

    if (found) {
      handled.add(found.id);
      result.push({
        ...found,
        role: sys.role,
        sortOrder: sys.sortOrder,
        name: sys.name,
      });
    } else {
      result.push({
        id: `google:${accountEmail}::${sys.labelId}`,
        originalId: sys.labelId,
        name: sys.name,
        role: sys.role,
        sortOrder: sys.sortOrder,
        totalEmails: 0,
        unreadEmails: 0,
        totalThreads: 0,
        unreadThreads: 0,
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
          mayRename: false,
          mayDelete: false,
          maySubmit: true,
        },
      });
    }
  }

  // Include any other user labels/categories (filtering out CHAT)
  for (const mb of existing) {
    if (!handled.has(mb.id)) {
      if (!isIgnoredGoogleLabel(mb.originalId) && !isIgnoredGoogleLabel(mb.id) && !isIgnoredGoogleLabel(mb.name)) {
        result.push(mb);
      }
    }
  }

  result.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.name || '').localeCompare(b.name || '');
  });

  return result;
}

export function getGoogleAccountCategories(accountEmail: string, existingMailboxes: Mailbox[]): Mailbox[] {
  const categories: Mailbox[] = [];
  for (const [catId, meta] of Object.entries(GMAIL_CATEGORY_METAS)) {
    const existing = existingMailboxes.find(
      (m) =>
        m.originalId?.toUpperCase() === catId ||
        m.id.toUpperCase().endsWith(`::${catId}`) ||
        m.role === meta.role
    );
    if (existing) {
      categories.push(existing);
    } else {
      categories.push({
        id: `google:${accountEmail}::${catId}`,
        originalId: catId,
        name: meta.displayName,
        role: meta.role,
        sortOrder: meta.sortOrder,
        totalEmails: 0,
        unreadEmails: 0,
        totalThreads: 0,
        unreadThreads: 0,
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
          mayRename: false,
          mayDelete: false,
          maySubmit: true,
        },
      });
    }
  }
  return categories;
}

export function googleLabelToMailbox(label: GmailLabel, accountEmail: string): Mailbox {
  const upperId = label.id.toUpperCase();
  const sysMeta = SYSTEM_LABEL_ROLES[upperId];
  const catMeta = GMAIL_CATEGORY_METAS[upperId];

  const role = sysMeta?.role || catMeta?.role;
  const rawName = sysMeta?.displayName || catMeta?.displayName || label.name;
  const name = cleanGmailStarDisplayName(rawName);
  const sortOrder = sysMeta?.sortOrder ?? catMeta?.sortOrder ?? 10;

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
    const starMatch = matchGmailStar(labelId);
    if (starMatch) {
      keywords['$flagged'] = true;
      keywords[`$star:${starMatch.id}`] = true;
    }
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
