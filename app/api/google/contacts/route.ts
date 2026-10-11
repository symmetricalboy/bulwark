import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import {
  googlePersonToContactCard,
  contactCardToGooglePerson,
  createGoogleAddressBook,
  type GoogleConnectionsResponse,
} from '@/lib/google/contact-mapper';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const accountEmail = session.tokens.email || 'google';
    const allPersons: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const url = new URL('https://people.googleapis.com/v1/people/me/connections');
      url.searchParams.set(
        'personFields',
        'names,emailAddresses,phoneNumbers,photos,organizations,addresses,biographies,birthdays,urls',
      );
      url.searchParams.set('pageSize', '1000');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });

      if (!res.ok) {
        logger.error('Failed to list Google contacts', { status: res.status });
        return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
      }

      const data = (await res.json()) as GoogleConnectionsResponse;
      if (data.connections) {
        allPersons.push(...data.connections);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    const contacts = allPersons.map((p) => googlePersonToContactCard(p, accountEmail));
    const addressBook = createGoogleAddressBook(accountEmail);

    const response = NextResponse.json({
      contacts,
      addressBook,
      total: contacts.length,
    });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google contacts', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const contactData = body.contact || {};
    const googlePerson = contactCardToGooglePerson(contactData);
    const accountEmail = session.tokens.email || 'google';

    const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googlePerson),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to create Google contact', { status: res.status, errText });
      return NextResponse.json({ error: 'google_api_error', detail: errText }, { status: 502 });
    }

    const createdPerson = await res.json();
    const contact = googlePersonToContactCard(createdPerson, accountEmail);

    const response = NextResponse.json({ contact });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google contact', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
