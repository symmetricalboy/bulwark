'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { X, Mail, Pencil, Trash2, Plus, AlertTriangle, Star } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IdentityForm } from './identity-form';
import { useIdentityStore } from '@/stores/identity-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAccountStore } from '@/stores/account-store';
import { useSettingsStore } from '@/stores/settings-store';

function useSyncIdentities() {
  const syncIdentities = useAuthStore((state) => state.syncIdentities);
  return syncIdentities;
}

function useRefreshIdentities() {
  return useAuthStore((state) => state.refreshIdentities);
}
import type { Identity, EmailAddress } from '@/lib/jmap/types';
import { toast } from '@/stores/toast-store';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useConfig } from '@/hooks/use-config';
import { toUnicodeEmail } from '@/lib/idn';
import { getGoogleStatus } from '@/lib/google/google-calendar-client';
import { generateUUID } from '@/lib/utils';

function emailMatchesUsername(email: string, username: string): boolean {
  if (email === username) return true;
  if (!username.includes('@') && email.split('@')[0] === username) return true;
  return false;
}

interface IdentityFormData {
  name: string;
  email: string;
  replyTo?: EmailAddress[] | null;
  bcc?: EmailAddress[] | null;
  textSignature?: string | null;
  htmlSignature?: string | null;
}

interface IdentityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IdentityManagerModal({ isOpen, onClose }: IdentityManagerModalProps) {
  const t = useTranslations('identities');
  const tNotif = useTranslations('notifications');

  const client = useAuthStore((state) => state.client);
  const identities = useIdentityStore((state) => state.identities);
  const _preferredPrimaryId = useIdentityStore((state) => state.preferredPrimaryId);
  const setPreferredPrimary = useIdentityStore((state) => state.setPreferredPrimary);
  const syncIdentities = useSyncIdentities();
  // Identity management gate (chainlink #1790). When disabled (comail prod),
  // the Identities surface is read-only for the From-address: creation and
  // deletion of identities are hidden so a member cannot mint arbitrary
  // From-identities. Editing (display name + signature) stays available.
  const { identityManagementEnabled } = useConfig();

  const username = useAuthStore((state) => state.username);
  const storeGoogle = useIdentityStore((state) => state.googleDefaultIdentities);

