"use client";

import { useEffect, useState, useId, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ToggleSwitch } from '@/components/settings/settings-section';
import {
  X,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  Link as LinkIcon,
  GoogleIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
  GoogleTasksIcon,
  GoogleContactsIcon,
} from '@/components/icons';
import type { LinkedGoogleAccountPublic, GoogleAccountAppToggles } from '@/lib/google/types';
import type { AccountEntry } from '@/stores/account-store';
import { cn } from '@/lib/utils';
import { toUnicodeEmail } from '@/lib/idn';

interface LinkedAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  comailAccount?: AccountEntry | null;
}

interface StatusResponse {
  configured: boolean;
  connected: boolean;
  accounts?: LinkedGoogleAccountPublic[];
  email?: string;
  name?: string;
  picture?: string;
}

export function LinkedAccountsModal({ isOpen, onClose, comailAccount }: LinkedAccountsModalProps) {
  const t = useTranslations('settings.account.linked_accounts');
  const tCommon = useTranslations('common');
  const id = useId();

  const comailAccountId = comailAccount?.id;
  const comailAccountEmail = comailAccount?.email || comailAccount?.username;
  const comailAccountLabel = comailAccount?.displayName || comailAccount?.label || comailAccount?.email;

  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [accounts, setAccounts] = useState<LinkedGoogleAccountPublic[]>([]);
  const [accountToRemove, setAccountToRemove] = useState<LinkedGoogleAccountPublic | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

  const dialogRef = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
    restoreFocus: true,
  });

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL('/api/auth/google/status', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      if (comailAccountId) url.searchParams.set('comailAccountId', comailAccountId);
      if (comailAccountEmail) url.searchParams.set('comailAccountEmail', comailAccountEmail);

      const headers: Record<string, string> = {};
      if (comailAccountId) headers['x-comail-account-id'] = comailAccountId;
      if (comailAccountEmail) headers['x-comail-account-email'] = comailAccountEmail;

      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setConfigured(Boolean(data.configured));
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
        } else if (data.connected && data.email) {
          // Fallback legacy single account format
          setAccounts([
            {
              id: data.email,
              email: data.email,
              name: data.name,
              picture: data.picture,
              enabledApps: { calendar: true, tasks: true, drive: true, contacts: true },
              connectedAt: Date.now(),
              comailAccountId,
              comailAccountEmail,
            },
          ]);
        } else {
          setAccounts([]);
        }
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }, [comailAccountId, comailAccountEmail]);

  useEffect(() => {
    if (isOpen) {
      void loadStatus();
    }
  }, [isOpen, loadStatus]);

  useEffect(() => {
    if (!isOpen) return;

    const handleBackdropClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleBackdropClick);
    return () => document.removeEventListener('mousedown', handleBackdropClick);
  }, [isOpen, onClose, dialogRef]);

  const handleConnect = useCallback((emailHint?: string) => {
    const returnTo = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/settings/account';

    const url = new URL('/api/auth/google/start', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    url.searchParams.set('returnTo', returnTo);
    if (emailHint) {
      url.searchParams.set('email', emailHint);
    }
    if (comailAccountId) {
      url.searchParams.set('comailAccountId', comailAccountId);
    }
    if (comailAccountEmail) {
      url.searchParams.set('comailAccountEmail', comailAccountEmail);
    }

    window.location.href = url.toString();
  }, [comailAccountId, comailAccountEmail]);

  const handleToggleApp = useCallback(
    async (account: LinkedGoogleAccountPublic, app: keyof GoogleAccountAppToggles, enabled: boolean) => {
      const toggleKey = `${account.id}-${app}`;
      setTogglingMap((prev) => ({ ...prev, [toggleKey]: true }));

      // Optimistic update
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? {
                ...a,
                enabledApps: {
                  ...a.enabledApps,
                  [app]: enabled,
                },
              }
            : a
        )
      );

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (comailAccountId) headers['x-comail-account-id'] = comailAccountId;
        if (comailAccountEmail) headers['x-comail-account-email'] = comailAccountEmail;

        const res = await fetch('/api/auth/google/toggle-app', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            accountId: account.id,
            app,
            enabled,
            comailAccountId,
            comailAccountEmail,
          }),
        });

        if (!res.ok) {
          // Revert optimistic update on failure
          setAccounts((prev) =>
            prev.map((a) =>
              a.id === account.id
                ? {
                    ...a,
                    enabledApps: {
                      ...a.enabledApps,
                      [app]: !enabled,
                    },
                  }
                : a
            )
          );
        }
      } catch {
        // Revert on error
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id
              ? {
                  ...a,
                  enabledApps: {
                    ...a.enabledApps,
                    [app]: !enabled,
                  },
                }
              : a
          )
        );
      } finally {
        setTogglingMap((prev) => {
          const next = { ...prev };
          delete next[toggleKey];
          return next;
        });
      }
    },
    [comailAccountId, comailAccountEmail]
  );

  const confirmRemoveAccount = useCallback(async () => {
    if (!accountToRemove) return;
    const target = accountToRemove;
    setAccountToRemove(null);
    setRemovingId(target.id);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (comailAccountId) headers['x-comail-account-id'] = comailAccountId;
      if (comailAccountEmail) headers['x-comail-account-email'] = comailAccountEmail;

      const res = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId: target.id,
          email: target.email,
          comailAccountId,
          comailAccountEmail,
        }),
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== target.id));
      }
    } catch {
      // ignore disconnect error
    } finally {
      setRemovingId(null);
    }
  }, [accountToRemove, comailAccountId, comailAccountEmail]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <LinkIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 id={`${id}-title`} className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span>{t('title')}</span>
                  {comailAccountLabel && (
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-[200px]" title={comailAccountLabel}>
                      {comailAccountLabel}
                    </span>
                  )}
                </h2>
                <p id={`${id}-desc`} className="text-xs text-muted-foreground">
                  {t('description')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {!configured && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium">{t('not_configured')}</p>
                </div>
              </div>
            )}

            {loading && accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{tCommon('loading')}...</span>
              </div>
            ) : accounts.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center text-center py-10 px-4 border border-dashed border-border rounded-xl">
                <div className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center mb-3">
                  <GoogleIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t('empty_title')}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1.5 mb-5">
                  {t('empty_description')}
                </p>
                <Button
                  onClick={() => handleConnect()}
                  disabled={!configured}
                  className="gap-2"
                >
                  <GoogleIcon className="w-4 h-4" />
                  {t('add_account')}
                </Button>
              </div>
            ) : (
              /* List of connected external Google accounts */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Google Accounts ({accounts.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect()}
                    disabled={!configured}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('add_another')}
                  </Button>
                </div>

                <div className="space-y-3">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={cn(
                        'border border-border rounded-xl overflow-hidden bg-card transition-shadow',
                        removingId === acc.id && 'opacity-50 pointer-events-none'
                      )}
                    >
                      {/* Account Card Header */}
                      <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={acc.picture}
                            name={acc.name || acc.email}
                            email={acc.email}
                            size="sm"
                            className="w-9 h-9 text-xs flex-shrink-0"
                            disableFavicon
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {acc.name || toUnicodeEmail(acc.email)}
                              </p>
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <GoogleIcon className="w-2.5 h-2.5" />
                                Google
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate font-mono">
                              {toUnicodeEmail(acc.email)}
                            </p>
                          </div>
                        </div>

                        {/* Reconnect & Remove buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConnect(acc.email)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                            title={t('reconnect')}
                          >
                            <RefreshCw className="w-3.5 h-3.5 me-1.5" />
                            {t('reconnect')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAccountToRemove(acc)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={t('remove')}
                          >
                            <Trash2 className="w-3.5 h-3.5 me-1.5 text-destructive" />
                            <span className="text-destructive">{t('remove')}</span>
                          </Button>
                        </div>
                      </div>

                      {/* App Population Toggles */}
                      <div className="p-4 space-y-3">
                        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          {t('apps_heading')}
                        </div>

                        <div className="space-y-2">
                          {/* 1. Calendar */}
                          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-background border border-border/70 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                <GoogleCalendarIcon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">
                                  {t('apps.calendar')}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {t('apps.calendar_desc')}
                                </p>
                              </div>
                            </div>
                            <ToggleSwitch
                              checked={acc.enabledApps?.calendar !== false}
                              disabled={Boolean(togglingMap[`${acc.id}-calendar`])}
                              onChange={(enabled) => handleToggleApp(acc, 'calendar', enabled)}
                              ariaLabel={`${t('apps.calendar')} for ${acc.email}`}
                            />
                          </div>

                          {/* 2. Tasks */}
                          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-background border border-border/70 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                <GoogleTasksIcon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">
                                  {t('apps.tasks')}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {t('apps.tasks_desc')}
                                </p>
                              </div>
                            </div>
                            <ToggleSwitch
                              checked={acc.enabledApps?.tasks !== false}
                              disabled={Boolean(togglingMap[`${acc.id}-tasks`])}
                              onChange={(enabled) => handleToggleApp(acc, 'tasks', enabled)}
                              ariaLabel={`${t('apps.tasks')} for ${acc.email}`}
                            />
                          </div>

                          {/* 3. Drive */}
                          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-background border border-border/70 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                <GoogleDriveIcon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">
                                  {t('apps.drive')}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {t('apps.drive_desc')}
                                </p>
                              </div>
                            </div>
                            <ToggleSwitch
                              checked={acc.enabledApps?.drive !== false}
                              disabled={Boolean(togglingMap[`${acc.id}-drive`])}
                              onChange={(enabled) => handleToggleApp(acc, 'drive', enabled)}
                              ariaLabel={`${t('apps.drive')} for ${acc.email}`}
                            />
                          </div>

                          {/* 4. Contacts */}
                          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-background border border-border/70 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                <GoogleContactsIcon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">
                                  {t('apps.contacts')}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {t('apps.contacts_desc')}
                                </p>
                              </div>
                            </div>
                            <ToggleSwitch
                              checked={acc.enabledApps?.contacts !== false}
                              disabled={Boolean(togglingMap[`${acc.id}-contacts`])}
                              onChange={(enabled) => handleToggleApp(acc, 'contacts', enabled)}
                              ariaLabel={`${t('apps.contacts')} for ${acc.email}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-muted/20 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>
              {tCommon('close')}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog before removing account */}
      {accountToRemove && (
        <ConfirmDialog
          isOpen={Boolean(accountToRemove)}
          onClose={() => setAccountToRemove(null)}
          onConfirm={confirmRemoveAccount}
          title={t('remove_confirm_title')}
          message={t('remove_confirm_message', { email: accountToRemove.email })}
          confirmText={t('remove')}
          variant="destructive"
        />
      )}
    </>
  );
}
