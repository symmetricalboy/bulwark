"use client";

import { useEffect, useState, useId, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GoogleAccountServicesConfig } from './google-account-services-config';
import {
  MicrosoftAccountServicesConfig,
  type MicrosoftAccountConfigItem,
} from './microsoft-account-services-config';
import {
  X,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  Link as LinkIcon,
  GoogleIcon,
  MicrosoftIcon,
} from '@/components/icons';
import type { LinkedGoogleAccountPublic, GoogleAccountAppToggles } from '@/lib/google/types';
import type { MicrosoftAccountAppToggles } from '@/lib/microsoft/types';
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

interface MicrosoftStatusResponse {
  configured: boolean;
  accounts?: MicrosoftAccountConfigItem[];
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
  const [microsoftConfigured, setMicrosoftConfigured] = useState(true);
  const [accounts, setAccounts] = useState<LinkedGoogleAccountPublic[]>([]);
  const [microsoftAccounts, setMicrosoftAccounts] = useState<MicrosoftAccountConfigItem[]>([]);
  const [accountToRemove, setAccountToRemove] = useState<{
    provider: 'google' | 'microsoft';
    id: string;
    email: string;
  } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

  const dialogRef = useFocusTrap({
    isActive: isOpen && !accountToRemove,
    onEscape: onClose,
    restoreFocus: true,
  });

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = new URL('/api/auth/google/status', origin);
      if (comailAccountId) url.searchParams.set('comailAccountId', comailAccountId);
      if (comailAccountEmail) url.searchParams.set('comailAccountEmail', comailAccountEmail);

      const headers: Record<string, string> = {};
      if (comailAccountId) headers['x-comail-account-id'] = comailAccountId;
      if (comailAccountEmail) headers['x-comail-account-email'] = comailAccountEmail;

      const [res, msRes] = await Promise.all([
        fetch(url.toString(), { headers }),
        fetch(new URL('/api/auth/microsoft/status', origin).toString()).catch(() => null),
      ]);

