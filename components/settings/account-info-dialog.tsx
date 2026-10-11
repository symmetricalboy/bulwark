"use client";

import { useEffect, useState, useId, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { Avatar } from '@/components/ui/avatar';
import { AtprotoHandle } from '@/components/ui/atproto-handle';
import { Button } from '@/components/ui/button';
import {
  X,
  Server,
  Mail,
  User,
  Shield,
  HardDrive,
  Check,
  AlertCircle,
  Star,
  Clock,
  Globe,
  Key,
  Info,
} from '@/components/icons';
import { useAccountStore, type AccountEntry } from '@/stores/account-store';
import { formatFileSize, cn } from '@/lib/utils';
import { toUnicodeDomain, toUnicodeEmail } from '@/lib/idn';
import { resolveAtprotoProfile, resolveConnectedAtprotoDid, resolveAtprotoPds } from '@/lib/atproto-avatar';

interface AccountInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountEntry | null;
  isActive: boolean;
  quota?: { used: number; total: number } | null;
  isDemoMode?: boolean;
}

function hostnameOf(serverUrl: string): string {
  try {
    return toUnicodeDomain(new URL(serverUrl).hostname);
  } catch {
    return serverUrl;
  }
}

export function AccountInfoDialog({
  isOpen,
  onClose,
  account,
  isActive,
  quota,
  isDemoMode,
}: AccountInfoDialogProps) {
  const t = useTranslations('settings.account');
  const tCommon = useTranslations('common');
  const id = useId();

  const [atprotoCreatedAt, setAtprotoCreatedAt] = useState<string | null>(null);
  const [atprotoPds, setAtprotoPds] = useState<string | null>(null);
  const [isLoadingPds, setIsLoadingPds] = useState(false);
  const [currentDid, setCurrentDid] = useState<string | null>(account?.did ?? null);

  const dialogRef = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
    restoreFocus: true,
  });

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

  useEffect(() => {
    if (!account) {
      setCurrentDid(null);
      setAtprotoCreatedAt(null);
      setAtprotoPds(null);
      setIsLoadingPds(false);
      return;
    }
    const initialDid = account.did ?? null;
    setCurrentDid(initialDid);
    setAtprotoCreatedAt(null);
    setAtprotoPds(null);
    let cancelled = false;

    if (initialDid) {
      setIsLoadingPds(true);
      void resolveAtprotoPds(initialDid).then((pds) => {
        if (!cancelled) {
          setAtprotoPds(pds);
          setIsLoadingPds(false);
        }
      }).catch(() => {
        if (!cancelled) setIsLoadingPds(false);
      });
      void resolveAtprotoProfile(initialDid).then((profile) => {
        if (!cancelled && profile?.createdAt) {
          setAtprotoCreatedAt(profile.createdAt);
        }
      }).catch(() => {});
    }

    // Auto-resolve connected atproto DID if missing or upgradeable to spaces DID
    resolveConnectedAtprotoDid(account).then((did) => {
      if (cancelled || !did) return;
      setCurrentDid(did);
      if (account.id && account.did !== did) {
        useAccountStore.getState().updateAccount(account.id, { did });
      }
      void resolveAtprotoProfile(did).then((profile) => {
        if (!cancelled && profile?.createdAt) {
          setAtprotoCreatedAt(profile.createdAt);
        }
      }).catch(() => {});
      if (did !== initialDid) {
        setIsLoadingPds(true);
        void resolveAtprotoPds(did).then((pds) => {
          if (!cancelled) {
            setAtprotoPds(pds);
            setIsLoadingPds(false);
          }
        }).catch(() => {
          if (!cancelled) setIsLoadingPds(false);
        });
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.did]);

  const creationTime = useMemo(() => {
    if (atprotoCreatedAt) {
      const parsed = Date.parse(atprotoCreatedAt);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (account?.createdAt && account.createdAt > 0) {
      return account.createdAt;
    }
    if (account?.lastLoginAt && account.lastLoginAt > 0) {
      return account.lastLoginAt;
    }
    return Date.now();
  }, [atprotoCreatedAt, account?.createdAt, account?.lastLoginAt]);

  const accountAge = useMemo(() => {
    const createdDate = new Date(creationTime);
    const now = new Date();

    const tooltip = createdDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays < 1) {
      return { label: t('age_today'), tooltip };
    }

    let years = now.getFullYear() - createdDate.getFullYear();
    let months = now.getMonth() - createdDate.getMonth();
    let days = now.getDate() - createdDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonthDays;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years >= 1) {
      if (months >= 1) {
        return {
          label: t('age_years_months', { years, months }),
          tooltip,
        };
      }
      return {
        label: t('age_years', { count: years }),
        tooltip,
      };
    }

    if (months >= 1) {
      return {
        label: t('age_months', { count: months }),
        tooltip,
      };
    }

    return {
      label: t('age_days', { count: Math.max(1, diffDays) }),
      tooltip,
    };
  }, [creationTime, t]);

  if (!isOpen || !account) return null;

  const displayName = account.displayName || account.label || (isDemoMode && isActive ? 'Demo User' : undefined);
  const email = account.email || account.username;
  const quotaPercentage =
    isActive && quota && quota.total > 0
      ? Math.min(Math.round((quota.used / quota.total) * 100), 100)
      : 0;

  const authMethodLabel =
    account.authMode === 'oauth'
      ? t('auth_method_oauth')
      : account.authMode === 'token'
      ? t('auth_method_token')
      : t('auth_method_basic');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <Avatar
              name={account.displayName || account.label}
              email={account.email || account.username}
              did={currentDid ?? account.did}
              size="sm"
              className="w-9 h-9 text-sm"
              disableFavicon
              fallbackColor={account.avatarColor}
            />
            <div>
              <h2 id={`${id}-title`} className="text-base font-semibold text-foreground">
                {t('info_dialog_title')}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-xs">
                <span>{account.displayName || account.label}</span>
                {(currentDid ?? account.did) && (
                  <>
                    <span>•</span>
                    <AtprotoHandle did={currentDid ?? account.did} className="text-xs text-muted-foreground" />
                  </>
                )}
              </div>
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

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center gap-2">
              {account.hasError ? (
                <>
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="text-xs font-medium text-destructive">
                    {account.errorMessage || t('status_error')}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      account.isConnected ? 'bg-green-500' : 'bg-muted-foreground/50'
                    )}
                  />
                  <span className="text-xs font-medium text-foreground">
                    {account.isConnected ? t('status_connected') : t('status_disconnected')}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {account.isDefault && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Star className="w-3 h-3 fill-amber-500" />
                  {t('accounts.default_badge')}
                </span>
              )}
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <Check className="w-3 h-3" />
                  {t('accounts.active')}
                </span>
              )}
            </div>
          </div>

          {/* Details table */}
          <div className="divide-y divide-border/60">
            {/* Display Name */}
            <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                <User className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{t('name_label')}</span>
              </div>
              <span className="text-sm font-medium text-foreground text-end truncate max-w-[260px] sm:max-w-xs">
                {displayName || tCommon('unknown')}
              </span>
            </div>

            {/* Email Address */}
            <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                <Mail className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{t('email.label')}</span>
              </div>
              <span className="text-sm font-medium text-foreground text-end truncate max-w-[260px] sm:max-w-xs">
                {email ? toUnicodeEmail(email) : tCommon('unknown')}
              </span>
            </div>

            {/* Username / Login (when distinct) */}
            {account.username && account.username !== email && (
              <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{t('username_label')}</span>
                </div>
                <span className="text-sm font-medium text-foreground text-end truncate max-w-[260px] sm:max-w-xs">
                  {toUnicodeEmail(account.username)}
                </span>
              </div>
            )}

            {/* Account Age */}
            <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{t('account_age_label')}</span>
              </div>
              <span
                className="text-sm font-medium text-foreground text-end truncate max-w-[260px] sm:max-w-xs"
                title={accountAge.tooltip}
              >
                {accountAge.label}
              </span>
            </div>

            {/* ATProto Handle */}
            <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                <Globe className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">ATProto Handle</span>
              </div>
              {currentDid ? (
                <AtprotoHandle did={currentDid} className="text-sm font-medium text-foreground text-end" />
              ) : (
                <span className="text-sm text-muted-foreground">Not connected</span>
              )}
            </div>

            {/* ATProto DID */}
            {currentDid && (
              <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                  <Key className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">ATProto DID</span>
                </div>
                <span
                  className="text-xs sm:text-sm font-mono text-foreground text-end select-all truncate max-w-[260px] sm:max-w-xs"
                  title={currentDid}
                >
                  {currentDid}
                </span>
              </div>
            )}

            {/* PDS Host */}
            {currentDid && (
              <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                  <Server className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">PDS Host</span>
                </div>
                <span
                  className="text-xs sm:text-sm font-mono text-foreground text-end select-all truncate max-w-[260px] sm:max-w-xs"
                  title={atprotoPds || undefined}
                >
                  {atprotoPds || (isLoadingPds ? '...' : '—')}
                </span>
              </div>
            )}

            {/* Authentication Method */}
            <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                <Shield className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{t('auth_method_label')}</span>
              </div>
              <span className="text-sm font-medium text-foreground text-end">
                {authMethodLabel}
              </span>
            </div>

            {/* JMAP Server */}
            <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                <Server className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{t('server.label')}</span>
              </div>
              <span
                className="text-sm font-medium text-foreground text-end truncate max-w-[260px] sm:max-w-xs"
                title={account.serverUrl}
              >
                {hostnameOf(account.serverUrl)}
              </span>
            </div>

            {/* Storage Quota (for active account when available) */}
            {isActive && quota && quota.total > 0 && (
              <div className="py-3 last:pb-0 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                    <HardDrive className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{t('storage.label')}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground text-end">
                    {t('storage.used', {
                      used: formatFileSize(quota.used),
                      total: formatFileSize(quota.total),
                    })}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      quotaPercentage > 90
                        ? 'bg-destructive'
                        : quotaPercentage > 75
                        ? 'bg-amber-500'
                        : 'bg-primary'
                    )}
                    style={{ width: `${quotaPercentage}%` }}
                  />
                </div>
                <div className="flex justify-end">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('storage.percentage', { percent: quotaPercentage })}
                  </span>
                </div>
              </div>
            )}

            {/* Demo Account Indicator */}
            {isDemoMode && isActive && (
              <div className="py-3 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground flex-shrink-0">
                  <Info className="w-4 h-4 text-muted-foreground/80 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{t('account_type_label')}</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {t('demo_account')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
