"use client";

import { useState, useEffect, useCallback, useId } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { GoogleIcon, Check, X, ShieldCheck } from '@/components/icons';
import { GoogleAccountServicesConfig } from './google-account-services-config';
import {
  type LinkedGoogleAccountPublic,
  type GoogleAccountAppToggles,
  DEFAULT_GOOGLE_APP_TOGGLES,
} from '@/lib/google/types';
import { toUnicodeEmail } from '@/lib/idn';
import { toast } from '@/stores/toast-store';

export function GoogleAccountOnboardingModal() {
  const t = useTranslations('settings.account.linked_accounts');
  const id = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [account, setAccount] = useState<LinkedGoogleAccountPublic | null>(null);
  const [servicesValues, setServicesValues] = useState<GoogleAccountAppToggles>({
    ...DEFAULT_GOOGLE_APP_TOGGLES,
  });
  const [isSaving, setIsSaving] = useState(false);

  const cleanUrlParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    let changed = false;
    ['google_connected', 'google_account_id', 'google_account_email'].forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    cleanUrlParams();
  }, [cleanUrlParams]);

  const dialogRef = useFocusTrap({
    isActive: isOpen,
    onEscape: handleClose,
    restoreFocus: true,
  });

  // Check URL on mount and search param changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkUrlForOnboarding = async () => {
      const url = new URL(window.location.href);
      const isConnectedParam = url.searchParams.get('google_connected');
      const accountIdParam = url.searchParams.get('google_account_id');
      const accountEmailParam = url.searchParams.get('google_account_email');

      if (isConnectedParam === 'true') {
        try {
          const res = await fetch('/api/auth/google/status');
          if (res.ok) {
            const data = await res.json();
            const matchedAccount =
              (data.accounts as LinkedGoogleAccountPublic[])?.find(
                (a) =>
                  a.id === accountIdParam ||
                  a.email.toLowerCase() === accountEmailParam?.toLowerCase() ||
                  (accountIdParam && a.id.includes(accountIdParam))
              ) ||
              data.accounts?.[0] ||
              (data.email ? { id: data.email, email: data.email, name: data.name, picture: data.picture, enabledApps: { ...DEFAULT_GOOGLE_APP_TOGGLES }, connectedAt: Date.now() } : null);

            if (matchedAccount) {
              setAccount(matchedAccount);
              setServicesValues({
                ...DEFAULT_GOOGLE_APP_TOGGLES,
                ...(matchedAccount.enabledApps || {}),
              });
              setIsOpen(true);
            }
          }
        } catch (err) {
          console.error('Failed to load Google account status for onboarding:', err);
        }
      }
    };

    void checkUrlForOnboarding();
  }, []);

  const handleServicesChange = (updates: Partial<GoogleAccountAppToggles>) => {
    setServicesValues((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleSave = async () => {
    if (!account) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/auth/google/toggle-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          settings: servicesValues,
          comailAccountId: account.comailAccountId,
          comailAccountEmail: account.comailAccountEmail,
        }),
      });

      if (res.ok) {
        toast.success(t('onboarding.title') + ': Preferences saved');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('google-services-updated', { detail: { accountId: account.id, settings: servicesValues } }));
        }
        handleClose();
      } else {
        toast.error('Failed to save service preferences');
      }
    } catch (err) {
      console.error('Failed to save Google account services:', err);
      toast.error('Network error saving preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !account) return null;

  return (
    <div
      data-google-onboarding-dialog="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative">
              <Avatar
                src={account.picture}
                name={account.name || account.email}
                email={account.email}
                size="md"
                className="w-12 h-12 text-sm"
                disableFavicon
              />
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-xs border border-border">
                <GoogleIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 id={`${id}-title`} className="text-lg font-bold text-foreground">
                {t('onboarding.title')}
              </h2>
              <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                {toUnicodeEmail(account.email)}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-flex">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Strictly opt-in: all services disabled by default</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle instructions */}
        <div className="px-6 pt-4 pb-2">
          <p id={`${id}-desc`} className="text-xs text-muted-foreground">
            {t('onboarding.subtitle')}
          </p>
        </div>

        {/* Services configuration form */}
        <div className="px-6 py-2 overflow-y-auto flex-1">
          <GoogleAccountServicesConfig
            accountEmail={account.email}
            values={servicesValues}
            disabled={isSaving}
            onChange={handleServicesChange}
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSaving}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('onboarding.skip')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 text-xs font-medium px-4"
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : t('onboarding.save_and_continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
