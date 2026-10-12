import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, getAllGoogleSessions, attachRefreshedTokens } from '@/lib/google/session';
import {
  googlePersonToContactCard,
  contactCardToGooglePerson,
  createGoogleAddressBook,
  type GoogleConnectionsResponse,
} from '@/lib/google/contact-mapper';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function fetchContactsForSession(accessToken: string): Promise<any[]> {
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
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      logger.error('Failed to list Google contacts', { status: res.status });
      break;
    }

    const data = (await res.json()) as GoogleConnectionsResponse;
    if (data.connections) {
      allPersons.push(...data.connections);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allPersons;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedAccountId = searchParams.get('googleAccountId');

  if (requestedAccountId) {
    const session = await getGoogleSession(request, { accountId: requestedAccountId, app: 'contacts' });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }
    try {
      const accountEmail = session.tokens.email || session.account?.email || 'google';
      const allPersons = await fetchContactsForSession(session.accessToken);
      const contacts = allPersons.map((p) => googlePersonToContactCard(p, accountEmail));
      const addressBook = createGoogleAddressBook(accountEmail);

      const response = NextResponse.json({
        contacts,
        addressBooks: [addressBook],
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

  const allSessions = await getAllGoogleSessions(request, { app: 'contacts' });
  if (!allSessions || allSessions.sessions.length === 0) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const addressBooks: ReturnType<typeof createGoogleAddressBook>[] = [];
    const allContacts: any[] = [];

    await Promise.all(
      allSessions.sessions.map(async (sess) => {
        try {
          const accountEmail = sess.tokens.email || sess.account?.email || 'google';
          addressBooks.push(createGoogleAddressBook(accountEmail));
          const persons = await fetchContactsForSession(sess.accessToken);
          const mapped = persons.map((p) => googlePersonToContactCard(p, accountEmail));
          allContacts.push(...mapped);
        } catch (err) {
          logger.warn('Failed to fetch contacts for session', { err });
        }
      })
    );

    const response = NextResponse.json({
      contacts: allContacts,
      addressBooks,
      addressBook: addressBooks[0],
      total: allContacts.length,
    });
    attachRefreshedTokens(response, allSessions);
    return response;
  } catch (err) {
    logger.error('Exception fetching all Google contacts', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contactData = body.contact || {};
    const requestedAccountId = body.addressBookId || body.googleAccountId || contactData.localAccountId;

    const session = await getGoogleSession(request, {
      accountId: requestedAccountId,
      app: 'contacts',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

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
