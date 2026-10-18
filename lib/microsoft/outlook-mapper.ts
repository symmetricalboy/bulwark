import type { Email, EmailAddress, EmailBodyPart, EmailBodyValue, Mailbox } from '@/lib/jmap/types';
import type { OutlookFolder, OutlookMessage, OutlookRecipient } from './outlook-api';

const WELL_KNOWN_FOLDER_MAP: Record<string, { role: Mailbox['role']; sortOrder: number }> = {
  inbox: { role: 'inbox', sortOrder: 1 },
  'sent items': { role: 'sent', sortOrder: 3 },
  sentitems: { role: 'sent', sortOrder: 3 },
  drafts: { role: 'drafts', sortOrder: 4 },
  archive: { role: 'archive', sortOrder: 5 },
  'junk email': { role: 'junk', sortOrder: 6 },
  junkemail: { role: 'junk', sortOrder: 6 },
  'deleted items': { role: 'trash', sortOrder: 7 },
  deleteditems: { role: 'trash', sortOrder: 7 },
};

export function mapOutlookFolderToMailbox(
  accountEmail: string,
  folder: OutlookFolder,
  index: number
): Mailbox | null {
  if (folder.isHidden) return null;
  const normalizedName = (folder.displayName || '').trim().toLowerCase();
  // Skip system internal folders
  if (
    normalizedName === 'outbox' ||
    normalizedName === 'conversation history' ||
    normalizedName === 'sync issues' ||
    normalizedName === 'rss feeds'
  ) {
    return null;
  }

  const mapped = WELL_KNOWN_FOLDER_MAP[normalizedName];
  const accountId = `microsoft:${accountEmail}`;

  return {
    id: `microsoft:${accountEmail}::${folder.id}`,
    name: folder.displayName,
    parentId: folder.parentFolderId ? `microsoft:${accountEmail}::${folder.parentFolderId}` : undefined,
    role: mapped?.role,
    sortOrder: mapped ? mapped.sortOrder : 100 + index,
    totalEmails: folder.totalItemCount || 0,
    unreadEmails: folder.unreadItemCount || 0,
    totalThreads: folder.totalItemCount || 0,
    unreadThreads: folder.unreadItemCount || 0,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: !mapped,
      mayDelete: !mapped,
      maySubmit: true,
    },
    isSubscribed: true,
    accountId,
    accountName: accountEmail,
  };
}

export function buildVirtualOutlookMailboxes(accountEmail: string): Mailbox[] {
  const accountId = `microsoft:${accountEmail}`;
  const defaultRights = {
    mayReadItems: true,
    mayAddItems: true,
    mayRemoveItems: true,
    maySetSeen: true,
    maySetKeywords: true,
    mayCreateChild: false,
    mayRename: false,
    mayDelete: false,
    maySubmit: true,
  };
  return [
    {
      id: `microsoft:${accountEmail}::FLAGGED`,
      name: 'Flagged',
      role: 'important',
      sortOrder: 2,
      totalEmails: 0,
      unreadEmails: 0,
      totalThreads: 0,
      unreadThreads: 0,
      myRights: defaultRights,
      isSubscribed: true,
      accountId,
      accountName: accountEmail,
    },
    {
      id: `microsoft:${accountEmail}::ALL_MAIL`,
      name: 'All Mail',
      role: 'all',
      sortOrder: 5,
      totalEmails: 0,
      unreadEmails: 0,
      totalThreads: 0,
      unreadThreads: 0,
      myRights: defaultRights,
      isSubscribed: true,
      accountId,
      accountName: accountEmail,
    },
  ];
}

function mapRecipients(recipients?: OutlookRecipient[]): EmailAddress[] {
  if (!recipients || !Array.isArray(recipients)) return [];
  return recipients
    .map((r) => {
      const email = r.emailAddress?.address || '';
      if (!email) return null;
      return {
        name: r.emailAddress?.name || undefined,
        email,
      };
    })
    .filter(Boolean) as EmailAddress[];
}

export function mapOutlookMessageToEmail(accountEmail: string, msg: OutlookMessage): Email {
  const namespacedId = `microsoft:${accountEmail}::${msg.id}`;
  const mailboxIds: Record<string, boolean> = {};
  if (msg.parentFolderId) {
    mailboxIds[`microsoft:${accountEmail}::${msg.parentFolderId}`] = true;
  }
  mailboxIds[`microsoft:${accountEmail}::ALL_MAIL`] = true;

  const keywords: Record<string, boolean> = {};
  if (msg.isRead) {
    keywords['$seen'] = true;
  }
  if (msg.flag?.flagStatus === 'flagged') {
    keywords['$flagged'] = true;
    mailboxIds[`microsoft:${accountEmail}::FLAGGED`] = true;
  }
  if (msg.isDraft) {
    keywords['$draft'] = true;
  }

  const from = msg.from
    ? mapRecipients([msg.from])
    : msg.sender
    ? mapRecipients([msg.sender])
    : [{ email: accountEmail }];

  const bodyValues: Record<string, EmailBodyValue> = {};
  const textBody: EmailBodyPart[] = [];
  const htmlBody: EmailBodyPart[] = [];

  if (msg.body?.content) {
    const isHtml = (msg.body.contentType || '').toLowerCase() === 'html';
    bodyValues['body-1'] = {
      value: msg.body.content,
      isEncodingProblem: false,
      isTruncated: false,
    };
    if (isHtml) {
      htmlBody.push({ partId: 'body-1', blobId: `${namespacedId}::body-1`, type: 'text/html', size: msg.body.content.length });
    } else {
      textBody.push({ partId: 'body-1', blobId: `${namespacedId}::body-1`, type: 'text/plain', size: msg.body.content.length });
    }
  } else if (msg.bodyPreview) {
    bodyValues['preview'] = {
      value: msg.bodyPreview,
      isEncodingProblem: false,
      isTruncated: false,
    };
    textBody.push({ partId: 'preview', blobId: `${namespacedId}::preview`, type: 'text/plain', size: msg.bodyPreview.length });
  }

  const attachments: EmailBodyPart[] = (msg.attachments || []).map((att) => ({
    partId: att.id,
    blobId: `${namespacedId}::${att.id}`,
    size: att.size || 0,
    name: att.name || 'attachment',
    type: att.contentType || 'application/octet-stream',
    disposition: att.isInline ? 'inline' : 'attachment',
    cid: att.contentId,
  }));

  const receivedAt = msg.receivedDateTime || msg.sentDateTime || new Date().toISOString();

  return {
    id: namespacedId,
    blobId: namespacedId,
    threadId: msg.conversationId ? `microsoft:${accountEmail}::${msg.conversationId}` : namespacedId,
    mailboxIds,
    keywords,
    size: msg.body?.content?.length || 0,
    receivedAt,
    sentAt: msg.sentDateTime || receivedAt,
    messageId: msg.internetMessageId || undefined,
    from,
    to: mapRecipients(msg.toRecipients),
    cc: mapRecipients(msg.ccRecipients),
    bcc: mapRecipients(msg.bccRecipients),
    replyTo: mapRecipients(msg.replyTo),
    subject: msg.subject || '(No Subject)',
    textBody: textBody.length > 0 ? textBody : undefined,
    htmlBody: htmlBody.length > 0 ? htmlBody : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    bodyValues: Object.keys(bodyValues).length > 0 ? bodyValues : undefined,
    preview: msg.bodyPreview || '',
    hasAttachment: Boolean(msg.hasAttachments || attachments.length > 0),
    accountId: `microsoft:${accountEmail}`,
  };
}
