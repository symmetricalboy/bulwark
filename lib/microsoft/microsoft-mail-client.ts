import type { Email, Mailbox } from '@/lib/jmap/types';

export interface MicrosoftMailAccountInfo {
  id: string;
  email: string;
  name?: string;
}

export async function fetchMicrosoftMailFoldersClient(): Promise<{
  mailboxes: Mailbox[];
  accounts: MicrosoftMailAccountInfo[];
}> {
  const res = await fetch('/api/microsoft/mail/folders');
  if (!res.ok) {
    throw new Error('Failed to fetch Microsoft mail folders');
  }
  return res.json();
}

export async function createMicrosoftFolderClient(accountEmail: string, name: string): Promise<Mailbox> {
  const res = await fetch('/api/microsoft/mail/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountEmail, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create Outlook folder');
  }
  const data = await res.json();
  return data.mailbox;
}

export async function fetchMicrosoftMessagesClient(params: {
  mailboxId?: string;
  accountEmail?: string;
  q?: string;
  pageToken?: string;
  maxResults?: number;
}): Promise<{ emails: Email[]; nextPageToken?: string; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.mailboxId) searchParams.set('mailboxId', params.mailboxId);
  if (params.accountEmail) searchParams.set('accountEmail', params.accountEmail);
  if (params.q) searchParams.set('q', params.q);
  if (params.pageToken) searchParams.set('pageToken', params.pageToken);
  if (params.maxResults) searchParams.set('maxResults', String(params.maxResults));

  const res = await fetch(`/api/microsoft/mail/messages?${searchParams.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch Microsoft messages');
  }
  return res.json();
}

export async function fetchMicrosoftEmailDetailClient(namespacedMessageId: string): Promise<Email> {
  const res = await fetch(`/api/microsoft/mail/messages/${encodeURIComponent(namespacedMessageId)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch Microsoft email detail');
  }
  const data = await res.json();
  return data.email;
}

export async function updateMicrosoftEmailClient(
  namespacedMessageId: string,
  updates: {
    markRead?: boolean;
    flagged?: boolean;
    trash?: boolean;
  }
): Promise<Email> {
  const res = await fetch(`/api/microsoft/mail/messages/${encodeURIComponent(namespacedMessageId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error('Failed to update Microsoft email');
  }
  const data = await res.json();
  return data.email;
}

export async function deleteMicrosoftEmailClient(
  namespacedMessageId: string,
  permanent = false
): Promise<void> {
  const res = await fetch(
    `/api/microsoft/mail/messages/${encodeURIComponent(namespacedMessageId)}?permanent=${permanent ? 'true' : 'false'}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    throw new Error('Failed to delete Microsoft email');
  }
}

import { useIdentityStore } from '@/stores/identity-store';

export async function sendMicrosoftEmailClient(params: {
  accountEmail: string;
  fromName?: string;
  to: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  bcc?: Array<{ name?: string; email: string }>;
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: Array<
    | { blobId: string; name: string; type: string; size: number; file?: File }
    | { filename: string; contentType: string; contentBase64: string }
  >;
}): Promise<{ id: string; threadId: string }> {
  const encodedAttachments: Array<{ name: string; type: string; base64Content: string }> = [];
  if (params.attachments) {
    for (const att of params.attachments) {
      if ('contentBase64' in att) {
        encodedAttachments.push({
          name: att.filename,
          type: att.contentType || 'application/octet-stream',
          base64Content: att.contentBase64,
        });
      } else if (att.file) {
        const buffer = await att.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        encodedAttachments.push({
          name: att.name,
          type: att.type || 'application/octet-stream',
          base64Content: btoa(binary),
        });
      }
    }
  }

  const res = await fetch('/api/microsoft/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountEmail: params.accountEmail,
      fromName: params.fromName,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      textBody: params.textBody,
      htmlBody: params.htmlBody,
      attachments: encodedAttachments,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send Microsoft email');
  }
  return res.json();
}

export function isMicrosoftSender(fromEmail?: string, localAccountId?: string, identityId?: string): boolean {
  if (localAccountId?.startsWith('microsoft')) return true;
  if (identityId?.startsWith('microsoft')) return true;
  if (!fromEmail) return false;

  const store = useIdentityStore.getState();
  const microsoftIdentities = (store.identities || []).filter((m) => m.id.startsWith('microsoft-default:'));
  if (microsoftIdentities.some((m) => m.email.toLowerCase() === fromEmail.toLowerCase())) {
    return true;
  }
  return false;
}

