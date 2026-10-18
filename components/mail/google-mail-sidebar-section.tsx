"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Inbox,
  Send,
  File,
  Trash2,
  ShieldAlert,
  Star,
  Tag,
  ChevronDown,
  ChevronRight,
  GoogleIcon,
  Mail,
  LabelImportant,
  CalendarClock,
  Archive,
  Layers,
  Settings,
} from '@/components/icons';
import { cn, formatCountBadge, ROLE_PRIORITY } from '@/lib/utils';
import type { Mailbox } from '@/lib/jmap/types';
import type { GoogleMailAccountData } from '@/hooks/use-google-mail';
import { useSettingsStore, isMailboxHidden } from '@/stores/settings-store';
import { localizeMailboxName } from '@/lib/mailbox-label';
import { isGmailStarLabel, GMAIL_STARS, type GmailStarId } from '@/lib/google/gmail-stars';
import { isIgnoredGoogleLabel } from '@/lib/google/gmail-mapper';
import { withBasePath } from '@/lib/browser-navigation';

interface GoogleMailSidebarSectionProps {
  accountsData: GoogleMailAccountData[];
  selectedMailbox: string;
  onMailboxSelect: (mailboxId: string) => void;
  onAccountSettings?: (accountEmail: string) => void;
  isCollapsed?: boolean;
}

