"use client";

import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  GripVertical,
  Plus,
  Star,
  AlertCircle,
  ChevronRight,
  Info,
  Link as LinkIcon,
  Trash2,
  GoogleIcon,
  MicrosoftIcon,
  AppleIcon,
  NextcloudIcon,
  AtprotoIcon,
  Sparkles,
  Check,
  ExternalLink,
} from '@/components/icons';
import { useAuthStore } from '@/stores/auth-store';
import { useEmailStore } from '@/stores/email-store';
import { useAccountStore, type AccountEntry } from '@/stores/account-store';
import { useManagedAccountStore } from '@/stores/managed-account-store';
import type { SharedAccount } from '@/lib/jmap/types';
import { SettingsSection } from './settings-section';
import { Avatar } from '@/components/ui/avatar';
import { AtprotoHandle } from '@/components/ui/atproto-handle';
import { Button } from '@/components/ui/button';
import { AccountInfoDialog } from './account-info-dialog';
import { LinkedAccountsModal } from './linked-accounts-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useRouter } from '@/i18n/navigation';
import { getMaxAccounts, isSameIdentity } from '@/lib/account-utils';
import { cn } from '@/lib/utils';
import { toUnicodeDomain, toUnicodeEmail } from '@/lib/idn';
import { IS_LITE } from '@/lib/lite';
import { usePolicyStore } from '@/stores/policy-store';
import { AccountArchiveSettings } from './account-archive-settings';

function hostnameOf(serverUrl: string): string {
  try { return toUnicodeDomain(new URL(serverUrl).hostname); } catch { return serverUrl; }
}

// First scoped settings tab to land on for a shared account, by capability.
// Mirrors the scoped-tab gating in the settings page. null = nothing editable.
function firstScopedTab(caps: SharedAccount['capabilities']): string | null {
  if (caps.sieve) return 'filters';
  if (caps.mail) return 'vacation';
  if (caps.calendars) return 'calendar';
  if (caps.contacts) return 'contacts';
  return null;
}

