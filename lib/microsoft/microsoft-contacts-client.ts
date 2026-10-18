import type { ContactCard, AddressBook } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';
import type { GoogleAppMode } from '@/lib/google/types';

export interface MicrosoftAccountContactsGroup {
  email: string;
  mode: GoogleAppMode;
  addressBook: AddressBook;
  contacts: ContactCard[];
}

export class MicrosoftContactsClient {
  async getContactsAndBooks(): Promise<{
    addressBooks: AddressBook[];
    contacts: ContactCard[];
    accounts: MicrosoftAccountContactsGroup[];
  }> {
    try {
      const res = await fetch('/api/microsoft/contacts');
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          return { addressBooks: [], contacts: [], accounts: [] };
        }
        throw new Error(`Failed to fetch Microsoft contacts: ${res.status}`);
      }
      const data = await res.json();
      return {
        addressBooks: data.addressBooks || [],
        contacts: data.contacts || [],
        accounts: data.accounts || [],
      };
    } catch (err) {
      logger.error('Error in MicrosoftContactsClient.getContactsAndBooks', { error: err });
      return { addressBooks: [], contacts: [], accounts: [] };
    }
  }

  async createContact(accountEmail: string, contact: Partial<ContactCard>): Promise<ContactCard> {
    const res = await fetch('/api/microsoft/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail, contact }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create Microsoft contact: ${res.status}`);
    }
    const data = await res.json();
    return data.contact;
  }

  async updateContact(namespacedContactId: string, updates: Partial<ContactCard>): Promise<ContactCard> {
    const encodedId = encodeURIComponent(namespacedContactId);
    const res = await fetch(`/api/microsoft/contacts/${encodedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update Microsoft contact: ${res.status}`);
    }
    const data = await res.json();
    return data.contact;
  }

  async deleteContact(namespacedContactId: string): Promise<void> {
    const encodedId = encodeURIComponent(namespacedContactId);
    const res = await fetch(`/api/microsoft/contacts/${encodedId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete Microsoft contact: ${res.status}`);
    }
  }
}

export const microsoftContactsClient = new MicrosoftContactsClient();
