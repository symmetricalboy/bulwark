"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Mailbox } from '@/lib/jmap/types';
import {
  fetchGoogleMailboxes,
  fetchGoogleEmails,
  fetchGoogleEmail,
  updateGoogleEmail,
  deleteGoogleEmail,
} from '@/lib/google/google-mail-client';
import { getGoogleStatus, type GoogleAccountStatus } from '@/lib/google/google-calendar-client';
import type { LinkedGoogleAccountPublic } from '@/lib/google/types';

export interface GoogleMailAccountData {
  account: LinkedGoogleAccountPublic;
  mailboxes: Mailbox[];
  unreadTotal: number;
}

export function useGoogleMail() {
  const [status, setStatus] = useState<GoogleAccountStatus>({ configured: false, connected: false });
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const current = await getGoogleStatus();
      setStatus(current);
      return current;
    } catch {
      return { configured: false, connected: false };
    }
  }, []);

  const loadMailboxes = useCallback(async () => {
    setIsLoading(true);
    try {
      const current: GoogleAccountStatus = await getGoogleStatus().catch(() => ({ configured: false, connected: false }));
      setStatus(current);

      const accounts: LinkedGoogleAccountPublic[] = current.accounts || [];
      const gmailAccounts = accounts.filter((a) => a.enabledApps?.gmail === true);

      if (gmailAccounts.length === 0) {
        setMailboxes([]);
        return;
      }

      const allBoxes = await fetchGoogleMailboxes();
      // Keep only mailboxes belonging to accounts where gmail is enabled
      const enabledEmails = new Set(gmailAccounts.map((a) => a.email.toLowerCase()));
      const filtered = allBoxes.filter((mb) => {
        const mbEmail = mb.accountName || (mb.id.startsWith('google:') ? mb.id.split('::')[0].replace(/^google:/, '') : '');
        return enabledEmails.has(mbEmail.toLowerCase());
      });

      setMailboxes(filtered);
    } catch (err) {
      console.warn('Failed to load Google mailboxes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMailboxes();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'comail_google_status_refresh') {
        void loadMailboxes();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadMailboxes]);

  // Group mailboxes by Google account
  const accountsData = useMemo<GoogleMailAccountData[]>(() => {
    const accounts: LinkedGoogleAccountPublic[] = status.accounts || [];
    const gmailAccounts = accounts.filter((a) => a.enabledApps?.gmail === true);

    return gmailAccounts.map((acc) => {
      const accBoxes = mailboxes.filter((mb) => {
        const mbEmail = mb.accountName || (mb.id.startsWith('google:') ? mb.id.split('::')[0].replace(/^google:/, '') : '');
        return mbEmail.toLowerCase() === acc.email.toLowerCase();
      });

      const inbox = accBoxes.find((b) => b.role === 'inbox');
      const unreadTotal = inbox?.unreadEmails || 0;

      return {
        account: acc,
        mailboxes: accBoxes,
        unreadTotal,
      };
    });
  }, [status.accounts, mailboxes]);

  return {
    status,
    mailboxes,
    accountsData,
    hasGmailAccounts: accountsData.length > 0,
    isLoading,
    checkStatus,
    refreshMailboxes: loadMailboxes,
    fetchEmails: fetchGoogleEmails,
    fetchEmail: fetchGoogleEmail,
    updateEmail: updateGoogleEmail,
    deleteEmail: deleteGoogleEmail,
  };
}
