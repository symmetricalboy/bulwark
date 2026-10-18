'use client';

import { useState, useEffect, useCallback } from 'react';
import { microsoftContactsClient } from '@/lib/microsoft/microsoft-contacts-client';
import { useContactStore } from '@/stores/contact-store';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/stores/toast-store';
import { reconcileContacts } from '@/lib/google/sync-engine';
import type { MicrosoftAccountAppToggles } from '@/lib/microsoft/types';

export interface ConnectedMicrosoftContactsAccount {
  id?: string;
  email: string;
  name?: string;
  expiresAt: number;
  apps?: MicrosoftAccountAppToggles;
}

export function useMicrosoftContacts() {
  const [accounts, setAccounts] = useState<ConnectedMicrosoftContactsAccount[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/microsoft/status');
      if (res.ok) {
        const data = await res.json();
        setConfigured(data.configured);
        const enabled = (data.accounts || []).filter(
          (a: ConnectedMicrosoftContactsAccount) =>
            a.apps?.contacts === true ||
            a.apps?.contacts === 'separate' ||
            a.apps?.contacts === 'sync'
        );
        setAccounts(enabled);
        return enabled as ConnectedMicrosoftContactsAccount[];
      }
    } catch {
      // Ignore status errors
    }
    return [];
  }, []);

  const syncMicrosoftContacts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { accounts: accountGroups } = await microsoftContactsClient.getContactsAndBooks();
      const separateGroups = accountGroups.filter((g) => g.mode === 'separate');
      const syncGroups = accountGroups.filter((g) => g.mode === 'sync');

      const addressBooks = separateGroups.map((g) => g.addressBook);
      const contacts = separateGroups.flatMap((g) => g.contacts);

      const store = useContactStore.getState();
      const nonMicrosoftBooks = store.addressBooks.filter((b) => !b.id.startsWith('microsoft:'));
      const nonMicrosoftContacts = store.contacts.filter((c) => !c.id.startsWith('microsoft:'));

      const jmapClient = useAuthStore.getState().client;

      if (syncGroups.length > 0 && jmapClient && jmapClient.supportsContacts()) {
        const defaultBook =
          nonMicrosoftBooks.find((b) => b.isDefault && !b.id.startsWith('google:')) ||
          nonMicrosoftBooks.find((b) => !b.id.startsWith('google:'));
        const defaultBookId = defaultBook?.id || 'default-contacts';

        let runningComailContacts = useContactStore
          .getState()
          .contacts.filter((c) => !c.id.startsWith('google:') && !c.id.startsWith('microsoft:'));

        for (const group of syncGroups) {
          const syncResult = reconcileContacts({
            accountEmail: group.email,
            incomingContacts: group.contacts,
            defaultAddressBookId: defaultBookId,
            currentContacts: runningComailContacts,
            onPushToGoogle: async (_email, c) => {
              try {
                await microsoftContactsClient.createContact(group.email, c);
              } catch {
                // Continue
              }
            },
          });
          runningComailContacts = syncResult.merged;
        }

        const googleContacts = useContactStore
          .getState()
          .contacts.filter((c) => c.id.startsWith('google:'));
        useContactStore.setState({
          addressBooks: [...nonMicrosoftBooks, ...addressBooks],
          contacts: [...runningComailContacts, ...googleContacts, ...contacts],
        });
      } else {
        useContactStore.setState({
          addressBooks: [...nonMicrosoftBooks, ...addressBooks],
          contacts: [...nonMicrosoftContacts, ...contacts],
        });
      }
    } catch {
      // Ignore background sync failures
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    checkStatus().then((accs) => {
      if (!mounted) return;
      setIsLoading(false);
      if (accs.length > 0) {
        syncMicrosoftContacts();
      } else {
        const store = useContactStore.getState();
        if (
          store.addressBooks.some((b) => b.id.startsWith('microsoft:')) ||
          store.contacts.some((c) => c.id.startsWith('microsoft:'))
        ) {
          useContactStore.setState({
            addressBooks: store.addressBooks.filter((b) => !b.id.startsWith('microsoft:')),
            contacts: store.contacts.filter((c) => !c.id.startsWith('microsoft:')),
          });
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [checkStatus, syncMicrosoftContacts]);

  useEffect(() => {
    const handleChanged = () => {
      checkStatus().then((accs) => {
        if (accs.length > 0) {
          syncMicrosoftContacts();
        } else {
          const store = useContactStore.getState();
          useContactStore.setState({
            addressBooks: store.addressBooks.filter((b) => !b.id.startsWith('microsoft:')),
            contacts: store.contacts.filter((c) => !c.id.startsWith('microsoft:')),
          });
        }
      });
    };
    window.addEventListener('microsoft-accounts-changed', handleChanged);
    window.addEventListener('google-accounts-changed', handleChanged);
    return () => {
      window.removeEventListener('microsoft-accounts-changed', handleChanged);
      window.removeEventListener('google-accounts-changed', handleChanged);
    };
  }, [checkStatus, syncMicrosoftContacts]);

  const connectAccount = useCallback((returnTo?: string) => {
    const target = returnTo || window.location.pathname;
    window.location.href = `/api/auth/microsoft/start?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const disconnectAccount = useCallback(async (email: string) => {
    try {
      const res = await fetch('/api/auth/microsoft/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        await checkStatus();
        const prefix = `microsoft:${email}::`;
        const store = useContactStore.getState();
        useContactStore.setState({
          addressBooks: store.addressBooks.filter((b) => !b.id.startsWith(prefix)),
          contacts: store.contacts.filter((c) => !c.id.startsWith(prefix)),
        });
        toast.success(`Disconnected ${email}`);
      }
    } catch {
      toast.error('Failed to disconnect Microsoft account');
    }
  }, [checkStatus]);

  return {
    accounts,
    configured,
    isLoading,
    isSyncing,
    connectAccount,
    disconnectAccount,
    refresh: syncMicrosoftContacts,
  };
}
