import type { ContactCard, AddressBook } from '@/lib/jmap/types';
import { getComailAccountHeaders } from './comail-headers';

export {
  getGoogleStatus,
  disconnectGoogle,
  type GoogleAccountStatus,
} from './google-calendar-client';

export interface GoogleContactsResponse {
  contacts: ContactCard[];
  addressBook: AddressBook;
  total: number;
}

export async function fetchGoogleContacts(): Promise<GoogleContactsResponse> {
  const res = await fetch('/api/google/contacts', {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google contacts (${res.status})`);
  }
  const data = await res.json();
  return {
    contacts: data.contacts || [],
    addressBook: data.addressBook,
    total: data.total || 0,
  };
}

export async function createGoogleContact(contact: Partial<ContactCard>): Promise<ContactCard> {
  const res = await fetch('/api/google/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getComailAccountHeaders(),
    },
    body: JSON.stringify({ contact }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Google contact (${res.status})`);
  }
  const data = await res.json();
  return data.contact;
}

export async function updateGoogleContact(
  contactId: string,
  updates: Partial<ContactCard>,
): Promise<ContactCard> {
  const cleanId = contactId.includes('::') ? contactId.split('::')[1] : contactId;
  const res = await fetch(`/api/google/contacts/${encodeURIComponent(cleanId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getComailAccountHeaders(),
    },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update Google contact (${res.status})`);
  }
  const data = await res.json();
  return data.contact;
}

export async function deleteGoogleContact(contactId: string): Promise<void> {
  const cleanId = contactId.includes('::') ? contactId.split('::')[1] : contactId;
  const res = await fetch(`/api/google/contacts/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete Google contact (${res.status})`);
  }
}
