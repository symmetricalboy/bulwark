import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import { sendGmailMessage } from '@/lib/google/gmail-api';
import { buildMimeMessage, type MimeAttachment } from '@/lib/smime/mime-builder';
import { parseRecipient } from '@/lib/email-composer-utils';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export interface SendGoogleMailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
  cid?: string;
}

export interface SendGoogleMailBody {
  googleAccountId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body?: string;
  htmlBody?: string;
  fromName?: string;
  fromEmail?: string;
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
  attachments?: SendGoogleMailAttachment[];
  raw?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SendGoogleMailBody;
    const {
      googleAccountId,
      to,
      cc,
      bcc,
      subject,
      body,
      htmlBody,
      fromName,
      fromEmail,
      inReplyTo,
      references,
      threadId,
      attachments,
      raw,
    } = payload;

    const accountLookup = googleAccountId || fromEmail || undefined;

    const session = await getGoogleSession(request, {
      accountId: accountLookup,
      app: 'gmail',
    });

    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    let rawMimeBase64Url: string;

    if (raw) {
      rawMimeBase64Url = raw;
    } else {
      const resolvedFromEmail = fromEmail || session.account?.email || session.tokens.email || '';
      const resolvedFromName = fromName || session.account?.name || session.tokens.name || undefined;

      const toRecipients = (to || []).map(parseRecipient).filter((r) => Boolean(r.email)) as { name?: string; email: string }[];
      const ccRecipients = (cc || []).map(parseRecipient).filter((r) => Boolean(r.email)) as { name?: string; email: string }[];
      const bccRecipients = (bcc || []).map(parseRecipient).filter((r) => Boolean(r.email)) as { name?: string; email: string }[];

      const mimeAttachments: MimeAttachment[] = (attachments || []).map((att) => {
        const buffer = Buffer.from(att.contentBase64, 'base64');
        return {
          filename: att.filename,
          contentType: att.contentType || 'application/octet-stream',
          content: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
          cid: att.cid,
        };
      });

      const mimeBytes = buildMimeMessage({
        from: { name: resolvedFromName, email: resolvedFromEmail },
        to: toRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject: subject || '',
        textBody: body,
        htmlBody,
        inReplyTo,
        references,
        attachments: mimeAttachments.length > 0 ? mimeAttachments : undefined,
      });

      rawMimeBase64Url = Buffer.from(mimeBytes).toString('base64url');
    }

    const sentMessage = await sendGmailMessage(session.accessToken, rawMimeBase64Url, threadId);

    const response = NextResponse.json({
      success: true,
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
    });

    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Failed to send Google mail message', { err });
    const message = err instanceof Error ? err.message : 'Failed to send message via Google';
    return NextResponse.json({ error: 'google_send_failed', message }, { status: 502 });
  }
}