  const fallbackEmails = useMemo(() => {
    return Array.from(new Set([
      ...(username ? [username.includes('@') ? username : `${username}@comail.at`] : []),
      ...identities.map(i => i.email),
      ...storeGoogle.map(g => g.email),
    ].filter(Boolean)));
  }, [username, identities, storeGoogle]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [availableEmails, setAvailableEmails] = useState<string[]>([]);
  const { dialogProps: confirmDialogProps, confirm: confirmDialog } = useConfirmDialog();

  const effectiveAvailableEmails = availableEmails.length > 0 ? availableEmails : fallbackEmails;

  // Re-fetch all identities from server and update stores
  const refreshIdentities = useCallback(async () => {
    try {
      const serverIdentities = client ? await client.getIdentities() : [];
      const username = useAuthStore.getState().username;
      const preferredPrimaryId = useIdentityStore.getState().preferredPrimaryId;

      // Ensure Comail primary default identity cannot be deleted
      const comailIdentities = serverIdentities.map((id, index) => ({
        ...id,
        mayDelete: index === 0 || emailMatchesUsername(id.email, username || '') ? false : id.mayDelete,
      }));

      // Fetch connected Google accounts
      let googleAccounts: Array<{ id: string; email: string; name?: string }> = [];
      try {
        const googleStatus = await getGoogleStatus();
        if (googleStatus.connected && googleStatus.accounts) {
          googleAccounts = googleStatus.accounts;
        }
      } catch {
        // fail-open if google status fetch fails
      }

      // Generate default identities for linked Google accounts (mayDelete: false)
      const googleOverrides = useIdentityStore.getState().googleDefaultIdentities || [];
      const googleDefaultIdentities: Identity[] = googleAccounts.map((acc) => {
        const id = `google-default:${acc.id || acc.email}`;
        const existing = googleOverrides.find((g) => g.id === id || g.email.toLowerCase() === acc.email.toLowerCase());
        return {
          id,
          name: existing?.name || acc.name || acc.email,
          email: acc.email,
          replyTo: existing?.replyTo,
          bcc: existing?.bcc,
          textSignature: existing?.textSignature,
          htmlSignature: existing?.htmlSignature,
          mayDelete: false,
          localAccountId: `google:${acc.id || acc.email}`,
          accountName: acc.name ? `${acc.name} (Google)` : `Google (${acc.email})`,
        };
      });
      useIdentityStore.getState().setGoogleDefaultIdentities(googleDefaultIdentities);

      // Custom identities created by the user
      const customIdentities = useIdentityStore.getState().customIdentities || [];

      // Collect all available account emails that users can recycle
      const allEmails = Array.from(
        new Set([
          ...(username ? [username.includes('@') ? username : `${username}@comail.at`] : []),
          ...comailIdentities.map((i) => i.email),
          ...googleAccounts.map((a) => a.email),
          ...customIdentities.map((c) => c.email),
        ].filter(Boolean))
      );
      setAvailableEmails(allEmails);

      const combined = [...comailIdentities, ...googleDefaultIdentities, ...customIdentities];

      const sorted = [...combined].sort((a, b) => {
        const aMatch = emailMatchesUsername(a.email, username || '');
        const bMatch = emailMatchesUsername(b.email, username || '');
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        if (aMatch && bMatch) {
          if (!a.mayDelete && b.mayDelete) return -1;
          if (a.mayDelete && !b.mayDelete) return 1;
        }
        return 0;
      });

      // Move preferred primary to front if set
      if (preferredPrimaryId) {
        const idx = sorted.findIndex((id) => id.id === preferredPrimaryId);
        if (idx > 0) {
          const [preferred] = sorted.splice(idx, 1);
          sorted.unshift(preferred);
        }
      }
      useIdentityStore.getState().setIdentities(sorted);
      syncIdentities();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh identities';
      toast.error(message);
    }
  }, [client, syncIdentities]);

  useEffect(() => {
    if (isOpen) {
      refreshIdentities();
    }
  }, [isOpen, refreshIdentities]);

  // Focus trap with Escape handling
  const modalRef = useFocusTrap({
    isActive: isOpen,
    onEscape: () => {
      if (isCreating || editingId) {
        setIsCreating(false);
        setEditingId(null);
      } else {
        onClose();
      }
    },
    restoreFocus: true,
  });

  // Close on click outside (but not when ConfirmDialog is open)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (confirmDialogProps.isOpen) return;
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, modalRef, confirmDialogProps.isOpen]);

  const handleCreate = useCallback(async (data: IdentityFormData) => {
    try {
      const googleStatus = await getGoogleStatus().catch(() => ({ connected: false, accounts: [] }));
      const googleAccounts = googleStatus.accounts || [];
      const isGoogleEmail = googleAccounts.some((a) => a.email.toLowerCase() === data.email.toLowerCase());

      if (isGoogleEmail) {
        const googleMatch = googleAccounts.find((a) => a.email.toLowerCase() === data.email.toLowerCase());
        const newIdentity: Identity = {
          id: `custom:${generateUUID()}`,
          name: data.name,
          email: data.email,
          replyTo: data.replyTo ?? undefined,
          bcc: data.bcc ?? undefined,
          textSignature: data.textSignature ?? undefined,
          htmlSignature: data.htmlSignature ?? undefined,
          mayDelete: true,
          localAccountId: googleMatch ? `google:${googleMatch.id}` : undefined,
          accountName: googleMatch ? (googleMatch.name ? `${googleMatch.name} (Google)` : `Google (${googleMatch.email})`) : undefined,
        };
        useIdentityStore.getState().addCustomIdentity(newIdentity);
      } else if (client && identityManagementEnabled) {
        try {
          await client.createIdentity(
            data.name,
            data.email,
            data.replyTo,
            data.bcc,
            data.textSignature,
            data.htmlSignature
          );
        } catch {
          // If server rejects custom identity, store as local custom identity
          const newIdentity: Identity = {
            id: `custom:${generateUUID()}`,
            name: data.name,
            email: data.email,
            replyTo: data.replyTo ?? undefined,
            bcc: data.bcc ?? undefined,
            textSignature: data.textSignature ?? undefined,
            htmlSignature: data.htmlSignature ?? undefined,
            mayDelete: true,
          };
          useIdentityStore.getState().addCustomIdentity(newIdentity);
        }
      } else {
        const newIdentity: Identity = {
          id: `custom:${generateUUID()}`,
          name: data.name,
          email: data.email,
          replyTo: data.replyTo ?? undefined,
          bcc: data.bcc ?? undefined,
          textSignature: data.textSignature ?? undefined,
          htmlSignature: data.htmlSignature ?? undefined,
          mayDelete: true,
        };
        useIdentityStore.getState().addCustomIdentity(newIdentity);
      }

      await refreshIdentities();
      setIsCreating(false);
      toast.success(tNotif('identity_created'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('validation_errors.unknown_error');
      toast.error(tNotif('identity_create_failed', { error: message }));
      throw error;
    }
  }, [client, identityManagementEnabled, refreshIdentities, t, tNotif]);

  const handleUpdate = useCallback(async (identity: Identity, data: IdentityFormData) => {
    try {
      if (identity.id.startsWith('custom:')) {
        useIdentityStore.getState().updateCustomIdentity(identity.id, {
          name: data.name,
          email: data.email,
          replyTo: data.replyTo ?? undefined,
          bcc: data.bcc ?? undefined,
          textSignature: data.textSignature ?? undefined,
          htmlSignature: data.htmlSignature ?? undefined,
        });
      } else if (identity.id.startsWith('google-default:')) {
        useIdentityStore.getState().updateIdentityLocal(identity.id, {
          name: data.name,
          replyTo: data.replyTo ?? undefined,
          bcc: data.bcc ?? undefined,
          textSignature: data.textSignature ?? undefined,
          htmlSignature: data.htmlSignature ?? undefined,
        });
      } else if (client) {
        await client.updateIdentity(identity.id, {
          name: data.name,
          replyTo: data.replyTo,
          bcc: data.bcc,
          textSignature: data.textSignature,
          htmlSignature: data.htmlSignature,
        });
      }

      await refreshIdentities();
      setEditingId(null);
      toast.success(tNotif('identity_updated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('validation_errors.unknown_error');
      toast.error(tNotif('identity_update_failed', { error: message }));
      throw error;
    }
  }, [client, refreshIdentities, t, tNotif]);

  const handleDelete = useCallback(async (identity: Identity) => {
    if (!identity.mayDelete) {
      toast.error(t('cannot_delete'));
      return;
    }

    const confirmed = await confirmDialog({
      title: t('delete_confirm_title'),
      message: t('delete_confirm'),
      confirmText: t('delete_button'),
      variant: "destructive",
    });
    if (!confirmed) return;

    setDeletingId(identity.id);

    try {
      if (identity.id.startsWith('custom:')) {
        useIdentityStore.getState().removeCustomIdentity(identity.id);
      } else if (client) {
        await client.deleteIdentity(identity.id);
      }
      await refreshIdentities();
      toast.success(tNotif('identity_deleted'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('validation_errors.unknown_error');
      toast.error(tNotif('identity_delete_failed', { error: message }));
    } finally {
      setDeletingId(null);
    }
  }, [client, refreshIdentities, t, tNotif, confirmDialog]);

  const handleSetPrimary = useCallback((identity: Identity) => {
    setPreferredPrimary(identity.id);
    // Persist the choice per account in the synced settings store so it
    // survives clearing site data, follows the user across devices, and shows
    // up in exported settings (issue #507). JMAP identity ids are account-
    // scoped, so the default is keyed by the active account.
    const activeAccountId = useAccountStore.getState().activeAccountId;
    if (activeAccountId) {
      const current = useSettingsStore.getState().preferredIdentityIds;
      useSettingsStore.getState().updateSetting('preferredIdentityIds', {
        ...current,
        [activeAccountId]: identity.id,
      });
    }
    // Re-sort: move the preferred identity to the front
    const reordered = [identity, ...identities.filter((id) => id.id !== identity.id)];
    useIdentityStore.getState().setIdentities(reordered);
    syncIdentities();
    toast.success(tNotif('identity_set_primary'));
  }, [identities, setPreferredPrimary, syncIdentities, tNotif]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-modal-title"
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-3xl max-h-[90vh] overflow-hidden',
          'animate-in zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <h2 id="identity-modal-title" className="text-lg font-semibold text-foreground">
              {t('modal_title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Create New Form — gated: members cannot mint arbitrary
              From-identities when identity management is disabled (#1790). */}
          {identityManagementEnabled && isCreating && (
            <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
              <h3 className="text-sm font-semibold mb-4">{t('create_new')}</h3>
              <IdentityForm
                availableEmails={effectiveAvailableEmails}
                onSave={handleCreate}
                onCancel={() => setIsCreating(false)}
              />
            </div>
          )}

          {/* Create Button — hidden when identity management is disabled. */}
          {identityManagementEnabled && !isCreating && !editingId && (
            <Button
              onClick={() => setIsCreating(true)}
              className="mb-6 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 me-2" />
              {t('create_new')}
            </Button>
          )}

          {/* Identities List */}
          <div className="space-y-4">
            {identities.map((identity) => (
              <div
                key={identity.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                {editingId === identity.id ? (
                  <div className="p-4 bg-muted/30">
                    <h3 className="text-sm font-semibold mb-4">
                      {t('edit_identity')}
                    </h3>
                    <IdentityForm
                      identity={identity}
                      availableEmails={effectiveAvailableEmails}
                      onSave={(data) => handleUpdate(identity, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {identity.name}
                          </h3>
                          {identities[0]?.id === identity.id && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {t('primary_identity')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {toUnicodeEmail(identity.email)}
                        </p>

                        {/* Additional Info */}
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {identity.replyTo && identity.replyTo.length > 0 && (
                            <p>
                              {t('display.reply_to')} {identity.replyTo.map((a) => toUnicodeEmail(a.email)).join(', ')}
                            </p>
                          )}
                          {identity.bcc && identity.bcc.length > 0 && (
                            <p>
                              {t('display.bcc')} {identity.bcc.map((a) => toUnicodeEmail(a.email)).join(', ')}
                            </p>
                          )}
                          {identity.textSignature && (
                            <p className="line-clamp-2">
                              {t('display.signature')} {identity.textSignature}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {identities[0]?.id !== identity.id && identities.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(identity)}
                            disabled={!!editingId || isCreating}
                            title={t('set_as_primary')}
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid="identity-edit"
                          onClick={() => setEditingId(identity.id)}
                          disabled={!!editingId || isCreating}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {/* Delete is hidden when identity management is
                            disabled (#1790): members may not remove the
                            relay-provisioned identities. */}
                        {identityManagementEnabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid="identity-delete"
                            onClick={() => handleDelete(identity)}
                            disabled={
                              !identity.mayDelete ||
                              !!editingId ||
                              isCreating ||
                              deletingId === identity.id
                            }
                            className={!identity.mayDelete ? 'opacity-30' : ''}
                          >
                            {!identity.mayDelete ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {identityManagementEnabled && !identity.mayDelete && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('cannot_delete')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {identities.length === 0 && !isCreating && (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('no_identities')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
