"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Folder, Tag, Layers, Star, Plus, Eye, EyeOff, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore, isMailboxHidden } from '@/stores/settings-store';
import { GMAIL_STARS, type GmailStarId, isGmailStarLabel } from '@/lib/google/gmail-stars';
import { isGoogleSystemFolder, isGoogleCategoryLabel, isIgnoredGoogleLabel } from '@/lib/google/gmail-mapper';
import { createGoogleLabel } from '@/lib/google/google-mail-client';
import { localizeMailboxName } from '@/lib/mailbox-label';
import type { Mailbox } from '@/lib/jmap/types';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/utils';
import { withBasePath } from '@/lib/browser-navigation';

export interface GoogleAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountEmail: string;
  mailboxes: Mailbox[];
  onMailboxesUpdated?: () => void;
}

export function GoogleAccountSettingsModal({
  isOpen,
  onClose,
  accountEmail,
  mailboxes,
  onMailboxesUpdated,
}: GoogleAccountSettingsModalProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'folders' | 'stars'>('folders');
  const [newLabelName, setNewLabelName] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  const hiddenFolderIds = useSettingsStore((s) => s.hiddenFolderIds);
  const toggleFolderHidden = useSettingsStore((s) => s.toggleFolderHidden);
  const googleStarsSubmenuEnabled = useSettingsStore((s) => s.googleStarsSubmenuEnabled);
  const setGoogleStarsSubmenuEnabled = useSettingsStore((s) => s.setGoogleStarsSubmenuEnabled);
  const googleHiddenStarIds = useSettingsStore((s) => s.googleHiddenStarIds);
  const toggleGoogleStarHidden = useSettingsStore((s) => s.toggleGoogleStarHidden);

  if (!isOpen) return null;

  const isStarsEnabled = Boolean(googleStarsSubmenuEnabled?.[accountEmail]);
  const hiddenStars = googleHiddenStarIds?.[accountEmail] || [];

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLabelName.trim();
    if (!trimmed) return;

    setIsCreatingLabel(true);
    try {
      await createGoogleLabel(trimmed, accountEmail);
      toast.success(tCommon('success') || 'Label created successfully');
      setNewLabelName('');
      onMailboxesUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create label');
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const accountMailboxes = mailboxes.filter(
    (mb) =>
      !isGmailStarLabel(mb) &&
      !isIgnoredGoogleLabel(mb.id) &&
      !isIgnoredGoogleLabel(mb.originalId) &&
      !isIgnoredGoogleLabel(mb.name)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              Google Account Settings
            </h2>
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-md bg-muted truncate">
              {accountEmail}
            </span>
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

        {/* Tab switcher */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTab('folders')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              activeTab === 'folders'
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Folders & Labels</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stars')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              activeTab === 'stars'
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className="w-3.5 h-3.5 text-yellow-500" />
            <span>Gmail Stars (12 Stars)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-scroll [scrollbar-gutter:stable] p-6 space-y-6">
          {activeTab === 'folders' && (
            <div className="space-y-6">
              {/* Create new label */}
              <div className="p-4 rounded-lg bg-muted/40 border border-border/60">
                <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Create New Gmail Label
                </h3>
                <form onSubmit={handleCreateLabel} className="flex gap-2">
                  <Input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="e.g. Work, Receipts, Travel"
                    className="h-8 text-xs flex-1"
                    disabled={isCreatingLabel}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreatingLabel || !newLabelName.trim()}
                    className="h-8 text-xs"
                  >
                    {isCreatingLabel ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </Button>
                </form>
              </div>

              {/* Mailbox visibility list */}
              <div>
                <h3 className="text-xs font-semibold text-foreground mb-2">
                  Folder & Label Visibility
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Toggle visibility to hide system folders, categories, or labels from your sidebar.
                </p>

                <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
                  {accountMailboxes.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      No folders found for this account.
                    </div>
                  ) : (
                    accountMailboxes.map((mb) => {
                      const hidden = isMailboxHidden(mb.id, hiddenFolderIds);
                      const isSys = isGoogleSystemFolder(mb);
                      const isCat = isGoogleCategoryLabel(mb.originalId || mb.id || mb.role);
                      const displayName = localizeMailboxName(mb.role, mb.name, (k) => tCommon(`sidebar.mailboxes.${k}`));

                      return (
                        <div
                          key={mb.id}
                          className="flex items-center justify-between p-2.5 bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isCat ? (
                              <Layers className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            ) : isSys ? (
                              <Folder className="w-4 h-4 text-primary flex-shrink-0" />
                            ) : (
                              <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className={cn("text-xs font-medium truncate", hidden && "line-through text-muted-foreground")}>
                              {displayName}
                            </span>
                            {isSys && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                System
                              </span>
                            )}
                            {isCat && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                Category
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleFolderHidden(mb.id)}
                            className={cn(
                              "p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors",
                              hidden
                                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                : "text-foreground hover:bg-muted"
                            )}
                            title={hidden ? "Show in sidebar" : "Hide from sidebar"}
                          >
                            {hidden ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Hidden</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px]">Visible</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stars' && (
            <div className="space-y-6">
              {/* Enable / disable toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border/60">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">
                    Enable 12 Stars Submenu
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show a collapsible &quot;Stars&quot; submenu under this account in the sidebar to browse messages by star color.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isStarsEnabled}
                  onChange={(e) => setGoogleStarsSubmenuEnabled(accountEmail, e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Per-star list */}
              {isStarsEnabled && (
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-2">
                    Visible Stars
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Choose which of the 12 Gmail star symbols appear in the sidebar submenu.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(GMAIL_STARS) as GmailStarId[]).map((starId) => {
                      const star = GMAIL_STARS[starId];
                      const isHidden = hiddenStars.includes(starId);

                      return (
                        <div
                          key={starId}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={withBasePath(star.iconPath)}
                              alt={star.name}
                              className="w-4 h-4 object-contain flex-shrink-0"
                            />
                            <span className="text-xs font-medium text-foreground truncate">
                              {star.name}
                            </span>
                          </div>

                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => toggleGoogleStarHidden(accountEmail, starId)}
                              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                            />
                            <span className="text-[11px] text-muted-foreground">
                              {!isHidden ? 'Visible' : 'Hidden'}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-border bg-muted/20">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