      if (res.ok) {
        const data: StatusResponse = await res.json();
        setConfigured(Boolean(data.configured));
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
        } else if (data.connected && data.email) {
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

      if (msRes && msRes.ok) {
        const msData: MicrosoftStatusResponse = await msRes.json();
        setMicrosoftConfigured(Boolean(msData.configured));
        setMicrosoftAccounts(msData.accounts || []);
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
      if (accountToRemove) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[role="alertdialog"]') || target?.closest?.('[data-confirm-dialog]')) {
        return;
      }

      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleBackdropClick);
    return () => document.removeEventListener('mousedown', handleBackdropClick);
  }, [isOpen, onClose, dialogRef, accountToRemove]);

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

  const handleConnectMicrosoft = useCallback(() => {
    const returnTo = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/settings/account';

    const url = new URL('/api/auth/microsoft/start', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    url.searchParams.set('returnTo', returnTo);
    window.location.href = url.toString();
  }, []);

  const handleUpdateAppSetting = useCallback(
    async (
      account: LinkedGoogleAccountPublic,
      updates: Partial<GoogleAccountAppToggles>
    ) => {
      const keys = Object.keys(updates);
      const appKey = keys[0] as keyof GoogleAccountAppToggles;
      const toggleKey = `${account.id}-${appKey}`;
      setTogglingMap((prev) => ({ ...prev, [toggleKey]: true }));

      const prevApps = { ...(account.enabledApps || {}) };
      const newApps = { ...prevApps, ...updates };

      // Optimistic update
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, enabledApps: newApps } : a))
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
            settings: updates,
            app: appKey,
            enabled: updates[appKey],
            comailAccountId,
            comailAccountEmail,
          }),
        });

        if (!res.ok) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === account.id ? { ...a, enabledApps: prevApps } : a))
          );
        } else {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('google-services-updated', {
                detail: { accountId: account.id, settings: newApps },
              })
            );
            window.dispatchEvent(new CustomEvent('google-accounts-changed'));
          }
        }
      } catch {
        setAccounts((prev) =>
          prev.map((a) => (a.id === account.id ? { ...a, enabledApps: prevApps } : a))
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

  const handleUpdateMicrosoftAppSetting = useCallback(
    async (
      account: MicrosoftAccountConfigItem,
      updates: Partial<MicrosoftAccountAppToggles>
    ) => {
      const keys = Object.keys(updates);
      const appKey = keys[0] as keyof MicrosoftAccountAppToggles;
      const toggleKey = `ms-${account.id}-${appKey}`;
      setTogglingMap((prev) => ({ ...prev, [toggleKey]: true }));

      const prevApps = { ...(account.apps || {}) };
      const newApps = { ...prevApps, ...updates };

      setMicrosoftAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, apps: newApps } : a))
      );

      try {
        const res = await fetch('/api/auth/microsoft/toggle-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: account.id,
            email: account.email,
            settings: updates,
            app: appKey,
            enabled: updates[appKey],
          }),
        });

        if (!res.ok) {
          setMicrosoftAccounts((prev) =>
            prev.map((a) => (a.id === account.id ? { ...a, apps: prevApps } : a))
          );
        } else {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('microsoft-accounts-changed'));
            window.dispatchEvent(new CustomEvent('google-accounts-changed'));
          }
        }
      } catch {
        setMicrosoftAccounts((prev) =>
          prev.map((a) => (a.id === account.id ? { ...a, apps: prevApps } : a))
        );
      } finally {
        setTogglingMap((prev) => {
          const next = { ...prev };
          delete next[toggleKey];
          return next;
        });
      }
    },
    []
  );

  const confirmRemoveAccount = useCallback(async () => {
    if (!accountToRemove) return;
    const target = accountToRemove;
    setAccountToRemove(null);
    setRemovingId(target.id);

    try {
      if (target.provider === 'microsoft') {
        const res = await fetch('/api/auth/microsoft/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: target.id,
            email: target.email,
          }),
        });
        if (res.ok) {
          setMicrosoftAccounts((prev) => prev.filter((a) => a.id !== target.id));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('microsoft-accounts-changed'));
            window.dispatchEvent(new CustomEvent('google-accounts-changed'));
          }
        }
      } else {
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
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('google-accounts-changed'));
          }
        }
      }
    } catch {
      // ignore disconnect error
    } finally {
      setRemovingId(null);
    }
  }, [accountToRemove, comailAccountId, comailAccountEmail]);

  if (!isOpen) return null;

  const hasAnyAccounts = accounts.length > 0 || microsoftAccounts.length > 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 sm:p-6 md:p-8 animate-in fade-in duration-150">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          className="bg-background border border-border/80 rounded-2xl md:rounded-3xl shadow-2xl w-[94vw] max-w-4xl lg:max-w-5xl h-[88vh] max-h-[920px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 md:px-8 md:py-6 border-b border-border bg-muted/20 flex-shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 shadow-2xs">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 id={`${id}-title`} className="text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                  <span>{t('title')}</span>
                  {comailAccountLabel && (
                    <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-[240px]" title={comailAccountLabel}>
                      {comailAccountLabel}
                    </span>
                  )}
                </h2>
                <p id={`${id}-desc`} className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  {t('description')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
            {!configured && !microsoftConfigured && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">{t('not_configured')}</p>
                </div>
              </div>
            )}

            {loading && !hasAnyAccounts ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{tCommon('loading')}...</span>
              </div>
            ) : !hasAnyAccounts ? (
              /* Empty state */
              <div className="flex flex-col items-center text-center py-10 px-4 border border-dashed border-border rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center">
                    <GoogleIcon className="w-6 h-6" />
                  </div>
                  <div className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center">
                    <MicrosoftIcon className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t('empty_title')}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1.5 mb-5">
                  {t('empty_description')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    onClick={() => handleConnect()}
                    disabled={!configured}
                    className="gap-2"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    {t('add_account')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleConnectMicrosoft}
                    disabled={!microsoftConfigured}
                    className="gap-2"
                  >
                    <MicrosoftIcon className="w-4 h-4" />
                    {t('add_microsoft_account', { defaultValue: 'Connect Microsoft Account' })}
                  </Button>
                </div>
              </div>
            ) : (
              /* Connected external Google & Microsoft accounts */
              <div className="space-y-8">
                {/* Google Accounts Section */}
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
                      <GoogleIcon className="w-3.5 h-3.5" />
                      <Plus className="w-3.5 h-3.5" />
                      {t('add_another')}
                    </Button>
                  </div>

                  {accounts.length > 0 && (
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
                          <div className="p-5 md:px-6 md:py-5 bg-muted/30 border-b border-border flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <Avatar
                                src={acc.picture}
                                name={acc.name || acc.email}
                                email={acc.email}
                                size="md"
                                className="w-11 h-11 text-sm flex-shrink-0"
                                disableFavicon
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-base font-semibold text-foreground truncate">
                                    {acc.name || toUnicodeEmail(acc.email)}
                                  </p>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                                    <GoogleIcon className="w-3 h-3" />
                                    Google
                                  </span>
                                </div>
                                <p className="text-xs md:text-sm text-muted-foreground truncate font-mono mt-0.5">
                                  {toUnicodeEmail(acc.email)}
                                </p>
                              </div>
                            </div>

                            {/* Reconnect & Remove buttons */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConnect(acc.email)}
                                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
                                title={t('reconnect')}
                              >
                                <RefreshCw className="w-3.5 h-3.5 me-1.5" />
                                {t('reconnect')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setAccountToRemove({
                                    provider: 'google',
                                    id: acc.id,
                                    email: acc.email,
                                  })
                                }
                                className="h-9 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title={t('remove')}
                              >
                                <Trash2 className="w-3.5 h-3.5 me-1.5 text-destructive" />
                                <span className="text-destructive">{t('remove')}</span>
                              </Button>
                            </div>
                          </div>

                          {/* App Population Toggles */}
                          <div className="p-5 md:p-6 space-y-4">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {t('apps_heading')}
                            </div>

                            <GoogleAccountServicesConfig
                              accountEmail={acc.email}
                              values={acc.enabledApps || {}}
                              disabled={Boolean(
                                togglingMap[`${acc.id}-calendar`] ||
                                  togglingMap[`${acc.id}-tasks`] ||
                                  togglingMap[`${acc.id}-drive`] ||
                                  togglingMap[`${acc.id}-contacts`] ||
                                  togglingMap[`${acc.id}-gmail`]
                              )}
                              onChange={(updates) => handleUpdateAppSetting(acc, updates)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Microsoft Accounts Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Microsoft Accounts ({microsoftAccounts.length})
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleConnectMicrosoft}
                      disabled={!microsoftConfigured}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <MicrosoftIcon className="w-3.5 h-3.5" />
                      <Plus className="w-3.5 h-3.5" />
                      {t('add_microsoft_account', { defaultValue: 'Connect Microsoft Account' })}
                    </Button>
                  </div>

                  {microsoftAccounts.length > 0 && (
                    <div className="space-y-3">
                      {microsoftAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className={cn(
                            'border border-border rounded-xl overflow-hidden bg-card transition-shadow',
                            removingId === acc.id && 'opacity-50 pointer-events-none'
                          )}
                        >
                          {/* Account Card Header */}
                          <div className="p-5 md:px-6 md:py-5 bg-muted/30 border-b border-border flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <Avatar
                                name={acc.name || acc.email}
                                email={acc.email}
                                size="md"
                                className="w-11 h-11 text-sm flex-shrink-0"
                                disableFavicon
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-base font-semibold text-foreground truncate">
                                    {acc.name || toUnicodeEmail(acc.email)}
                                  </p>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                                    <MicrosoftIcon className="w-3 h-3" />
                                    Microsoft
                                  </span>
                                </div>
                                <p className="text-xs md:text-sm text-muted-foreground truncate font-mono mt-0.5">
                                  {toUnicodeEmail(acc.email)}
                                </p>
                              </div>
                            </div>

                            {/* Reconnect & Remove buttons */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConnectMicrosoft}
                                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
                                title={t('reconnect')}
                              >
                                <RefreshCw className="w-3.5 h-3.5 me-1.5" />
                                {t('reconnect')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setAccountToRemove({
                                    provider: 'microsoft',
                                    id: acc.id,
                                    email: acc.email,
                                  })
                                }
                                className="h-9 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title={t('remove')}
                              >
                                <Trash2 className="w-3.5 h-3.5 me-1.5 text-destructive" />
                                <span className="text-destructive">{t('remove')}</span>
                              </Button>
                            </div>
                          </div>

                          {/* App Population Toggles */}
                          <div className="p-5 md:p-6 space-y-4">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {t('apps_heading')}
                            </div>

                            <MicrosoftAccountServicesConfig
                              accountEmail={acc.email}
                              values={acc.apps || {}}
                              disabled={Boolean(
                                togglingMap[`ms-${acc.id}-calendar`] ||
                                  togglingMap[`ms-${acc.id}-tasks`] ||
                                  togglingMap[`ms-${acc.id}-onedrive`] ||
                                  togglingMap[`ms-${acc.id}-contacts`] ||
                                  togglingMap[`ms-${acc.id}-outlook`]
                              )}
                              onChange={(updates) => handleUpdateMicrosoftAppSetting(acc, updates)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
