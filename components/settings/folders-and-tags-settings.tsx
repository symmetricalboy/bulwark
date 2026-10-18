"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Folder, Tag, Star, GoogleIcon } from '@/components/icons';
import { FolderSettings } from '@/components/settings/folder-settings';
import { KeywordSettings } from '@/components/settings/keyword-settings';
import { GoogleAccountFoldersAndStarsSettings } from '@/components/settings/google-account-settings-modal';
import { usePolicyStore } from '@/stores/policy-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAccountStore } from '@/stores/account-store';
import { useGoogleMail } from '@/hooks/use-google-mail';
import { toUnicodeEmail } from '@/lib/idn';
import { withBasePath } from '@/lib/browser-navigation';
import { cn } from '@/lib/utils';

export interface FoldersAndTagsSettingsProps {
  initialSubTab?: 'folders' | 'tags';
  initialAccountId?: string;
}

interface AccountOption {
  id: string;
  email: string;
  type: 'comail' | 'google';
  icon: ReactNode;
}

export function FoldersAndTagsSettings({
  initialSubTab = 'folders',
  initialAccountId,
}: FoldersAndTagsSettingsProps) {
  const [subTab, setSubTab] = useState<'folders' | 'tags'>(initialSubTab);
  const [googleSubTab, setGoogleSubTab] = useState<'folders' | 'stars'>('folders');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (initialAccountId) return initialAccountId;
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('settings-deep-link-account');
        if (stored) return stored;
      } catch { /* */ }
    }
    return 'comail:primary';
  });

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('settings-deep-link-account');
      if (stored) {
        setSelectedAccountId(stored);
        sessionStorage.removeItem('settings-deep-link-account');
      }
    } catch { /* */ }
  }, []);

  const t = useTranslations('settings');
  const { isFeatureEnabled } = usePolicyStore();
  const customKeywordsEnabled = isFeatureEnabled('customKeywordsEnabled');

  const primaryIdentity = useAuthStore((s) => s.primaryIdentity);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const googleMail = useGoogleMail();

  const comailEmail = useMemo(() => {
    const connected = accounts.filter((a) => a.isConnected && !a.hasError);
    const email =
      primaryIdentity?.email ||
      connected.find((a) => a.id === activeAccountId)?.email ||
      connected[0]?.email ||
      accounts[0]?.email;
    return email ? toUnicodeEmail(email) : 'user@comail.com';
  }, [primaryIdentity, accounts, activeAccountId]);

  const accountOptions = useMemo<AccountOption[]>(() => {
    const list: AccountOption[] = [
      {
        id: 'comail:primary',
        email: comailEmail,
        type: 'comail',
        icon: (
          <img
            src={withBasePath('/branding/comail/cammie-mark.png')}
            alt="Comail"
            className="w-4 h-4 object-contain flex-shrink-0"
          />
        ),
      },
    ];

    const seenGoogleEmails = new Set<string>();
    for (const { account } of googleMail.accountsData) {
      seenGoogleEmails.add(account.email.toLowerCase());
      list.push({
        id: `google:${account.email}`,
        email: account.email,
        type: 'google',
        icon: <GoogleIcon className="w-4 h-4 flex-shrink-0" />,
      });
    }

    // Preserve a deep-linked Google account option even while `useGoogleMail()` is loading
    if (selectedAccountId.startsWith('google:')) {
      const email = selectedAccountId.slice('google:'.length);
      if (email && !seenGoogleEmails.has(email.toLowerCase())) {
        list.push({
          id: selectedAccountId,
          email,
          type: 'google',
          icon: <GoogleIcon className="w-4 h-4 flex-shrink-0" />,
        });
      }
    }

    return list;
  }, [comailEmail, googleMail.accountsData, selectedAccountId]);

  const activeAccount =
    accountOptions.find((a) => a.id === selectedAccountId) ?? accountOptions[0];

  const selectedGoogleData =
    activeAccount.type === 'google'
      ? googleMail.accountsData.find(
          (g) => g.account.email.toLowerCase() === activeAccount.email.toLowerCase()
        )
      : undefined;

  return (
    <div className="space-y-6">
      {/* Account Picker */}
      <div
        data-testid="folders-account-picker"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-card shadow-2xs"
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select an account to configure its visible folders, labels, tags, or stars.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/50 w-fit">
          {accountOptions.map((acc) => {
            const isSelected = activeAccount.id === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                data-testid={`account-picker-${acc.id}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedAccountId(acc.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  isSelected
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {acc.icon}
                <span className="truncate max-w-[220px]">{acc.email}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab switcher */}
      {activeAccount.type === 'comail' ? (
        <>
          {customKeywordsEnabled && (
            <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg w-fit border border-border/50">
              <button
                type="button"
                data-testid="subtab-folders"
                onClick={() => setSubTab('folders')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  subTab === 'folders'
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{t('tabs.folders')}</span>
              </button>
              <button
                type="button"
                data-testid="subtab-tags"
                onClick={() => setSubTab('tags')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  subTab === 'tags'
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{t('tabs.keywords')}</span>
              </button>
            </div>
          )}

          {subTab === 'folders' ? <FolderSettings /> : <KeywordSettings />}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg w-fit border border-border/50">
            <button
              type="button"
              data-testid="subtab-google-folders"
              onClick={() => setGoogleSubTab('folders')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                googleSubTab === 'folders'
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Folders & Labels</span>
            </button>
            <button
              type="button"
              data-testid="subtab-google-stars"
              onClick={() => setGoogleSubTab('stars')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                googleSubTab === 'stars'
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Star className="w-3.5 h-3.5 text-yellow-500" />
              <span>Gmail Stars (12 Stars)</span>
            </button>
          </div>

          <GoogleAccountFoldersAndStarsSettings
            accountEmail={activeAccount.email}
            mailboxes={selectedGoogleData?.mailboxes || []}
            isLoading={googleMail.isLoading}
            onMailboxesUpdated={() => {
              void googleMail.refreshMailboxes();
            }}
            activeTab={googleSubTab}
          />
        </>
      )}
    </div>
  );
}
