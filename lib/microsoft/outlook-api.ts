import { MICROSOFT_GRAPH_BASE } from './auth';

export interface OutlookFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount?: number;
  unreadItemCount?: number;
  totalItemCount?: number;
  isHidden?: boolean;
  wellKnownName?: string;
}

export interface OutlookRecipient {
  emailAddress?: {
    name?: string;
    address?: string;
  };
}

export interface OutlookAttachment {
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  contentId?: string;
  contentBytes?: string;
}

export interface OutlookMessage {
  id: string;
  conversationId?: string;
  parentFolderId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType?: 'text' | 'html';
    content?: string;
  };
  from?: OutlookRecipient;
  sender?: OutlookRecipient;
  toRecipients?: OutlookRecipient[];
  ccRecipients?: OutlookRecipient[];
  bccRecipients?: OutlookRecipient[];
  replyTo?: OutlookRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  importance?: 'low' | 'normal' | 'high';
  flag?: {
    flagStatus?: 'notFlagged' | 'complete' | 'flagged';
  };
  categories?: string[];
  internetMessageId?: string;
  attachments?: OutlookAttachment[];
}

export async function fetchOutlookFolders(accessToken: string): Promise<OutlookFolder[]> {
  const res = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/mailFolders?$top=100&$select=id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount,isHidden`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Outlook folders: ${res.status}`);
  }
  const data = await res.json();
  return (data.value || []) as OutlookFolder[];
}

export async function createOutlookFolder(accessToken: string, displayName: string): Promise<OutlookFolder> {
  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/mailFolders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Outlook folder: ${res.status}`);
  }
  return (await res.json()) as OutlookFolder;
}

export async function listOutlookMessages(
  accessToken: string,
  options: {
    folderId?: string;
    query?: string;
    filter?: string;
    top?: number;
    skip?: number;
  }
): Promise<{ messages: OutlookMessage[]; nextSkip?: number; totalEstimate?: number }> {
  const top = options.top || 30;
  const skip = options.skip || 0;
  const params = new URLSearchParams({
    $top: String(top),
    $skip: String(skip),
    $count: 'true',
    $select:
      'id,conversationId,parentFolderId,subject,bodyPreview,from,sender,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,importance,flag,categories,internetMessageId',
  });

  if (options.query) {
    params.set('$search', `"${options.query.replace(/"/g, '')}"`);
  } else {
    params.set('$orderby', 'receivedDateTime desc');
    if (options.filter) {
      params.set('$filter', options.filter);
    }
  }

  const endpoint =
    options.folderId && options.folderId !== 'ALL_MAIL'
      ? `${MICROSOFT_GRAPH_BASE}/me/mailFolders/${encodeURIComponent(options.folderId)}/messages`
      : `${MICROSOFT_GRAPH_BASE}/me/messages`;

  const res = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: 'eventual',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list Outlook messages: ${res.status}`);
  }

  const data = await res.json();
  const messages = (data.value || []) as OutlookMessage[];
  const hasNext = Boolean(data['@odata.nextLink']);
  return {
    messages,
    nextSkip: hasNext ? skip + messages.length : undefined,
    totalEstimate: typeof data['@odata.count'] === 'number' ? data['@odata.count'] : messages.length,
  };
}

export async function fetchOutlookMessage(accessToken: string, messageId: string): Promise<OutlookMessage> {
  const res = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}?$expand=attachments($select=id,name,contentType,size,isInline,contentId)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Outlook message ${messageId}: ${res.status}`);
  }
  return (await res.json()) as OutlookMessage;
}

export async function updateOutlookMessage(
  accessToken: string,
  messageId: string,
  updates: {
    isRead?: boolean;
    flagged?: boolean;
    categories?: string[];
  }
): Promise<OutlookMessage> {
  const body: Record<string, unknown> = {};
  if (updates.isRead !== undefined) {
    body.isRead = updates.isRead;
  }
  if (updates.flagged !== undefined) {
    body.flag = {
      flagStatus: updates.flagged ? 'flagged' : 'notFlagged',
    };
  }
  if (updates.categories !== undefined) {
    body.categories = updates.categories;
  }

  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to update Outlook message: ${res.status}`);
  }
  return (await res.json()) as OutlookMessage;
}

export async function moveOutlookMessage(
  accessToken: string,
  messageId: string,
  destinationId: string
): Promise<OutlookMessage> {
  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}/move`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to move Outlook message: ${res.status}`);
  }
  return (await res.json()) as OutlookMessage;
}

export async function deleteOutlookMessage(accessToken: string, messageId: string): Promise<void> {
  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to delete Outlook message: ${res.status}`);
  }
}

export async function sendOutlookMessage(
  accessToken: string,
  params: {
    to: Array<{ name?: string; email: string }>;
    cc?: Array<{ name?: string; email: string }>;
    bcc?: Array<{ name?: string; email: string }>;
    subject: string;
    textBody: string;
    htmlBody?: string;
    attachments?: Array<{ name: string; type: string; content: ArrayBuffer }>;
  }
): Promise<void> {
  const toRecipients = params.to.map((r) => ({
    emailAddress: { address: r.email, ...(r.name ? { name: r.name } : {}) },
  }));
  const ccRecipients = (params.cc || []).map((r) => ({
    emailAddress: { address: r.email, ...(r.name ? { name: r.name } : {}) },
  }));
  const bccRecipients = (params.bcc || []).map((r) => ({
    emailAddress: { address: r.email, ...(r.name ? { name: r.name } : {}) },
  }));

  const attachments = (params.attachments || []).map((att) => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: att.name,
    contentType: att.type || 'application/octet-stream',
    contentBytes: Buffer.from(att.content).toString('base64'),
  }));

  const message: Record<string, unknown> = {
    subject: params.subject,
    body: {
      contentType: params.htmlBody ? 'HTML' : 'Text',
      content: params.htmlBody || params.textBody,
    },
    toRecipients,
    ...(ccRecipients.length > 0 ? { ccRecipients } : {}),
    ...(bccRecipients.length > 0 ? { bccRecipients } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
  };

  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to send Outlook message (${res.status}): ${errText}`);
  }
}
