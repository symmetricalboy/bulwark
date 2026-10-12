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
import { normalizeAppMode, type LinkedGoogleAccountPublic } from '@/lib/google/types';
import { reconcileContacts } from '@/lib/google/sync-engine';
import type { IJMAPClient } from '@/lib/jmap/client-interface';

export function useGoogleContacts() {
  const [status, setStatus] = useState<GoogleAccountStatus>({ configured: false, connected: false });
  const [contacts, setContacts] = useState<ContactCard[]>([]);
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([]);
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
      const currentStatus: GoogleAccountStatus = await getGoogleStatus().catch(() => ({ configured: false, connected: false }));
      setStatus(currentStatus);

      const accounts: LinkedGoogleAccountPublic[] = currentStatus.accounts || [];
      const res = await fetchGoogleContacts();
      const allFetchedContacts = res.contacts || [];
      const allFetchedBooks = res.addressBooks && res.addressBooks.length > 0 ? res.addressBooks : (res.addressBook ? [res.addressBook] : []);

      // Separate accounts vs sync accounts vs disabled
      const separateBooks: AddressBook[] = [];
      const separateContacts: ContactCard[] = [];
      const syncAccounts = accounts.filter((a: LinkedGoogleAccountPublic) => normalizeAppMode(a.enabledApps?.contacts) === 'sync');

      for (const book of allFetchedBooks) {
        const bookEmail = book.accountName || (book.id.startsWith('google:') ? book.id.split('::')[0].replace(/^google:/, '') : undefined);
        const matchingAccount = accounts.find((a: LinkedGoogleAccountPublic) => a.email.toLowerCase() === bookEmail?.toLowerCase());
        const mode = matchingAccount ? normalizeAppMode(matchingAccount.enabledApps?.contacts) : 'separate';

        if (mode === 'separate') {
          separateBooks.push(book);
        }
      }

      const syncContactsByAccount = new Map<string, ContactCard[]>();

      for (const contact of allFetchedContacts) {
        const contactEmail = contact.localAccountId?.startsWith('google:') ? contact.localAccountId.replace(/^google:/, '') : undefined;
        const matchingAccount = accounts.find((a: LinkedGoogleAccountPublic) => a.email.toLowerCase() === contactEmail?.toLowerCase());
        const mode = matchingAccount ? normalizeAppMode(matchingAccount.enabledApps?.contacts) : 'separate';

        if (mode === 'separate') {
          separateContacts.push(contact);
        } else if (mode === 'sync' && contactEmail) {
          const list = syncContactsByAccount.get(contactEmail) || [];
          list.push(contact);
          syncContactsByAccount.set(contactEmail, list);
        }
      }

      setAddressBooks(separateBooks);
      setAddressBook(separateBooks[0] || null);
      setContacts([...separateContacts]);

      // Update useContactStore
      useContactStore.setState((state) => {
        const nonGoogleBooks = state.addressBooks.filter((b) => !b.id.startsWith('google:') && !b.localAccountId?.startsWith('google:'));
        const defaultBook = nonGoogleBooks.find((b) => b.isDefault) || nonGoogleBooks[0];
        const defaultBookId = defaultBook?.id || 'default-contacts';

        let runningContacts = state.contacts.filter((c) => !c.id.startsWith('google:') && !c.localAccountId?.startsWith('google:'));

        // Reconcile each sync-enabled account's contacts into the default Comail address book
        for (const [accEmail, incContacts] of syncContactsByAccount.entries()) {
          const syncResult = reconcileContacts({
            accountEmail: accEmail,
            incomingContacts: incContacts,
            defaultAddressBookId: defaultBookId,
            currentContacts: runningContacts,
            otherSyncAccounts: syncAccounts,
            onPushToGoogle: async (email, c) => {
              try {
                await updateGoogleContactApi(c.id, {
                  name: c.name,
                  emails: c.emails,
                  phones: c.phones,
                  addresses: c.addresses,
                });
              } catch (err) {
                console.error(`Failed to propagate contact to Google account ${email}:`, err);
              }
            },
          });
          runningContacts = syncResult.merged;
        }

        return {
          addressBooks: [...nonGoogleBooks, ...separateBooks],
          contacts: [...runningContacts, ...separateContacts],
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

    const handleUpdated = () => {
      void loadContacts();
    };
    window.addEventListener('google-services-updated', handleUpdated);
    return () => window.removeEventListener('google-services-updated', handleUpdated);
  }, [checkStatus, loadContacts]);

  // Register Google pseudo-clients in client-registry so contact store mutations
  // routed by localAccountId (google:<email>) invoke our Google API routes.
  useEffect(() => {
    if (!status.connected) return;

    const emails = new Set<string>();
    if (status.email) emails.add(status.email);
    (status.accounts || []).forEach((a) => {
      if (a.email) emails.add(a.email);
    });
    contacts.forEach((c) => {
      if (c.localAccountId?.startsWith('google:')) {
        emails.add(c.localAccountId.replace(/^google:/, ''));
      }
    });
    addressBooks.forEach((b) => {
      if (b.localAccountId?.startsWith('google:')) {
        emails.add(b.localAccountId.replace(/^google:/, ''));
      }
    });

    if (emails.size === 0) return;

    const previousLookup = getClientByLocalAccountId;
    const clientsMap = new Map<string, IJMAPClient>();

    for (const email of emails) {
      const googleLocalAccountId = `google:${email}`;
      const googleClient = {
        getAccountId: () => googleLocalAccountId,
        getUsername: () => email,
        getServerUrl: () => 'https://www.googleapis.com',
        getAuthHeader: () => '',
        supportsContacts: () => true,
        createContact: async (contact: Partial<ContactCard>) => {
          return createGoogleContactApi({ ...contact, localAccountId: googleLocalAccountId });
        },
        updateContact: async (contactId: string, updates: Partial<ContactCard>) => {
          return updateGoogleContactApi(contactId, updates);
        },
        deleteContact: async (contactId: string) => {
          return deleteGoogleContactApi(contactId);
        },
      } as unknown as IJMAPClient;

      clientsMap.set(googleLocalAccountId, googleClient);
    }

    setClientLookup((localAccountId: string) => {
      if (clientsMap.has(localAccountId)) {
        return clientsMap.get(localAccountId)!;
      }
      return previousLookup(localAccountId);
    });
  }, [status.connected, status.accounts, status.email, contacts, addressBooks]);

  const connectGoogle = useCallback((returnToUrl = '/contacts?import=google') => {
    window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnToUrl)}`;
  }, []);

  return {
    status,
    contacts,
    addressBook,
    addressBooks,
    isLoading,
    connectGoogle,
    loadContacts,
    checkStatus,
  };
}
