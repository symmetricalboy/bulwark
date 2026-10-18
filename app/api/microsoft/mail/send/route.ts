import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { sendOutlookMessage } from '@/lib/microsoft/outlook-api';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let body: {
    accountEmail?: string;
    fromName?: string;
    to?: Array<{ name?: string; email: string }>;
    cc?: Array<{ name?: string; email: string }>;
    bcc?: Array<{ name?: string; email: string }>;
    subject?: string;
    textBody?: string;
    htmlBody?: string;
    attachments?: Array<{ name: string; type: string; base64Content: string }>;
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.accountEmail || !body.to || body.to.length === 0) {
    return NextResponse.json({ error: 'Missing accountEmail or recipients' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === body.accountEmail!.toLowerCase() && a.apps?.outlook === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'Outlook account not found or disabled' }, { status: 404 });
  }

  try {
    const attachments = (body.attachments || []).map((att) => {
      const buf = Buffer.from(att.base64Content, 'base64');
      return {
        name: att.name,
        type: att.type || 'application/octet-stream',
        content: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    });

    await sendOutlookMessage(acc.accessToken, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject || '',
      textBody: body.textBody || '',
      htmlBody: body.htmlBody,
      attachments,
    });

    const generatedId = `microsoft:${acc.email}::sent-${Date.now()}`;
    const response = NextResponse.json({
      success: true,
      id: generatedId,
      threadId: generatedId,
    });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to send email via Outlook API', { email: acc.email, error: err });
    return NextResponse.json({ error: 'Failed to send Outlook email' }, { status: 500 });
  }
}
