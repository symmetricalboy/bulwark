import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import {
  googlePersonToContactCard,
  contactCardToGooglePerson,
} from '@/lib/google/contact-mapper';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function cleanResourceName(contactId: string): string {
  let id = decodeURIComponent(contactId);
  if (id.includes('::')) {
    id = id.split('::')[1];
  }
  if (!id.startsWith('people/')) {
    id = `people/${id}`;
  }
  return id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const { contactId } = await params;
    const resourceName = cleanResourceName(contactId);
    const body = await request.json();
    const updates = body.updates || {};
    const accountEmail = session.tokens.email || 'google';

    // 1. Fetch current person to get valid etag
    const getRes = await fetch(
      `https://people.googleapis.com/v1/${encodeURIComponent(resourceName).replace('%2F', '/')}?personFields=names`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      },
    );

    let etag: string | undefined;
    if (getRes.ok) {
      const current = await getRes.json();
      etag = current.etag;
    }

    const patchPayload = contactCardToGooglePerson(updates, etag);

    const updateFields = [
      'names',
      'emailAddresses',
      'phoneNumbers',
      'organizations',
      'addresses',
      'biographies',
      'urls',
    ].join(',');

    const res = await fetch(
      `https://people.googleapis.com/v1/${encodeURIComponent(resourceName).replace('%2F', '/')}:updateContact?updatePersonFields=${updateFields}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchPayload),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to update Google contact', { status: res.status, errText, resourceName });
      return NextResponse.json({ error: 'google_api_error', detail: errText }, { status: 502 });
    }

    const updatedPerson = await res.json();
    const contact = googlePersonToContactCard(updatedPerson, accountEmail);

    const response = NextResponse.json({ contact });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception updating Google contact', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const { contactId } = await params;
    const resourceName = cleanResourceName(contactId);

    const res = await fetch(
      `https://people.googleapis.com/v1/${encodeURIComponent(resourceName).replace('%2F', '/')}:deleteContact`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to delete Google contact', { status: res.status, errText, resourceName });
      return NextResponse.json({ error: 'google_api_error', detail: errText }, { status: 502 });
    }

    const response = NextResponse.json({ success: true });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception deleting Google contact', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