export function AccountSettings() {
  const t = useTranslations('settings.account');
  const router = useRouter();
  const { isDemoMode, client } = useAuthStore();
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const removeAccount = useAuthStore((s) => s.removeAccount);
  const setManagedAccount = useManagedAccountStore((s) => s.setManagedAccount);
  const archiveEnabled = usePolicyStore((s) => s.isFeatureEnabled('accountArchiveEnabled')) && !IS_LITE && !isDemoMode;

  // Shared/group accounts delegated to this session (excludes the user's own
  // primary account). These can be drilled into for scoped settings editing.
  const sharedAccounts = useMemo<SharedAccount[]>(
    () => (client?.getSharedAccounts() ?? []).filter((a) => !a.isPrimary),
    [client],
  );
  const { quota } = useEmailStore();
  const accounts = useAccountStore((s) => s.accounts);
  const setDefaultAccount = useAccountStore((s) => s.setDefaultAccount);
  const reorderAccounts = useAccountStore((s) => s.reorderAccounts);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const [infoAccount, setInfoAccount] = useState<AccountEntry | null>(null);
  const [linkedModalAccount, setLinkedModalAccount] = useState<AccountEntry | null>(null);
  const [accountToRemove, setAccountToRemove] = useState<AccountEntry | null>(null);

  const max = getMaxAccounts();

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = draggedIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    const next = accounts.map((a) => a.id);
    const [moved] = next.splice(fromIndex, 1);
    next.splice(dropIndex, 0, moved);
    reorderAccounts(next);
  }, [accounts, reorderAccounts]);

  const handleDragEnd = useCallback(() => {
    draggedIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleSwitch = useCallback((id: string) => {
    if (id === activeAccountId) return;
    void switchAccount(id);
  }, [activeAccountId, switchAccount]);

  const handleAddAccount = useCallback(() => {
    router.push(`/login?mode=add-account` as never);
  }, [router]);

  const handleConfirmRemove = useCallback(() => {
    if (!accountToRemove) return;
    removeAccount(accountToRemove.id);
    setAccountToRemove(null);
  }, [accountToRemove, removeAccount]);

  // Enter scoped settings mode for a shared/group account: set the managed
  // account, then steer the settings panel to its first editable tab via the
  // existing 'settings-tab-change' event the page already listens for.
  const handleManageShared = useCallback((account: SharedAccount) => {
    const tab = firstScopedTab(account.capabilities);
    if (!tab) return;
    setManagedAccount(account);
    window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: tab }));
  }, [setManagedAccount]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
      </div>

      {/* Logged-in accounts list */}
      {accounts.length > 0 && (
        <SettingsSection title={t('accounts.title')} description={t('accounts.description')}>
          <div className="space-y-2">
            {accounts.map((a, index) => (
              <AccountRow
                key={a.id}
                account={a}
                index={index}
                isActive={a.id === activeAccountId}
                isDragOver={dragOverIndex === index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onSwitch={() => handleSwitch(a.id)}
                onSetDefault={() => setDefaultAccount(a.id)}
                onShowInfo={() => setInfoAccount(a)}
                onShowLinkedAccounts={() => setLinkedModalAccount(a)}
                onRemove={() => setAccountToRemove(a)}
                labels={{
                  active: t('accounts.active'),
                  default: t('accounts.default_badge'),
                  setDefault: t('accounts.set_default'),
                  switchTo: t('accounts.switch_to'),
                  dragHandle: t('accounts.drag_handle'),
                  accountInfo: t('info_button'),
                  linkedAccounts: t('linked_accounts.button'),
                  removeAccount: t('remove_button'),
                }}
              />
            ))}

            {accounts.length < max && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAccount}
                className="w-full"
              >
                <Plus className="w-4 h-4 me-2" />
                {t('accounts.add')}
              </Button>
            )}
          </div>
        </SettingsSection>
      )}

      {/* Comail Pro & Subscription Tier */}
      <SettingsSection
        title="Subscription & Comail Pro"
        description="Unlock high-frequency continuous sync, custom domain relays via Comail Build, and sovereign ATProto encryption."
      >
        <div className="p-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-muted/30 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">Comail Sovereign</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                    Free Tier
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connected to sovereign ATProto Space and self-hosted JMAP
                </p>
              </div>
            </div>
            <a
              href="https://build.comail.at"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 shrink-0 shadow-2xs"
            >
              <span>Manage Comail Pro</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/60">
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Continuous Sync</span>
                <span className="text-[11px] text-muted-foreground">Google, Microsoft, Apple & Nextcloud</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Comail Build Relay</span>
                <span className="text-[11px] text-muted-foreground">Domain routing, webhooks & webmail</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Sovereign Encryption</span>
                <span className="text-[11px] text-muted-foreground">ATProto PDS & private key storage</span>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {archiveEnabled && <AccountArchiveSettings />}

      {/* Shared / group accounts delegated to this session. Clicking one drills
          into a scoped settings view (filters, vacation, calendars, contacts). */}
      {sharedAccounts.length > 0 && (
        <SettingsSection title={t('shared_accounts.title')} description={t('shared_accounts.description')}>
          <div className="space-y-2">
            {sharedAccounts.map((acc) => {
              const editable = firstScopedTab(acc.capabilities) !== null;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleManageShared(acc)}
                  disabled={!editable}
                  className={cn(
                    'flex items-center gap-3 w-full p-3 border border-border rounded-lg text-start transition-colors',
                    editable ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <Avatar
                    name={acc.name}
                    size="sm"
                    className="w-9 h-9 text-sm flex-shrink-0"
                    disableFavicon
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t('shared_accounts.shared_label')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </SettingsSection>
      )}

      {/* Account Info Dialog */}
      <AccountInfoDialog
        isOpen={Boolean(infoAccount)}
        onClose={() => setInfoAccount(null)}
        account={infoAccount}
        isActive={infoAccount?.id === activeAccountId}
        quota={infoAccount?.id === activeAccountId ? quota : null}
        isDemoMode={isDemoMode}
      />

      {/* Linked Accounts Modal */}
      <LinkedAccountsModal
        isOpen={Boolean(linkedModalAccount)}
        onClose={() => setLinkedModalAccount(null)}
        comailAccount={linkedModalAccount}
      />

      {/* Remove Account Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(accountToRemove)}
        onClose={() => setAccountToRemove(null)}
        onConfirm={handleConfirmRemove}
        title={t('remove_confirm_title')}
        message={
          accountToRemove
            ? t('remove_confirm_message', {
                account: toUnicodeEmail(
                  accountToRemove.email || accountToRemove.username || accountToRemove.label
                ),
              })
            : ''
        }
        confirmText={t('remove_button')}
        variant="destructive"
      />
    </div>
  );
}

interface AccountRowProps {
  account: AccountEntry;
  index: number;
  isActive: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onSwitch: () => void;
  onSetDefault: () => void;
  onShowInfo: () => void;
  onShowLinkedAccounts: () => void;
  onRemove: () => void;
  labels: {
    active: string;
    default: string;
    setDefault: string;
    switchTo: string;
    dragHandle: string;
    accountInfo: string;
    linkedAccounts: string;
    removeAccount: string;
  };
}

function ProviderBadge({ account }: { account: AccountEntry }) {
  const email = (account.email || account.username || '').toLowerCase();
  const server = (account.serverUrl || '').toLowerCase();

  if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com') || server.includes('google')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
        <GoogleIcon className="w-3 h-3 shrink-0" />
        <span>Google Workspace</span>
      </span>
    );
  }
  if (account.did) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
        <AtprotoIcon className="w-3 h-3 shrink-0" />
        <span>ATProto Space</span>
      </span>
    );
  }
  if (
    email.endsWith('@outlook.com') ||
    email.endsWith('@hotmail.com') ||
    email.endsWith('@live.com') ||
    email.endsWith('@office365.com') ||
    server.includes('outlook') ||
    server.includes('office365') ||
    server.includes('microsoft')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
        <MicrosoftIcon className="w-3 h-3 shrink-0" />
        <span>Microsoft 365</span>
      </span>
    );
  }
  if (email.endsWith('@icloud.com') || email.endsWith('@me.com') || email.endsWith('@mac.com') || server.includes('icloud')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border shrink-0">
        <AppleIcon className="w-3 h-3 shrink-0" />
        <span>iCloud</span>
      </span>
    );
  }
  if (server.includes('nextcloud') || server.includes('owncloud')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
        <NextcloudIcon className="w-3 h-3 shrink-0" />
        <span>Nextcloud</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
      <span>JMAP</span>
    </span>
  );
}

function AccountRow({
  account,
  index,
  isActive,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSwitch,
  onSetDefault,
  onShowInfo,
  onShowLinkedAccounts,
  onRemove,
  labels,
}: AccountRowProps) {
  const rowName = account.displayName || account.label;
  const rowEmail = account.email || account.username;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 border rounded-xl transition-all duration-200 shadow-2xs',
        isDragOver
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : isActive
            ? 'border-primary/40 bg-accent/25 ring-1 ring-primary/20'
            : 'border-border bg-card/60 hover:bg-muted/40 hover:border-border/80'
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
          title={labels.dragHandle}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="relative flex-shrink-0">
          <Avatar
            name={account.displayName || account.label}
            email={account.email || account.username}
            did={account.did}
            size="sm"
            className="w-10 h-10 text-sm shadow-2xs"
            disableFavicon
            fallbackColor={account.avatarColor}
          />
          {isActive && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-white ring-2 ring-background flex items-center justify-center shadow-xs"
              title={labels.active}
            >
              <svg
                className="w-2.5 h-2.5 text-white"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" stroke="#ffffff" />
              </svg>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onSwitch}
          disabled={isActive}
          className={cn(
            'min-w-0 flex-1 text-start',
            !isActive && 'cursor-pointer'
          )}
          title={isActive ? labels.active : labels.switchTo}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold truncate tracking-tight text-foreground font-mono">
              {rowName}
            </span>
            <ProviderBadge account={account} />
            {account.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                <Star className="w-2.5 h-2.5 fill-amber-500" aria-label={labels.default} />
                <span>{labels.default}</span>
              </span>
            )}
          </div>
          <AtprotoHandle
            did={account.did}
            className="block text-[11px] leading-4 text-muted-foreground"
          />
          {!isSameIdentity(rowName, rowEmail) && (
            <p className="text-xs text-muted-foreground truncate">
              {rowEmail}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            {account.hasError ? (
              <AlertCircle className="w-3 h-3 text-destructive" />
            ) : (
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                account.isConnected ? 'bg-green-500 shadow-xs' : 'bg-muted-foreground/40'
              )} />
            )}
            <span className="text-[10px] text-muted-foreground truncate">
              {hostnameOf(account.serverUrl)}
            </span>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onShowLinkedAccounts();
          }}
          className="h-8 px-2.5 text-xs gap-1.5 shadow-2xs"
          title={labels.linkedAccounts}
        >
          <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{labels.linkedAccounts}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onShowInfo();
          }}
          className="h-8 px-2.5 text-xs gap-1.5 shadow-2xs"
          title={labels.accountInfo}
        >
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{labels.accountInfo}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="h-8 px-2.5 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-border shadow-2xs"
          title={labels.removeAccount}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
          <span>{labels.removeAccount}</span>
        </Button>

        {!account.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors"
            title={labels.setDefault}
            aria-label={labels.setDefault}
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