export function GoogleMailSidebarSection({
  accountsData,
  selectedMailbox,
  onMailboxSelect,
  onAccountSettings,
  isCollapsed = false,
}: GoogleMailSidebarSectionProps) {
  const tCommon = useTranslations('common');
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});
  const [collapsedStars, setCollapsedStars] = useState<Record<string, boolean>>({});
  const hiddenFolderIds = useSettingsStore((s) => s.hiddenFolderIds);
  const colorfulSidebarIcons = useSettingsStore((s) => s.colorfulSidebarIcons);
  const googleStarsSubmenuEnabled = useSettingsStore((s) => s.googleStarsSubmenuEnabled);
  const googleHiddenStarIds = useSettingsStore((s) => s.googleHiddenStarIds);

  if (accountsData.length === 0) return null;

  const toggleAccount = (email: string) => {
    setCollapsedAccounts((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  const getMailboxIcon = (mb: Mailbox, isSelected: boolean) => {
    const iconClass = (colorClass: string) =>
      cn(
        "w-4 h-4 flex-shrink-0 transition-colors",
        colorfulSidebarIcons ? colorClass : isSelected ? "text-accent-foreground" : "text-foreground/80"
      );

    switch (mb.role) {
      case 'inbox':
        return <Inbox className={iconClass("text-blue-500")} />;
      case 'starred':
        return <Star className={iconClass("text-yellow-500")} />;
      case 'unread':
        return <Mail className={iconClass("text-lime-500")} />;
      case 'important':
        return <LabelImportant className={iconClass("text-pink-500")} />;
      case 'drafts':
        return <File className={iconClass("text-purple-500")} />;
      case 'scheduled':
        return <CalendarClock className={iconClass("text-cyan-500")} />;
      case 'sent':
        return <Send className={iconClass("text-green-500")} />;
      case 'archive':
        return <Archive className={iconClass("text-orange-500")} />;
      case 'junk':
      case 'spam':
        return <ShieldAlert className={iconClass("text-red-500")} />;
      case 'trash':
        return <Trash2 className={iconClass("text-gray-500")} />;
      case 'all':
      case 'all_mail':
        return <Layers className={iconClass("text-indigo-500")} />;
      default:
        return <Tag className={cn("w-4 h-4 flex-shrink-0", isSelected ? "text-accent-foreground" : "text-muted-foreground")} />;
    }
  };

  return (
    <div className="pt-2 pb-1 border-t border-border/40">
      {accountsData.map(({ account, mailboxes }) => {
        const isAccCollapsed = Boolean(collapsedAccounts[account.email]);

        return (
          <div key={account.id || account.email} className="mb-2 last:mb-0">
            {/* Account Header */}
            {!isCollapsed ? (
              <div
                data-section-name={account.email}
                className={cn(
                  "group flex items-center py-1.5 px-2.5 mx-2 w-[calc(100%-16px)] select-none rounded-lg border shadow-xs transition-colors",
                  "bg-accent/40 hover:bg-accent/60 border-accent/40 text-foreground dark:bg-accent/25 dark:hover:bg-accent/40 dark:border-accent/35"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleAccount(account.email)}
                  data-folder-btn=""
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent focus:outline-none"
                  title={account.email}
                >
                  <span className="text-muted-foreground/70 group-hover:text-foreground transition-transform flex-shrink-0">
                    {isAccCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center bg-background/60 flex-shrink-0 shadow-2xs border border-border/40">
                    <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  </span>
                  <span className="text-xs font-semibold text-foreground tracking-tight truncate ms-1">
                    {account.email}
                  </span>
                </button>
                {onAccountSettings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccountSettings(account.email);
                    }}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-opacity flex-shrink-0"
                    title={tCommon('settings')}
                    aria-label={`Settings for ${account.email}`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <GoogleIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            )}

            {/* Account Mailboxes */}
            {!isAccCollapsed && (
              <div className="mt-0.5 space-y-0.5">
                {(() => {
                  const visibleMailboxes = mailboxes.filter(
                    (mb) =>
                      !isIgnoredGoogleLabel(mb.id) &&
                      !isIgnoredGoogleLabel(mb.originalId) &&
                      !isIgnoredGoogleLabel(mb.name) &&
                      !isGmailStarLabel(mb) &&
                      (!isMailboxHidden(mb.id, hiddenFolderIds) || mb.id === selectedMailbox)
                  );

                  visibleMailboxes.sort((a, b) => {
                    if (a.sortOrder !== b.sortOrder && a.sortOrder && b.sortOrder) {
                      return a.sortOrder - b.sortOrder;
                    }
                    const aPriority = a.role ? (ROLE_PRIORITY[a.role] ?? 999) : 999;
                    const bPriority = b.role ? (ROLE_PRIORITY[b.role] ?? 999) : 999;
                    if (aPriority !== bPriority) {
                      return aPriority - bPriority;
                    }
                    const aIsYear = /^\d{4}$/.test(a.name);
                    const bIsYear = /^\d{4}$/.test(b.name);
                    if (aIsYear && bIsYear) {
                      return parseInt(b.name) - parseInt(a.name);
                    }
                    return a.name.localeCompare(b.name);
                  });

                  return visibleMailboxes.length === 0 ? (
                    <div className="px-6 py-1 text-xs text-muted-foreground italic">
                      {!isCollapsed && tCommon('loading')}
                    </div>
                  ) : (
                    visibleMailboxes.map((mb) => {
                      const isSelected = selectedMailbox === mb.id;
                      const isUnsent = mb.role === 'drafts' || mb.role === 'scheduled';
                      const unread = mb.unreadEmails || 0;
                      const total = mb.totalEmails || 0;
                      const count = isUnsent ? (total || unread) : unread;
                      const displayName = localizeMailboxName(mb.role, mb.name, (k) => tCommon(`sidebar.mailboxes.${k}`));

                      return (
                        <div
                          key={mb.id}
                          data-testid="folder-row"
                          data-selected={isSelected ? 'true' : undefined}
                          className={cn(
                            "group flex items-center max-lg:min-h-[44px] text-sm transition-colors duration-150 relative",
                            isCollapsed
                              ? "w-full justify-center px-1"
                              : "mx-2 w-[calc(100%-16px)] rounded-md pe-0",
                            isSelected
                              ? "bg-accent text-accent-foreground font-semibold hover:bg-accent/80"
                              : "hover:bg-muted/50 text-foreground"
                          )}
                        >
                          {!isCollapsed && (
                            <div
                              className="flex items-center flex-shrink-0"
                              style={{ paddingLeft: 8 }}
                            >
                              <div style={{ width: 20 }} aria-hidden />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => onMailboxSelect(mb.id)}
                            data-folder-btn=""
                            className={cn(
                              "flex items-center gap-2 min-w-0 transition-colors bg-transparent hover:bg-transparent",
                              isCollapsed ? "justify-center" : "flex-1 text-start",
                              isSelected ? "text-accent-foreground" : ""
                            )}
                            title={isCollapsed ? displayName : undefined}
                          >
                            <span className={cn("flex items-center justify-center flex-shrink-0 w-4 h-4", isSelected && "text-accent-foreground")}>
                              {getMailboxIcon(mb, isSelected)}
                            </span>
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 truncate">{displayName}</span>
                                {count > 0 && (
                                  <span
                                    className="ms-auto flex-shrink-0 flex items-center justify-center w-[72px]"
                                    style={{ width: 72 }}
                                    data-testid="folder-counts"
                                    data-unread={isUnsent ? 0 : count}
                                    data-total={isUnsent ? count : 0}
                                  >
                                    <span
                                      className={cn(
                                        "text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums min-w-5 h-5 flex items-center justify-center transition-colors",
                                        isSelected
                                          ? "bg-accent-foreground/15 text-accent-foreground"
                                          : isUnsent
                                            ? "bg-muted/60 text-muted-foreground font-normal"
                                            : "bg-muted text-muted-foreground"
                                      )}
                                    >
                                      {formatCountBadge(count)}
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  );
                })()}

                {/* Optional Stars Submenu */}
                {(() => {
                  const isStarsEnabled = Boolean(googleStarsSubmenuEnabled?.[account.email]);
                  if (!isStarsEnabled) return null;
                  const isStarsCollapsed = Boolean(collapsedStars[account.email]);
                  const hiddenStars = googleHiddenStarIds?.[account.email] || [];
                  const visibleStars = (Object.keys(GMAIL_STARS) as GmailStarId[])
                    .map((id) => GMAIL_STARS[id])
                    .filter((s) => !hiddenStars.includes(s.id));

                  return (
                    <div className="mt-1 pt-1 border-t border-border/30">
                      <div className="flex items-center px-2 py-1 mx-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        <button
                          type="button"
                          onClick={() => setCollapsedStars((prev) => ({ ...prev, [account.email]: !prev[account.email] }))}
                          className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent"
                        >
                          {isStarsCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                          <span className="truncate">Stars</span>
                        </button>
                      </div>

                      {!isStarsCollapsed && (
                        <div className="space-y-0.5">
                          {visibleStars.map((star) => {
                            const starMailboxId = `google:${account.email}::star:${star.id}`;
                            const isSelected = selectedMailbox === starMailboxId;

                            return (
                              <div
                                key={star.id}
                                data-testid="folder-row"
                                data-selected={isSelected ? 'true' : undefined}
                                className={cn(
                                  "group flex items-center max-lg:min-h-[44px] text-sm transition-colors duration-150 relative",
                                  isCollapsed ? "w-full justify-center px-1" : "mx-2 w-[calc(100%-16px)] rounded-md pe-0",
                                  isSelected
                                    ? "bg-accent text-accent-foreground font-semibold hover:bg-accent/80"
                                    : "hover:bg-muted/50 text-foreground"
                                )}
                              >
                                {!isCollapsed && (
                                  <div className="flex items-center flex-shrink-0" style={{ paddingLeft: 8 }}>
                                    <div style={{ width: 20 }} aria-hidden />
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onMailboxSelect(starMailboxId)}
                                  data-folder-btn=""
                                  className={cn(
                                    "flex items-center gap-2 min-w-0 transition-colors bg-transparent hover:bg-transparent",
                                    isCollapsed ? "justify-center" : "flex-1 text-start",
                                    isSelected ? "text-accent-foreground" : ""
                                  )}
                                  title={isCollapsed ? star.name : undefined}
                                >
                                  <span className="flex items-center justify-center flex-shrink-0 w-4 h-4">
                                    <img src={withBasePath(star.iconPath)} alt={star.name} className="w-4 h-4 object-contain" />
                                  </span>
                                  {!isCollapsed && <span className="flex-1 truncate">{star.name}</span>}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
