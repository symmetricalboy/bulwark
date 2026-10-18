import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { mapMicrosoftContactToCard, mapCardToMicrosoftContact } from '@/lib/microsoft/contact-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { MicrosoftGraphContact, isMicrosoftAppEnabled } from '@/lib/microsoft/types';
import type { ContactCard } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

function parseNamespacedContactId(namespacedId: string): { email: string; contactId: string } | null {
  if (!namespacedId.startsWith('microsoft:')) return null;
  const withoutPrefix = namespacedId.slice('microsoft:'.length);
  const sepIdx = withoutPrefix.indexOf('::');
  if (sepIdx === -1) return null;
  return {
    email: withoutPrefix.slice(0, sepIdx),
    contactId: withoutPrefix.slice(sepIdx + 2),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const decodedId = decodeURIComponent(contactId);
  const parsed = parseNamespacedContactId(decodedId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft contact ID' }, { status: 400 });
  }

  let body: { updates: Partial<ContactCard> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsed.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.contacts)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft Contacts account not connected' }, { status: 401 });
  }

  const personBody = mapCardToMicrosoftContact(body.updates);
  const updateRes = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/contacts/${encodeURIComponent(parsed.contactId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(personBody),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    logger.error('Failed to update Microsoft contact', { status: updateRes.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to update Microsoft contact' },
      { status: updateRes.status }
    );
  }

  const updated: MicrosoftGraphContact = await updateRes.json();
  const mapped = mapMicrosoftContactToCard(updated, account.email);

  const response = NextResponse.json({ contact: mapped });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const decodedId = decodeURIComponent(contactId);
  const parsed = parseNamespacedContactId(decodedId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft contact ID' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsed.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.contacts)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft Contacts account not connected' }, { status: 401 });
  }

  const delRes = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/contacts/${encodeURIComponent(parsed.contactId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${account.accessToken}` },
    }
  );

  if (!delRes.ok && delRes.status !== 404) {
    const errText = await delRes.text();
    logger.error('Failed to delete Microsoft contact', { status: delRes.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to delete Microsoft contact' },
      { status: delRes.status }
    );
  }

  const response = NextResponse.json({ success: true });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
