import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import {
  buildMicrosoftAddressBook,
  mapMicrosoftContactToCard,
  mapCardToMicrosoftContact,
} from '@/lib/microsoft/contact-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import {
  MicrosoftGraphContact,
  isMicrosoftAppEnabled,
  resolveMicrosoftAppMode,
  MicrosoftAppMode,
} from '@/lib/microsoft/types';
import type { ContactCard, AddressBook } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const enabledAccounts = accounts.filter((a) => isMicrosoftAppEnabled(a.apps?.contacts));

  if (enabledAccounts.length === 0) {
    const res = NextResponse.json({ addressBooks: [], contacts: [], accounts: [] });
    if (updatedSession) setMicrosoftSessionCookie(res, updatedSession);
    return res;
  }

  const addressBooks: AddressBook[] = [];
  const contacts: ContactCard[] = [];
  const accountGroups: Array<{
    email: string;
    mode: MicrosoftAppMode;
    addressBook: AddressBook;
    contacts: ContactCard[];
  }> = [];

  for (const account of enabledAccounts) {
    try {
      const addressBook = buildMicrosoftAddressBook(account.email, account.name);
      addressBooks.push(addressBook);

      const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/contacts?$top=500`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (!res.ok) {
        logger.error('Failed to fetch Microsoft contacts for account', {
          email: account.email,
          status: res.status,
        });
        continue;
      }

      const data = await res.json();
      const connections: MicrosoftGraphContact[] = data.value || [];
      const accountContacts: ContactCard[] = [];
      for (const person of connections) {
        if (person.id) {
          const card = mapMicrosoftContactToCard(person, account.email);
          contacts.push(card);
          accountContacts.push(card);
        }
      }

      accountGroups.push({
        email: account.email,
        mode: resolveMicrosoftAppMode(account.apps?.contacts),
        addressBook,
        contacts: accountContacts,
      });
    } catch (err) {
      logger.error('Exception fetching Microsoft contacts', { email: account.email, error: err });
    }
  }

  const response = NextResponse.json({ addressBooks, contacts, accounts: accountGroups });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function POST(request: NextRequest) {
  let body: { accountEmail?: string; contact: Partial<ContactCard> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const enabledAccounts = accounts.filter((a) => isMicrosoftAppEnabled(a.apps?.contacts));
  const account = body.accountEmail
    ? enabledAccounts.find((a) => a.email.toLowerCase() === body.accountEmail!.toLowerCase())
    : enabledAccounts[0];

  if (!account) {
    return NextResponse.json({ error: 'Microsoft Contacts account not connected' }, { status: 401 });
  }

  const personBody = mapCardToMicrosoftContact(body.contact);

  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(personBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to create Microsoft contact', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to create Microsoft contact' }, { status: res.status });
  }

  const created: MicrosoftGraphContact = await res.json();
  const mapped = mapMicrosoftContactToCard(created, account.email);

  const response = NextResponse.json({ contact: mapped });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
