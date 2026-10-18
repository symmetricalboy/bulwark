"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Folder, Tag, Star, GoogleIcon, MicrosoftIcon, Eye, EyeOff, Plus } from '@/components/icons';
import { FolderSettings } from '@/components/settings/folder-settings';
import { KeywordSettings } from '@/components/settings/keyword-settings';
import { GoogleAccountFoldersAndStarsSettings } from '@/components/settings/google-account-settings-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolicyStore } from '@/stores/policy-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAccountStore } from '@/stores/account-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useGoogleMail } from '@/hooks/use-google-mail';
import { useMicrosoftMail } from '@/hooks/use-microsoft-mail';
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
  type: 'comail' | 'google' | 'microsoft';
  icon: ReactNode;
}

export function FoldersAndTagsSettings({
  initialSubTab = 'folders',
  initialAccountId,
}: FoldersAndTagsSettingsProps) {
  const [subTab, setSubTab] = useState<'folders' | 'tags'>(initialSubTab);
  const [googleSubTab, setGoogleSubTab] = useState<'folders' | 'stars'>('folders');
  const [newMicrosoftFolderName, setNewMicrosoftFolderName] = useState('');
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
  const hiddenFolderIds = useSettingsStore((s) => s.hiddenFolderIds);
  const toggleFolderVisibility = useSettingsStore((s) => s.toggleFolderHidden);
  const googleMail = useGoogleMail();
  const microsoftMail = useMicrosoftMail();

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

    const seenMicrosoftEmails = new Set<string>();
    for (const acc of microsoftMail.accounts) {
      seenMicrosoftEmails.add(acc.email.toLowerCase());
      list.push({
        id: `microsoft:${acc.email}`,
        email: acc.email,
        type: 'microsoft',
        icon: <MicrosoftIcon className="w-4 h-4 flex-shrink-0" />,
      });
    }

    // Preserve a deep-linked Google or Microsoft account option even while hooks are loading
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
    } else if (selectedAccountId.startsWith('microsoft:')) {
      const email = selectedAccountId.slice('microsoft:'.length);
      if (email && !seenMicrosoftEmails.has(email.toLowerCase())) {
        list.push({
          id: selectedAccountId,
          email,
          type: 'microsoft',
          icon: <MicrosoftIcon className="w-4 h-4 flex-shrink-0" />,
        });
      }
    }

    return list;
  }, [comailEmail, googleMail.accountsData, microsoftMail.accounts, selectedAccountId]);

  const activeAccount =
    accountOptions.find((a) => a.id === selectedAccountId) ?? accountOptions[0];

  const selectedGoogleData =
    activeAccount.type === 'google'
      ? googleMail.accountsData.find(
          (g) => g.account.email.toLowerCase() === activeAccount.email.toLowerCase()
        )
      : undefined;

  const selectedMicrosoftMailboxes = useMemo(() => {
    if (activeAccount.type !== 'microsoft') return [];
    const prefix = `microsoft:${activeAccount.email}::`;
    return microsoftMail.mailboxes.filter((m) => m.id.startsWith(prefix));
  }, [activeAccount, microsoftMail.mailboxes]);

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
      ) : activeAccount.type === 'google' ? (
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
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Create Outlook Folder</h3>
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newMicrosoftFolderName.trim()) return;
                await microsoftMail.createFolder(
                  activeAccount.email,
                  newMicrosoftFolderName.trim()
                );
                setNewMicrosoftFolderName('');
              }}
            >
              <Input
                value={newMicrosoftFolderName}
                onChange={(e) => setNewMicrosoftFolderName(e.target.value)}
                placeholder="New folder name..."
                className="h-9 text-sm max-w-xs"
              />
              <Button type="submit" size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Create
              </Button>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {selectedMicrosoftMailboxes.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No Outlook folders loaded yet.
              </div>
            ) : (
              selectedMicrosoftMailboxes.map((mb) => {
                const isHidden = hiddenFolderIds.includes(mb.id);
                return (
                  <div
                    key={mb.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {mb.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFolderVisibility(mb.id)}
                      className="h-8 px-2.5 text-xs gap-1.5"
                    >
                      {isHidden ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Hidden</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          <span>Visible</span>
                        </>
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
