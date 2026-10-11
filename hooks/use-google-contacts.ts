"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ContactCard, AddressBook } from '@/lib/jmap/types';
import {
  getGoogleStatus,
  fetchGoogleContacts,
  createGoogleContact as createGoogleContactApi,
  updateGoogleContact as updateGoogleContactApi,
  deleteGoogleContact as deleteGoogleContactApi,
  type GoogleAccountStatus,
} from '@/lib/google/google-contacts-client';
import { setClientLookup, getClientByLocalAccountId } from '@/stores/client-registry';
import { useContactStore } from '@/stores/contact-store';
import type { IJMAPClient } from '@/lib/jmap/client-interface';

export function useGoogleContacts() {
  const [status, setStatus] = useState<GoogleAccountStatus>({ configured: false, connected: false });
  const [contacts, setContacts] = useState<ContactCard[]>([]);
  const [addressBook, setAddressBook] = useState<AddressBook | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkStatus = useCallback(async () => {
    try {
      const currentStatus = await getGoogleStatus();
      setStatus(currentStatus);
      return currentStatus;
    } catch {
      return { configured: false, connected: false };
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchGoogleContacts();
      setContacts(res.contacts);
      setAddressBook(res.addressBook);

      // Merge Google Address Book and contacts into contact store so they are visible, searchable, and grouped
      useContactStore.setState((state) => {
        const nonGoogleBooks = state.addressBooks.filter((b) => !b.id.startsWith('google:'));
        const nonGoogleContacts = state.contacts.filter((c) => !c.id.startsWith('google:'));

        return {
          addressBooks: res.addressBook ? [...nonGoogleBooks, res.addressBook] : nonGoogleBooks,
          contacts: [...nonGoogleContacts, ...res.contacts],
        };
      });

      return res;
    } catch (err) {
      console.error('Failed to load Google contacts:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus().then((s) => {
      if (s.connected) {
        void loadContacts();
      }
    });
  }, [checkStatus, loadContacts]);

  // Register Google pseudo-client in client-registry so contact store mutations
  // routed by localAccountId (google:<email>) invoke our Google API routes.
  useEffect(() => {
    if (!status.connected || !status.email) return;

    const googleLocalAccountId = `google:${status.email}`;
    const previousLookup = getClientByLocalAccountId;

    const googleClient = {
      getAccountId: () => googleLocalAccountId,
      getUsername: () => status.email || 'google',
      getServerUrl: () => 'https://www.googleapis.com',
      getAuthHeader: () => '',
      supportsContacts: () => true,
      createContact: async (contact: Partial<ContactCard>) => {
        return createGoogleContactApi(contact);
      },
      updateContact: async (contactId: string, updates: Partial<ContactCard>) => {
        return updateGoogleContactApi(contactId, updates);
      },
      deleteContact: async (contactId: string) => {
        return deleteGoogleContactApi(contactId);
      },
    } as unknown as IJMAPClient;

    setClientLookup((localAccountId: string) => {
      if (localAccountId === googleLocalAccountId) {
        return googleClient;
      }
      return previousLookup(localAccountId);
    });
  }, [status.connected, status.email]);

  const connectGoogle = useCallback((returnToUrl = '/contacts?import=google') => {
    window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnToUrl)}`;
  }, []);

  return {
    status,
    contacts,
    addressBook,
    isLoading,
    connectGoogle,
    loadContacts,
    checkStatus,
  };
}
