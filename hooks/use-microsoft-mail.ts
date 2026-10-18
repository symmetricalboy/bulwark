import { useState, useEffect, useCallback } from 'react';
import {
  fetchMicrosoftMailFoldersClient,
  createMicrosoftFolderClient,
  type MicrosoftMailAccountInfo,
} from '@/lib/microsoft/microsoft-mail-client';
import type { Mailbox } from '@/lib/jmap/types';
import { toast } from '@/stores/toast-store';

export function useMicrosoftMail() {
  const [accounts, setAccounts] = useState<MicrosoftMailAccountInfo[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const syncMicrosoftMail = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchMicrosoftMailFoldersClient();
      setAccounts(data.accounts || []);
      setMailboxes(data.mailboxes || []);
    } catch {
      // Silently ignore if not connected
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncMicrosoftMail();

    const handleAccountsChanged = () => {
      syncMicrosoftMail();
    };
    window.addEventListener('microsoft-accounts-changed', handleAccountsChanged);
    window.addEventListener('google-accounts-changed', handleAccountsChanged);
    return () => {
      window.removeEventListener('microsoft-accounts-changed', handleAccountsChanged);
      window.removeEventListener('google-accounts-changed', handleAccountsChanged);
    };
  }, [syncMicrosoftMail]);

  const createFolder = useCallback(async (accountEmail: string, name: string) => {
    try {
      const newMailbox = await createMicrosoftFolderClient(accountEmail, name);
      setMailboxes((prev) => [...prev, newMailbox]);
      toast.success(`Created folder "${name}"`);
      return newMailbox;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create Outlook folder');
      throw err;
    }
  }, []);

  return {
    accounts,
    mailboxes,
    isLoading,
    syncMicrosoftMail,
    createFolder,
  };
}
