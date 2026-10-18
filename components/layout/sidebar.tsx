"use client";

import { useState, useEffect, useMemo, useCallback, Fragment, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PluginSlot } from "@/components/plugins/plugin-slot";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Send,
  File,
  Star,
  Trash2,
  Archive,
  Ban,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Folder,
  FolderOpen,
  User,
  Users,
  Palmtree,
  Settings,
  X,
  RotateCcw,
  Tag,
  FlaskConical,
  PlayCircle,
  Loader2,
  AlertTriangle,
  LabelImportant,
  NotebookPen,
  Pencil,
  Plus,
  CalendarClock,
  BellOff,
  Mail,
  Mails,
  MailOpen,
  MoreHorizontal,
  Layers,
  MessageSquare,
  GoogleIcon,
  MicrosoftIcon,
} from "@/components/icons";
import { cn, buildMailboxTree, MailboxNode, applyCustomOrder, filterVisibleMailboxTree, formatCountBadge } from "@/lib/utils";
import { localizeMailboxName } from "@/lib/mailbox-label";
import {
  buildKeywordTree,
  countKeywordNodes,
  filterKeywordTree,
  hasChildKeywords,
  type KeywordNode,
} from "@/lib/keyword-nesting";
import { useShortenedText } from "@/hooks/use-shortened-text";
import { useKeywordFormat } from "@/hooks/use-keyword-format";
import { isEditableEventTarget } from "@/lib/keyboard";
import { Mailbox } from "@/lib/jmap/types";
import { useContextMenu } from "@/hooks/use-context-menu";
import { MailboxContextMenu, type MailboxContextTarget } from "./mailbox-context-menu";
import { useAccountStore } from '@/stores/account-store';
import { UNIFIED_MAILBOX_IDS, CROSS_VIEW_IDS } from '@/lib/jmap/types';
import type { UnifiedMailboxRole } from '@/lib/jmap/types';
import { useDragDropContext } from "@/contexts/drag-drop-context";
import { useMailboxDrop } from "@/hooks/use-mailbox-drop";
import { MAILBOX_DRAG_MIME } from "@/components/pro/pro-shell-drop";
import { useTagDrop } from "@/hooks/use-tag-drop";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { useGoogleMail } from "@/hooks/use-google-mail";
import { useMicrosoftMail } from "@/hooks/use-microsoft-mail";
import { GoogleMailSidebarSection } from "@/components/mail/google-mail-sidebar-section";
import {
  isGoogleCategoryLabel,
  isGoogleSystemFolder,
  getGoogleAccountCategories,
  isGoogleMailboxId,
} from "@/lib/google/gmail-mapper";
import { isGmailStarLabel, registerKnownMailboxes, GMAIL_STARS, type GmailStarId } from "@/lib/google/gmail-stars";
import { unifiedLoadProgress } from "@/lib/unified-mailbox";
import { useVacationStore } from "@/stores/vacation-store";
import { useSettingsStore, getKeywordVisibility, isMailboxHidden } from "@/stores/settings-store";
import { useEmailStore } from "@/stores/email-store";
import { toast } from "@/stores/toast-store";
import { debug } from "@/lib/debug";
import { useThemeStore } from "@/stores/theme-store";
import { withBasePath } from "@/lib/browser-navigation";
import { useIsEmbedded } from "@/hooks/use-is-embedded";
import { buildSettingsPath, SCHEDULED_MAILBOX_ID, scopedScheduledMailboxId } from "@/lib/deep-links";
import { useTour } from "@/components/tour/tour-provider";
import { toUnicodeEmail } from "@/lib/idn";

interface SidebarProps {
  mailboxes: Mailbox[];
  selectedMailbox?: string;
  selectedKeyword?: string | null;
  onMailboxSelect?: (mailboxId: string) => void;
  onTagSelect?: (keywordId: string | null) => void;
  onCompose?: () => void;
  /**
   * Mountain View, desktop only: the rail grows a Compose pill at the top and
   * drops its own header, because the global top bar already carries the
   * collapse control and the account switcher.
   */
  mvShell?: boolean;
  onSidebarClose?: () => void;
  onUnreadFilterClick?: (mailboxId: string) => void;
  onMarkFolderRead?: (mailboxId: string) => void;
  onMarkFolderTreeRead?: (mailboxId: string) => void;
  onMarkAllFoldersRead?: () => void;
  onEmptyFolder?: (mailboxId: string) => void;
  onCreateSubfolder?: (parentId: string) => void;
  onCreateFolder?: (accountId?: string) => void;
  onRenameFolder?: (mailboxId: string) => void;
  onDeleteFolder?: (mailboxId: string) => void;
  onShareFolder?: (mailboxId: string) => void;
  onImportEmail?: (mailboxId: string) => void;
  onRefreshMailboxes?: () => void;
  scheduledTotal?: number;
  /** Pending scheduled-send counts per JMAP account, for shared-account rows. */
  scheduledTotalByAccount?: Record<string, number>;
  /** JMAP account the scheduled view is currently narrowed to, if any. The
   *  store keeps one virtual scheduled mailbox id, so the active shared row is
   *  identified by this scope rather than by selectedMailbox alone. */
  scheduledAccountScope?: string | null;
  showScheduledMailbox?: boolean;
  /** True when the unified view spans multiple login accounts (cross-account).
   *  Drives the section header: "All accounts" when true, else "Unified Mailbox". */
  crossAccountActive?: boolean;
  /** Gated All mail / Unread / Starred entries in the "Unified Mailbox" section. */
  showCrossUnread?: boolean;
  showCrossStarred?: boolean;
  /** Mountain View: open Starred from its own row under the Inbox. */
  onOpenStarred?: () => void;
  showCrossAll?: boolean;
  /** Unread total across all cross-view folders (badge for unread/all). */
  crossUnreadCount?: number;
  /** When true, omits the top header bar (used when a unified heading is hoisted above rail and sidebar). */
  hideHeader?: boolean;
  className?: string;
  /**
   * Multi-account (Pro) mode props. When `multiAccountMode` is true, the
   * sidebar renders a per-connected-account group instead of a single
   * folders section - Thunderbird-style. `accountMailboxes` provides the
   * mailbox list for non-active accounts (the active account still flows
   * through the `mailboxes` prop). `viewingAccountId` highlights which
   * account's folder is currently selected (null = active account).
   * `onAccountMailboxSelect` fires with the owning accountId when the user
   * picks a folder; callers translate that into `selectAccountMailbox`.
   */
  multiAccountMode?: boolean;
  accountMailboxes?: Record<string, Mailbox[]>;
  viewingAccountId?: string | null;
  onAccountMailboxSelect?: (accountId: string | null, mailboxId: string) => void;
}

const ROW_PX_BASE = 8;
const CHEVRON_SLOT = 20;
const INDENT_STEP = 12;

const REORDER_MIME = 'application/x-bulwark-sidebar-reorder';

interface ReorderPayload {
  level: 'account' | 'subcategory' | 'item';
  id: string;
  parentKey?: string;
}

export type { SidebarCustomOrder } from '@/stores/settings-store';
import { type SidebarCustomOrder, getInitialSidebarCustomOrder } from '@/stores/settings-store';

const STORAGE_KEY_COLLAPSED_ACCOUNTS = 'mail_sidebar_collapsed_accounts_v1';
const STORAGE_KEY_COLLAPSED_SUBCATS = 'mail_sidebar_collapsed_subcategories_v1';


function getCategoryIcon(role: string, isSelected: boolean, colorful: boolean) {
  const base = "w-4 h-4 flex-shrink-0 transition-colors";
  let color = isSelected ? "text-white" : "text-foreground/80";
  if (colorful && !isSelected) {
    if (role === 'category_personal') color = "text-blue-500";
    else if (role === 'category_social') color = "text-cyan-500";
    else if (role === 'category_updates') color = "text-amber-500";
    else if (role === 'category_forums') color = "text-purple-500";
    else if (role === 'category_promotions') color = "text-emerald-500";
  }
  if (role === 'category_personal') return <Inbox className={cn(base, color)} />;
  if (role === 'category_social') return <Users className={cn(base, color)} />;
  if (role === 'category_updates') return <File className={cn(base, color)} />;
  if (role === 'category_forums') return <MessageSquare className={cn(base, color)} />;
  if (role === 'category_promotions') return <Tag className={cn(base, color)} />;
  return <Layers className={cn(base, color)} />;
}

const getIconForMailbox = (role?: string, name?: string, hasChildren?: boolean, isExpanded?: boolean, _isShared?: boolean, id?: string) => {
  const lowerName = name?.toLowerCase() || "";

  if (id?.startsWith('shared-account-')) {
    return User;
  }

  if (role === "inbox" || lowerName.includes("inbox")) return Inbox;
  if (role === "starred" || lowerName.includes("star") || lowerName.includes("flag")) return Star;
  if (role === "unread" || lowerName.includes("unread")) return Mail;
  if (role === "important" || lowerName.includes("important")) return LabelImportant;
  if (role === "sent" || lowerName.includes("sent")) return Send;
  if (role === "drafts" || lowerName.includes("draft")) return File;
  if (role === "trash" || lowerName.includes("trash") || lowerName.includes("deleted")) return Trash2;
  if (role === "junk" || role === "spam" || lowerName.includes("junk") || lowerName.includes("spam")) return Ban;
  if (role === "archive" || lowerName.includes("archive")) return Archive;
  if (role === "all" || role === "all_mail" || lowerName.includes("all mail")) return Layers;
  if (role === "shared" || lowerName.includes("shared")) return Users;
  if (role === "memos" || lowerName.includes("memo")) return NotebookPen;
  if (role === "scheduled" || lowerName.includes("scheduled")) return CalendarClock;
  if (role === "snoozed" || lowerName.includes("snoozed")) return BellOff;

  if (hasChildren) {
    return isExpanded ? FolderOpen : Folder;
  }

  return Folder;
};

const ROLE_ICON_COLOR: Record<string, string> = {
  inbox: "text-blue-500",
  starred: "text-yellow-500",
  unread: "text-lime-500",
  important: "text-pink-500",
  drafts: "text-purple-500",
  scheduled: "text-cyan-500",
  sent: "text-green-500",
  archive: "text-orange-500",
  junk: "text-red-500",
  spam: "text-red-500",
  trash: "text-gray-500",
  all: "text-indigo-500",
  all_mail: "text-indigo-500",
  shared: "text-cyan-500",
  memos: "text-yellow-500",
  snoozed: "text-slate-500",
};

function resolveRoleKey(role?: string, name?: string): string | undefined {
  const lowerName = name?.toLowerCase() || "";
  if (role === "inbox" || lowerName.includes("inbox")) return "inbox";
  if (role === "starred" || lowerName.includes("star") || lowerName.includes("flag")) return "starred";
  if (role === "unread" || lowerName.includes("unread")) return "unread";
  if (role === "important" || lowerName.includes("important")) return "important";
  if (role === "drafts" || lowerName.includes("draft")) return "drafts";
  if (role === "scheduled" || lowerName.includes("scheduled")) return "scheduled";
  if (role === "sent" || lowerName.includes("sent")) return "sent";
  if (role === "archive" || lowerName.includes("archive")) return "archive";
  if (role === "junk" || role === "spam" || lowerName.includes("junk") || lowerName.includes("spam")) return "junk";
  if (role === "trash" || lowerName.includes("trash") || lowerName.includes("deleted")) return "trash";
  if (role === "all" || role === "all_mail" || lowerName.includes("all mail")) return "all";
  if (role === "shared" || lowerName.includes("shared")) return "shared";
  if (role === "memos" || lowerName.includes("memo")) return "memos";
  if (role === "snoozed" || lowerName.includes("snoozed")) return "snoozed";
  return undefined;
}

function getIconClass(isSelected: boolean, isVirtual: boolean, colorful: boolean, roleKey?: string) {
  const base = "w-4 h-4 flex-shrink-0 transition-colors";
  if (isVirtual) return cn(base, "text-muted-foreground");
  if (colorful && roleKey && ROLE_ICON_COLOR[roleKey]) {
    return cn(base, ROLE_ICON_COLOR[roleKey]);
  }
  return cn(base, isSelected ? "text-accent-foreground" : "text-foreground/80");
}

export { formatCountBadge };

function SidebarRowCounts({
  unread,
  total,
  role,
  isSelected,
  onUnreadClick,
}: {
  unread?: number;
  total?: number;
  role?: string | null;
  isSelected: boolean;
  onUnreadClick?: () => void;
  isGoogle?: boolean;
}) {
  const isUnsent = role === 'drafts' || role === 'scheduled';
  const unreadCount = unread ?? 0;
  const count = isUnsent ? (total ?? unreadCount) : unreadCount;

  if (count === 0) return null;

  const badgeClass = cn(
    "text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums min-w-5 h-5 flex items-center justify-center transition-colors",
    isSelected
      ? "bg-accent-foreground/15 text-accent-foreground"
      : isUnsent
        ? "bg-muted/60 text-muted-foreground font-normal"
        : "bg-muted text-muted-foreground"
  );

  const badgeNode = (!isUnsent && onUnreadClick) ? (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onUnreadClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onUnreadClick();
        }
      }}
      className={cn(badgeClass, "cursor-pointer hover:opacity-85")}
      title={`${count} unread`}
    >
      {formatCountBadge(count)}
    </span>
  ) : (
    <span className={badgeClass}>{formatCountBadge(count)}</span>
  );

  return (
    <span
      className="ms-auto flex-shrink-0 flex items-center justify-center w-[72px]"
      style={{ width: 72 }}
      title={isUnsent ? `${count} unsent` : `${count} unread`}
      data-testid="folder-counts"
      data-unread={isUnsent ? 0 : count}
      data-total={isUnsent ? count : 0}
    >
      <span className="flex items-center justify-center gap-1">
        {badgeNode}
      </span>
    </span>
  );
}

interface SidebarRowProps {
  icon: ReactNode;
  label: string;
  /** Progressively shorter renderings of `label`, longest first. The widest one
   *  that fits the row is shown; without this the full label is used. */
  labelCandidates?: string[];
  depth?: number;
  isSelected?: boolean;
  isVirtual?: boolean;
  unread?: number;
  total?: number;
  onClick?: () => void;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onUnreadClick?: () => void;
  isCollapsed: boolean;
  dropHandlers?: Record<string, unknown>;
  isValidDropTarget?: boolean;
  isInvalidDropTarget?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Stable identifiers for integration tests (not user-visible). */
  testRole?: string | null;
  testName?: string;
  testMailboxId?: string;
  testShared?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  isGoogle?: boolean;
}

function SidebarRow({
  icon,
  label,
  labelCandidates,
  depth = 0,
  isSelected = false,
  isVirtual = false,
  unread,
  total,
  onClick,
  hasChildren = false,
  isExpanded = false,
  onExpandToggle,
  onUnreadClick,
  isCollapsed,
  dropHandlers,
  isValidDropTarget,
  isInvalidDropTarget,
  onContextMenu,
  testRole,
  testName,
  testMailboxId,
  testShared,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  isGoogle,
}: SidebarRowProps) {
  const isGoogleRow = isGoogle || isGoogleMailboxId(testMailboxId ?? '');
  const t = useTranslations('sidebar');
  const leftPad = isCollapsed ? 0 : ROW_PX_BASE + depth * INDENT_STEP;
  const [labelRef, shortenedLabel] = useShortenedText(labelCandidates ?? [label]);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(REORDER_MIME)) {
      onDragOver?.(e);
    } else if (dropHandlers && typeof (dropHandlers as Record<string, unknown>).onDragOver === 'function') {
      ((dropHandlers as Record<string, unknown>).onDragOver as (e: React.DragEvent) => void)(e);
    } else {
      onDragOver?.(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(REORDER_MIME)) {
      onDrop?.(e);
    } else if (dropHandlers && typeof (dropHandlers as Record<string, unknown>).onDrop === 'function') {
      ((dropHandlers as Record<string, unknown>).onDrop as (e: React.DragEvent) => void)(e);
    } else {
      onDrop?.(e);
    }
  };

  return (
    <div
      {...(dropHandlers || {})}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      data-testid="folder-row"
      data-mv-nav-row=""
      data-folder-role={testRole ?? undefined}
      data-folder-name={testName ?? undefined}
      data-mailbox-id={testMailboxId ?? undefined}
      data-shared={testShared ? 'true' : undefined}
      data-selected={isSelected ? 'true' : undefined}
      data-has-unread={(unread ?? 0) > 0 && testRole !== 'drafts' ? '' : undefined}
      style={{ paddingBlock: 'var(--density-sidebar-py)' }}
      className={cn(
        "group flex items-center max-lg:min-h-[44px] text-sm transition-colors duration-150 relative",
        isCollapsed
          ? "w-full justify-center px-1"
          : "mx-2 w-[calc(100%-16px)] rounded-md pe-0",
        isVirtual
          ? "text-muted-foreground"
          : isSelected
            ? "bg-accent text-accent-foreground font-semibold hover:bg-accent/80"
            : "hover:bg-muted/50 text-foreground",
        isValidDropTarget && "bg-primary/20 ring-2 ring-primary ring-inset",
        isInvalidDropTarget && "bg-destructive/10 ring-2 ring-destructive/30 ring-inset opacity-50",
        isDragging && "opacity-50",
        isDragOver && "border-t-2 border-primary"
      )}
    >
      {!isCollapsed && (
        <div
          className="flex items-center flex-shrink-0"
          style={{ paddingLeft: leftPad }}
        >
          {hasChildren && onExpandToggle ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpandToggle();
              }}
              data-testid="folder-expand-toggle"
              className="flex items-center justify-center rounded hover:bg-muted active:bg-accent transition-colors"
              style={{ width: CHEVRON_SLOT, height: CHEVRON_SLOT }}
              title={isExpanded ? t('collapse_tooltip') : t('expand_tooltip')}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div style={{ width: CHEVRON_SLOT }} aria-hidden />
          )}
        </div>
      )}

      <button
        onClick={() => !isVirtual && onClick?.()}
        disabled={isVirtual}
        data-folder-btn=""
        className={cn(
          "flex items-center gap-2 min-w-0 transition-colors bg-transparent hover:bg-transparent",
          isCollapsed ? "justify-center" : "flex-1 text-start",
          isVirtual && "cursor-default select-none",
          isSelected ? "text-accent-foreground" : ""
        )}
        title={isCollapsed ? label : undefined}
      >
        <span className={cn("flex items-center justify-center flex-shrink-0 w-4 h-4", isSelected && "text-accent-foreground")}>
          {icon}
        </span>
        {!isCollapsed && (
          <>
            <span ref={labelRef} className="flex-1 truncate">{shortenedLabel}</span>
            <SidebarRowCounts
              unread={unread}
              total={total}
              role={testRole}
              isSelected={isSelected}
              onUnreadClick={onUnreadClick}
              isGoogle={isGoogleRow}
            />
          </>
        )}
      </button>
    </div>
  );
}

function SidebarSectionHeader({
  label,
  expanded,
  onToggle,
  onSettings,
  settingsTitle,
  isCollapsed,
  first,
  icon,
  sub,
  isAccount,
  accountType,
  testId,
  onContextMenu,
  status,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  unreadBadge,
  actions,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onSettings?: () => void;
  settingsTitle?: string;
  isCollapsed: boolean;
  first?: boolean;
  icon?: ReactNode;
  sub?: boolean;
  isAccount?: boolean;
  accountType?: 'comail' | 'google' | 'microsoft';
  testId?: string;
  onContextMenu?: (event: React.MouseEvent) => void;
  /** A short note after the label, e.g. how many accounts have loaded. */
  status?: ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  unreadBadge?: number;
  actions?: ReactNode;
}) {
  if (isCollapsed) {
    return first ? null : <div className="h-px bg-border/50 mx-2 my-2" aria-hidden />;
  }

  const topSpacing = isAccount
    ? (first ? "pt-1.5 pb-1" : "pt-4 pb-1")
    : sub
    ? "pt-3.5 pb-0.5"
    : first
    ? "pt-2"
    : "pt-4";

  const textClass = isAccount
    ? "text-xs font-semibold text-foreground tracking-tight truncate"
    : sub
    ? "text-[13px] font-bold text-foreground/90 tracking-tight truncate"
    : "text-xs font-semibold text-foreground/90 truncate";

  const containerClass = isAccount
    ? cn(
        "group flex items-center py-1.5 px-2.5 mx-2 w-[calc(100%-16px)] select-none rounded-lg border shadow-xs transition-colors",
        "bg-accent/40 hover:bg-accent/60 border-accent/40 text-foreground dark:bg-accent/25 dark:hover:bg-accent/40 dark:border-accent/35",
        isDragging && "opacity-50",
        isDragOver && "border-t-2 border-primary"
      )
    : sub
    ? cn(
        "group flex items-center py-1 select-none rounded-md hover:bg-muted/40 transition-colors mx-2 w-[calc(100%-16px)] px-2",
        isDragging && "opacity-50",
        isDragOver && "border-t-2 border-primary"
      )
    : cn(
        "group flex items-center py-1.5 select-none rounded-md hover:bg-muted/40 transition-colors",
        isCollapsed ? "w-full px-2" : "mx-2 w-[calc(100%-16px)] px-2",
        isDragging && "opacity-50",
        isDragOver && "border-t-2 border-primary"
      );

  return (
    <div
      className={topSpacing}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(REORDER_MIME)) {
          onDragOver?.(e);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes(REORDER_MIME)) {
          onDrop?.(e);
        }
      }}
      onDragEnd={onDragEnd}
    >
      <div
        onContextMenu={onContextMenu}
        data-testid={testId}
        data-section-name={label}
        data-expanded={expanded ? 'true' : 'false'}
        className={containerClass}
      >
        <button
          type="button"
          onClick={onToggle}
          data-folder-btn=""
          className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent focus:outline-none"
        >
          {expanded ? (
            <ChevronDown className={cn(sub ? "w-3.5 h-3.5" : "w-3.5 h-3.5", "text-muted-foreground flex-shrink-0")} />
          ) : (
            <ChevronRight className={cn(sub ? "w-3.5 h-3.5" : "w-3.5 h-3.5", "text-muted-foreground flex-shrink-0")} />
          )}
          {icon && (
            isAccount ? (
              <span className="w-5 h-5 rounded-md flex items-center justify-center bg-background/60 flex-shrink-0 shadow-2xs border border-border/40">
                {icon}
              </span>
            ) : (
              <span className="flex-shrink-0 text-foreground/80">{icon}</span>
            )
          )}
          <span className={cn(textClass, "ms-1")}>
            {label}
          </span>
          {status}
        </button>
        {unreadBadge !== undefined && unreadBadge > 0 && !expanded && !isAccount && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold tabular-nums me-1 bg-primary/10 text-primary"
          >
            {formatCountBadge(unreadBadge)}
          </span>
        )}
        {actions}
        {onSettings && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onSettings();
              }
            }}
            className="ms-1 p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={settingsTitle}
          >
            <Settings className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

function MailboxTreeItem({
  node,
  selectedMailbox,
  expandedFolders,
  onMailboxSelect,
  onToggleExpand,
  isCollapsed,
  onUnreadFilterClick,
  colorful,
  onContextMenu,
  dragAccountId = null,
  depthOffset = 0,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  isGoogle,
}: {
  node: MailboxNode;
  selectedMailbox: string;
  expandedFolders: Set<string>;
  onMailboxSelect?: (id: string) => void;
  onToggleExpand: (id: string) => void;
  isCollapsed: boolean;
  onUnreadFilterClick?: (mailboxId: string) => void;
  colorful: boolean;
  onContextMenu?: (e: React.MouseEvent, node: MailboxNode) => void;
  /** Connected-account id this folder is listed under; null = active account.
   *  Travels in the folder-drag payload so a folder tab fetches through the
   *  right client. */
  dragAccountId?: string | null;
  depthOffset?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  isGoogle?: boolean;
}) {
  const isGoogleNode = isGoogle || isGoogleMailboxId(node.id) || Boolean(dragAccountId?.startsWith('google:'));
  const tNotifications = useTranslations('notifications');
  const tSidebar = useTranslations('sidebar');
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedFolders.has(node.id);
  const Icon = getIconForMailbox(node.role, node.name, hasChildren, isExpanded, node.isShared, node.id);
  const isVirtualNode = node.id.startsWith('shared-');
  const isSelected = selectedMailbox === node.id;
  const roleKey = resolveRoleKey(node.role, node.name);
  const label = localizeMailboxName(node.role, node.name, (k) => tSidebar(`mailboxes.${k}`));

  const isEmbedded = useIsEmbedded();
  // Pro shell only: folder rows are drag sources so a folder can be dropped
  // onto a tab strip / pane and open as its own tab. Native HTML5 DnD - the
  // Pro shell's drop targets live outside any dnd-kit context.
  const folderDragHandlers: Record<string, unknown> | undefined =
    isEmbedded && !isVirtualNode
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData(
              MAILBOX_DRAG_MIME,
              JSON.stringify({ mailboxId: node.id, name: label, accountId: dragAccountId }),
            );
            e.dataTransfer.effectAllowed = 'copy';
          },
        }
      : undefined;

  const { isDragging: globalDragging } = useDragDropContext();
  const { dropHandlers, isValidDropTarget, isInvalidDropTarget } = useMailboxDrop({
    mailbox: node,
    onSuccess: (count, mailboxName) => {
      if (count === 1) {
        toast.success(
          tNotifications('email_moved'),
          tNotifications('moved_to_mailbox', { mailbox: mailboxName })
        );
      } else {
        toast.success(
          tNotifications('emails_moved', { count }),
          tNotifications('moved_to_mailbox', { mailbox: mailboxName })
        );
      }
    },
    onError: () => {
      toast.error(tNotifications('move_failed'), tNotifications('move_error'));
    },
  });

  return (
    <>
      <SidebarRow
        icon={<Icon className={getIconClass(isSelected, isVirtualNode, colorful, roleKey)} />}
        label={label}
        testRole={node.role}
        testName={node.name}
        testMailboxId={node.id}
        testShared={node.isShared}
        depth={node.depth + depthOffset}
        isSelected={isSelected}
        isVirtual={isVirtualNode}
        unread={node.unreadEmails}
        total={node.totalEmails}
        onClick={() => onMailboxSelect?.(node.id)}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onExpandToggle={() => onToggleExpand(node.id)}
        onUnreadClick={() => onUnreadFilterClick?.(node.id)}
        isCollapsed={isCollapsed}
        dropHandlers={
          folderDragHandlers || globalDragging
            ? {
                ...(folderDragHandlers ?? {}),
                ...(globalDragging ? (dropHandlers as Record<string, unknown>) : {}),
              }
            : undefined
        }
        isValidDropTarget={isValidDropTarget}
        isInvalidDropTarget={isInvalidDropTarget}
        onContextMenu={onContextMenu && !isVirtualNode ? (e) => onContextMenu(e, node) : undefined}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        isDragging={isDragging}
        isDragOver={isDragOver}
        isGoogle={isGoogleNode}
      />

      {hasChildren && isExpanded && !isCollapsed && node.children.map((child) => (
        <MailboxTreeItem
          key={child.id}
          node={child}
          selectedMailbox={selectedMailbox}
          expandedFolders={expandedFolders}
          onMailboxSelect={onMailboxSelect}
          onToggleExpand={onToggleExpand}
          isCollapsed={isCollapsed}
          onUnreadFilterClick={onUnreadFilterClick}
          colorful={colorful}
          onContextMenu={onContextMenu}
          dragAccountId={dragAccountId}
          depthOffset={depthOffset}
          isGoogle={isGoogleNode}
        />
      ))}
    </>
  );
}

function ShowAllTagsRow({
  hiddenCount,
  showAll,
  onToggle,
  isCollapsed,
}: {
  hiddenCount: number;
  showAll: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
}) {
  const t = useTranslations('sidebar');

  return (
    <SidebarRow
      icon={<MoreHorizontal className="w-4 h-4 text-muted-foreground" />}
      label={showAll ? t('show_fewer_tags') : t('show_all_tags', { count: hiddenCount })}
      depth={1}
      onClick={onToggle}
      isCollapsed={isCollapsed}
    />
  );
}

function TagItem({
  node,
  selectedKeyword,
  expandedTags,
  isCollapsed,
  onTagSelect,
  onToggleExpand,
  tagCounts,
  colorful,
  depthOffset = 0,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}: {
  node: KeywordNode;
  selectedKeyword: string | null;
  expandedTags: Set<string>;
  isCollapsed: boolean;
  onTagSelect?: (keywordId: string | null) => void;
  onToggleExpand: (keywordId: string) => void;
  tagCounts: Record<string, { total: number; unread: number }>;
  colorful: boolean;
  depthOffset?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}) {
  const t = useTranslations('notifications');
  const { tagNameCandidates, tagColor } = useKeywordFormat();
  const palette = tagColor(node.id);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedTags.has(node.id);
  const isSelected = selectedKeyword === node.id;
  // Nested rows are placed by their indentation, so they show their own name.
  // A root spells out its path, which matters when an intermediate tag is
  // missing from this client's settings and the row would otherwise read as a
  // bare leaf name.
  const labelCandidates = node.depth === 0 ? tagNameCandidates(node.id) : [node.label];
  const label = labelCandidates[0];
  // Toasts have the room for the whole thing, and no indentation to lean on,
  // so they always spell out the full path - otherwise two leaves with the
  // same name in different branches (e.g. "Personal/Receipts" and
  // "Work/Receipts") would read as the same tag.
  const fullLabel = tagNameCandidates(node.id)[0];
  const { isDragging: globalDragging } = useDragDropContext();
  const { dropHandlers, isValidDropTarget } = useTagDrop({
    tagId: node.id,
    onSuccess: (count) => {
      if (count === 1) {
        toast.success(t('email_tagged'), fullLabel);
      } else {
        toast.success(t('emails_tagged', { count }), fullLabel);
      }
    },
    onError: () => {
      toast.error(t('tag_failed'), fullLabel);
    },
  });

  const tagIcon = colorful ? (
    <Tag className={cn("w-4 h-4 flex-shrink-0", palette.icon)} fill="currentColor" />
  ) : (
    <span className={cn("w-3 h-3 rounded-full", palette.dot)} />
  );

  return (
    <>
      <SidebarRow
        icon={tagIcon}
        label={label}
        labelCandidates={labelCandidates}
        depth={node.depth + depthOffset}
        isSelected={isSelected}
        unread={tagCounts[node.id]?.unread ?? 0}
        total={tagCounts[node.id]?.total ?? 0}
        onClick={() => onTagSelect?.(isSelected ? null : node.id)}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onExpandToggle={() => onToggleExpand(node.id)}
        isCollapsed={isCollapsed}
        dropHandlers={globalDragging ? (dropHandlers as Record<string, unknown>) : undefined}
        isValidDropTarget={isValidDropTarget}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        isDragging={isDragging}
        isDragOver={isDragOver}
      />

      {hasChildren && isExpanded && !isCollapsed && node.children.map((child) => (
        <TagItem
          key={child.id}
          node={child}
          selectedKeyword={selectedKeyword}
          expandedTags={expandedTags}
          isCollapsed={isCollapsed}
          onTagSelect={onTagSelect}
          onToggleExpand={onToggleExpand}
          tagCounts={tagCounts}
          colorful={colorful}
          depthOffset={depthOffset}
        />
      ))}
    </>
  );
}

function DemoBanner() {
  const t = useTranslations('sidebar');
  const { isDemoMode, loginDemo } = useAuthStore();
  const { startTour, resetTourCompletion } = useTour();
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);

  if (!isDemoMode) return null;

  const handleReset = async () => {
    setIsResetting(true);
    router.push('/');
    await loginDemo();
    setIsResetting(false);
  };

  const handleStartTour = () => {
    resetTourCompletion();
    router.push('/');
    setTimeout(() => startTour(), 100);
  };

  return (
    <div
      data-tour="demo-banner"
      className={cn(
        "flex flex-col gap-1.5 w-full px-3 py-2 text-xs",
        "bg-primary/10 dark:bg-primary/10 text-primary",
      )}
    >
      <div className="flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate font-medium">{t("demo_banner")}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleStartTour}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 hover:bg-primary/20 transition-colors"
          title={t("demo_tour")}
        >
          <PlayCircle className="w-3 h-3" />
          {t("demo_tour")}
        </button>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
          title={t("demo_reset")}
        >
          {isResetting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3" />
          )}
          {t("demo_reset")}
        </button>
      </div>
    </div>
  );
}

function VacationBanner() {
  const t = useTranslations('sidebar');
  const router = useRouter();
  const { isEnabled, isSupported } = useVacationStore();

  if (!isSupported || !isEnabled) return null;

  return (
    <button
      onClick={() => router.push('/settings')}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 text-xs",
        "bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400",
        "hover:bg-amber-500/15 dark:hover:bg-amber-400/15 transition-colors"
      )}
    >
      <Palmtree className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate font-medium">{t("vacation_active")}</span>
      <Settings className="w-3 h-3 ms-auto flex-shrink-0 opacity-60" />
    </button>
  );
}

export function Sidebar({
  mailboxes = [],
  selectedMailbox = "",
  selectedKeyword = null,
  onMailboxSelect,
  onTagSelect,
  onCompose,
  onSidebarClose,
  onUnreadFilterClick,
  onMarkFolderRead,
  onMarkFolderTreeRead,
  onMarkAllFoldersRead,
  onEmptyFolder,
  onCreateSubfolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onShareFolder,
  onImportEmail,
  onRefreshMailboxes,
  scheduledTotal = 0,
  scheduledTotalByAccount,
  scheduledAccountScope = null,
  showScheduledMailbox = false,
  crossAccountActive = false,
  showCrossUnread = false,
  showCrossStarred = false,
  onOpenStarred,
  showCrossAll = false,
  crossUnreadCount = 0,
  className,
  multiAccountMode = false,
  accountMailboxes,
  viewingAccountId = null,
  onAccountMailboxSelect,
  mvShell = false,
  hideHeader = false,
}: SidebarProps) {
  const router = useRouter();
  const { sidebarCollapsed } = useUIStore();
  // Mountain View's collapsed rail is a peek, not a commitment: putting the pointer on
  // it slides the full list back out over the message list and takes it away
  // again on leaving, so a folder two clicks deep costs no clicks at all. It
  // floats rather than widening the column, or every hover would reflow the
  // list behind it.
  const [railHovered, setRailHovered] = useState(false);
  const hoverExpanded = mvShell && sidebarCollapsed && railHovered;
  const isCollapsed = mvShell ? (sidebarCollapsed && !hoverExpanded) : false;
  const { primaryIdentity, activeAccountId } = useAuthStore();
  const googleMail = useGoogleMail();
  const microsoftMail = useMicrosoftMail();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showAllTags, setShowAllTags] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [foldersExpanded, setFoldersExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebarFoldersExpanded');
      return stored !== null ? JSON.parse(stored) : true;
    } catch { return true; }
  });
  const [tagsExpanded, setTagsExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebarTagsExpanded');
      return stored !== null ? JSON.parse(stored) : true;
    } catch { return true; }
  });
  const [unifiedExpanded, setUnifiedExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebarUnifiedExpanded');
      return stored !== null ? JSON.parse(stored) : true;
    } catch { return true; }
  });
  const [expandedSharedAccounts, setExpandedSharedAccounts] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('sidebarExpandedSharedAccounts');
      return stored !== null ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const emailKeywords = useSettingsStore(s => s.emailKeywords);
  const nestedTags = useSettingsStore(s => s.nestedTags);
  const isEmbedded = useIsEmbedded();
  const resolvedTheme = useThemeStore(s => s.resolvedTheme);
  const activeThemeId = useThemeStore(s => s.activeThemeId);
  const isDarkSidebar = resolvedTheme === 'dark' || !activeThemeId || activeThemeId === 'builtin-comail';
  const enableUnifiedMailbox = useSettingsStore(s => s.enableUnifiedMailbox);
  const includeGroupInUnified = useSettingsStore(s => s.includeGroupInUnified);
  const scheduledFolderName = useSettingsStore(s => s.scheduledFolderName);
  const hideScheduledFolder = useSettingsStore(s => s.hideScheduledFolder);
  const hiddenFolderIds = useSettingsStore(s => s.hiddenFolderIds);
  // Mountain View draws its navigation icons in the text colour.
  const colorfulSidebarIcons = useSettingsStore(s => s.colorfulSidebarIcons) && !mvShell;
  const tagCounts = useEmailStore(s => s.tagCounts);
  const accounts = useAccountStore(s => s.accounts);
  const connectedAccounts = accounts.filter(a => a.isConnected);
  const hasGroupInboxes = useMemo(() => mailboxes.some(m => m.isShared), [mailboxes]);
  // Pro shell treats the unified mailbox as a core part of the multi-account
  // UI, so it ignores the user-facing `enableUnifiedMailbox` toggle. With a
  // single account we still surface unified when the user has opted into
  // merging group/shared inboxes — otherwise the counts would just duplicate
  // the one inbox.
  // Only show the section when mail-app will actually populate it: cross-account
  // needs the admin gate + user toggle (`crossAccountActive`, which already
  // implies 2+ connected accounts), otherwise a merged group inbox or one of
  // the cross views must exist. A bare "2+ accounts" left an empty header. (#843)
  const anyCrossViewEnabled = showCrossUnread || showCrossStarred || showCrossAll;
  const showUnified =
    (multiAccountMode || enableUnifiedMailbox) &&
    (crossAccountActive || (includeGroupInUnified && hasGroupInboxes) || anyCrossViewEnabled);
  const { unifiedCounts } = useEmailStore();
  // While the other logins are still reconnecting after a load, the unified
  // counts cover only the ones already back: say how many, so a partial total
  // is not read as the whole. Gone as soon as the restore finishes, whatever
  // became of the logins that did not make it.
  const unifiedScope = useEmailStore((s) => s.unifiedScope);
  const restoringAccounts = useAuthStore((s) => s.restoringAccounts);
  const unifiedProgress = useMemo(() => unifiedLoadProgress({
    crossAccountActive, restoring: restoringAccounts, scope: unifiedScope, accounts,
  }), [crossAccountActive, restoringAccounts, accounts, unifiedScope]);
  const t = useTranslations('sidebar');

  useEffect(() => {
    const stored = localStorage.getItem('expandedMailboxes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExpandedFolders(new Set(parsed));
      } catch (e) {
        debug.error('Failed to parse expanded mailboxes:', e);
      }
    } else {
      const tree = buildMailboxTree(mailboxes);
      const collectExpandable = (nodes: MailboxNode[]): string[] => {
        const ids: string[] = [];
        for (const node of nodes) {
          if (node.children.length > 0) {
            ids.push(node.id);
            ids.push(...collectExpandable(node.children));
          }
        }
        return ids;
      };
      setExpandedFolders(new Set(collectExpandable(tree)));
    }
  }, [mailboxes]);

  const handleToggleExpand = (mailboxId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(mailboxId)) {
        next.delete(mailboxId);
      } else {
        next.add(mailboxId);
      }
      try {
        localStorage.setItem('expandedMailboxes', JSON.stringify(Array.from(next)));
      } catch { /* storage full or unavailable */ }
      return next;
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem('expandedTags');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExpandedTags(new Set(parsed));
      } catch (e) {
        debug.error('Failed to parse expanded tags:', e);
      }
    } else {
      setExpandedTags(
        new Set(emailKeywords.filter((kw) => hasChildKeywords(kw.id, emailKeywords)).map((kw) => kw.id))
      );
    }
  }, [emailKeywords]);

  const handleToggleTagExpand = (keywordId: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(keywordId)) {
        next.delete(keywordId);
      } else {
        next.add(keywordId);
      }
      try {
        localStorage.setItem('expandedTags', JSON.stringify(Array.from(next)));
      } catch { /* storage full or unavailable */ }
      return next;
    });
  };

  // When the app renders its own virtual "Scheduled" folder (for delayed
  // sends, driven by EmailSubmission), hide the server-provided scheduled
  // mailbox (e.g. Stalwart's auto-created Scheduled folder, role === 'scheduled')
  // so it does not appear twice. (#495)
  const isServerScheduledNode = (n: MailboxNode) => showScheduledMailbox && n.role === 'scheduled';

  const scheduledName = scheduledFolderName?.trim() || t('scheduled');
  const scheduledNode: MailboxNode = useMemo(() => ({
    id: SCHEDULED_MAILBOX_ID,
    name: scheduledName,
    role: 'scheduled',
    parentId: undefined,
    sortOrder: 25,
    totalEmails: scheduledTotal,
    unreadEmails: 0,
    totalThreads: scheduledTotal,
    unreadThreads: 0,
    myRights: {
      mayReadItems: true,
      mayAddItems: false,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: false,
      mayRename: true,
      mayDelete: false,
      maySubmit: false,
    },
    isSubscribed: true,
    children: [],
    depth: 0,
  }), [scheduledName, scheduledTotal, t]);

  if (mailboxes?.length) registerKnownMailboxes(mailboxes);
  if (googleMail.mailboxes?.length) registerKnownMailboxes(googleMail.mailboxes);

  const mailboxTree = buildMailboxTree(mailboxes);
  const ownTree = mailboxTree.filter(
    (n) => !n.id.startsWith('shared-account-') && !isServerScheduledNode(n) && !isGmailStarLabel(n)
  );
  const sharedAccounts = mailboxTree.filter((n) => n.id.startsWith('shared-account-'));

  const isNodeHidden = useCallback(
    (id: string) => isMailboxHidden(id, hiddenFolderIds, hideScheduledFolder),
    [hiddenFolderIds, hideScheduledFolder]
  );

  // Mountain View's navigation is one flat list of the few places mail
  // actually goes, with everything else - the folders you made, the shared
  // ones, the labels - behind a single "More". The "Folders" and "Tags"
  // headings say the same thing the icons already do, so the first heading
  // goes and the rest move below the expander. The collapsed rail is left as
  // it is: it shows icons only, and hiding half of them behind a word would
  // leave a control with no room to put it.
  const mvFlat = mvShell && !isCollapsed;
  const isPrimaryFolder = (node: MailboxNode) =>
    node.role === 'inbox' || node.role === 'sent' || node.role === 'drafts';
  const visibleOwnTree = useMemo(() => {
    return filterVisibleMailboxTree(ownTree, isNodeHidden, selectedMailbox);
  }, [ownTree, isNodeHidden, selectedMailbox]);
  const primaryTree = mvFlat ? visibleOwnTree.filter(isPrimaryFolder) : visibleOwnTree;
  const secondaryTree = mvFlat ? visibleOwnTree.filter((node) => !isPrimaryFolder(node)) : [];
  // Of those, the system folders (archive, spam, trash...) go behind "More",
  // and the folders the user made are listed with the tags under "Labels",
  // which is what they are to someone coming from Gmail.
  const moreTree = secondaryTree.filter((node) => !!node.role);
  const labelTree = secondaryTree.filter((node) => !node.role);

  // With nesting off every tag is its own root, so the same rows render through
  // one path whether or not the ids describe a hierarchy.
  const tagTree: KeywordNode[] = nestedTags
    ? buildKeywordTree(emailKeywords)
    : emailKeywords.map((kw) => ({ ...kw, children: [], depth: 0 }));

  // Counts arrive from a separate JMAP round trip, one batch per group of tags;
  // a tag with no count yet is treated as visible rather than blanking it and
  // filling it back in. A tag the server answered for with zero unread hides,
  // which is the point of the setting.
  const isTagVisible = (node: KeywordNode) => {
    if (isGmailStarLabel(node.id) || isGmailStarLabel(node.label)) return false;
    if (showAllTags || node.id === selectedKeyword) return true;
    const visibility = getKeywordVisibility(node);
    if (visibility === 'hide') return false;
    if (visibility === 'unread') {
      const count = tagCounts[node.id];
      return !count || count.unread > 0;
    }
    return true;
  };
  const visibleTagTree = filterKeywordTree(tagTree, isTagVisible);
  const hiddenTagCount = emailKeywords.length - countKeywordNodes(visibleTagTree);

  // Multi-account mode (Pro shell): render every connected account as its
  // own collapsible group.
  const useMultiAccount = multiAccountMode && connectedAccounts.length > 1;

  // Scheduled row. Without an account it is the combined view (the user's own
  // tree); with one it scopes the list to that shared account's scheduled mail,
  // which lives in the shared JMAP account rather than the primary one (#874).
  const renderScheduledRow = (key: string, account?: { accountId?: string; depth?: number }) => {
    if (!showScheduledMailbox || isNodeHidden(SCHEDULED_MAILBOX_ID)) return null;
    const accountId = account?.accountId;
    const mailboxId = accountId ? scopedScheduledMailboxId(accountId) : SCHEDULED_MAILBOX_ID;
    const count = accountId
      ? (scheduledTotalByAccount?.[accountId] ?? 0)
      : scheduledTotal;
    // selectedMailbox is always the plain virtual id, so the *scope* decides
    // which of these rows is the active one.
    const isScheduledSelected = selectedMailbox === SCHEDULED_MAILBOX_ID
      && (scheduledAccountScope ?? null) === (accountId ?? null);
    return (
      <SidebarRow
        key={key}
        icon={<CalendarClock className={getIconClass(!selectedKeyword && isScheduledSelected, false, colorfulSidebarIcons, 'scheduled')} />}
        label={scheduledName}
        depth={account?.depth ?? 0}
        isSelected={!selectedKeyword && isScheduledSelected}
        total={count}
        onClick={() => onMailboxSelect?.(mailboxId)}
        isCollapsed={isCollapsed}
        testRole="scheduled"
        testName="scheduled"
        testMailboxId={mailboxId}
      />
    );
  };

  const getUnifiedIcon = (role: UnifiedMailboxRole) => {
    switch (role) {
      case 'inbox': return Inbox;
      case 'sent': return Send;
      case 'drafts': return File;
      case 'trash': return Trash2;
      case 'archive': return Archive;
      case 'junk': return Ban;
      default: return Folder;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack Arrow keys while the user is typing. This is a global
      // window listener, so without this guard typing in a new email (the
      // contentEditable composer, the subject field, search, etc.) toggled the
      // selected mailbox's subfolders open/closed on ArrowLeft/ArrowRight.
      // composedPath-based so it also sees the QuotedHtml shadow island (#654).
      if (isEditableEventTarget(e)) return;
      if (!selectedMailbox || isCollapsed) return;

      const findNode = (nodes: MailboxNode[]): MailboxNode | null => {
        for (const node of nodes) {
          if (node.id === selectedMailbox) return node;
          const found = findNode(node.children);
          if (found) return found;
        }
        return null;
      };

      const selectedNode = findNode(mailboxTree);
      if (!selectedNode) return;

      if (e.key === 'ArrowRight' && selectedNode.children.length > 0) {
        if (!expandedFolders.has(selectedMailbox)) {
          handleToggleExpand(selectedMailbox);
        }
      } else if (e.key === 'ArrowLeft' && selectedNode.children.length > 0) {
        if (expandedFolders.has(selectedMailbox)) {
          handleToggleExpand(selectedMailbox);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMailbox, isCollapsed, expandedFolders, mailboxTree]);

  const toggleUnified = () => {
    setUnifiedExpanded((prev: boolean) => {
      const next = !prev;
      try { localStorage.setItem('sidebarUnifiedExpanded', JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  };
  const toggleFolders = () => {
    setFoldersExpanded((prev: boolean) => {
      const next = !prev;
      try { localStorage.setItem('sidebarFoldersExpanded', JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  };
  const toggleTags = () => {
    setTagsExpanded((prev: boolean) => {
      const next = !prev;
      try { localStorage.setItem('sidebarTagsExpanded', JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  };
  const toggleSharedAccount = (id: string) => {
    setExpandedSharedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('sidebarExpandedSharedAccounts', JSON.stringify(Array.from(next))); } catch { /* */ }
      return next;
    });
  };

  // The tab now travels in the URL (#733) rather than through sessionStorage,
  // so a gear click is a link the user can also bookmark or share. It still
  // steers only this one open - the persisted default is written on tab click.
  const openFolderSettings = useCallback((accountId = 'comail:primary') => {
    try {
      sessionStorage.setItem('settings-deep-link-account', accountId);
    } catch { /* */ }
    router.push(buildSettingsPath('folders'));
  }, [router]);

  const {
    contextMenu: mailboxContextMenu,
    openContextMenu: openMailboxContextMenu,
    closeContextMenu: closeMailboxContextMenu,
    menuRef: mailboxMenuRef,
  } = useContextMenu<MailboxContextTarget>();

  const handleMailboxContextMenu = (e: React.MouseEvent, node: MailboxNode) => {
    if (node.id === SCHEDULED_MAILBOX_ID) return;
    const mailbox = mailboxes.find(mb => mb.id === node.id);
    if (!mailbox) return;
    openMailboxContextMenu(e, { kind: "mailbox", mailbox, hasChildren: node.children.length > 0 });
  };

  const handleFoldersHeaderContextMenu = (e: React.MouseEvent) => {
    openMailboxContextMenu(e, { kind: "folders-section" });
  };

  // `buildMailboxTree()` groups shared mailboxes that carry no accountId under
  // the placeholder id "unknown" (lib/utils.ts). Such a node cannot be a valid
  // JMAP mutation target, so it gets no folder-creation menu at all rather than
  // a menu that would create the folder in a non-existent account.
  const sharedAccountMenuId = (accountId?: string) =>
    accountId && accountId !== "unknown" ? accountId : undefined;

  const handleSharedAccountContextMenu = (e: React.MouseEvent, accountId: string) => {
    openMailboxContextMenu(e, { kind: "folders-section", accountId: sharedAccountMenuId(accountId) });
  };

  const storedCustomOrder = useSettingsStore((s) => s.sidebarCustomOrder);
  const customOrder = useMemo(() => {
    const isEmpty =
      (!storedCustomOrder?.accounts || storedCustomOrder.accounts.length === 0) &&
      (!storedCustomOrder?.subcategories || Object.keys(storedCustomOrder.subcategories).length === 0) &&
      (!storedCustomOrder?.items || Object.keys(storedCustomOrder.items).length === 0);
    if (isEmpty) {
      return getInitialSidebarCustomOrder();
    }
    return storedCustomOrder;
  }, [storedCustomOrder]);
  const setSidebarCustomOrder = useSettingsStore((s) => s.setSidebarCustomOrder);
  const [dragReorderSource, setDragReorderSource] = useState<ReorderPayload | null>(null);
  const [dragReorderTarget, setDragReorderTarget] = useState<ReorderPayload | null>(null);
  const googleStarsSubmenuEnabled = useSettingsStore((s) => s.googleStarsSubmenuEnabled);
  const googleHiddenStarIds = useSettingsStore((s) => s.googleHiddenStarIds);

  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COLLAPSED_ACCOUNTS);
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* */ }
    return new Set<string>();
  });

  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COLLAPSED_SUBCATS);
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* */ }
    return new Set<string>();
  });

  const toggleAccountCollapse = (accountId: string) => {
    setCollapsedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED_ACCOUNTS, JSON.stringify(Array.from(next)));
      } catch { /* */ }
      return next;
    });
  };

  const toggleSubcategoryCollapse = (subcatKey: string) => {
    setCollapsedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subcatKey)) next.delete(subcatKey);
      else next.add(subcatKey);
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED_SUBCATS, JSON.stringify(Array.from(next)));
      } catch { /* */ }
      return next;
    });
  };

  const handleReorderDragStart = (e: React.DragEvent, payload: ReorderPayload) => {
    e.stopPropagation();
    setDragReorderSource(payload);
    e.dataTransfer.setData(REORDER_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleReorderDragOver = (e: React.DragEvent, target: ReorderPayload) => {
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    if (
      dragReorderSource &&
      dragReorderSource.level === target.level &&
      dragReorderSource.parentKey === target.parentKey &&
      dragReorderSource.id !== target.id
    ) {
      e.dataTransfer.dropEffect = 'move';
      if (dragReorderTarget?.id !== target.id) {
        setDragReorderTarget(target);
      }
    }
  };

  const handleReorderDragEnd = () => {
    setDragReorderSource(null);
    setDragReorderTarget(null);
  };

  const handleReorderDrop = (e: React.DragEvent, target: ReorderPayload, currentList: string[]) => {
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      const data: ReorderPayload = JSON.parse(e.dataTransfer.getData(REORDER_MIME));
      if (
        data.level === target.level &&
        data.parentKey === target.parentKey &&
        data.id !== target.id
      ) {
        const sourceId = data.id;
        const targetId = target.id;
        const baseList = [...currentList];
        const srcIdx = baseList.indexOf(sourceId);
        const tgtIdx = baseList.indexOf(targetId);
        if (srcIdx !== -1 && tgtIdx !== -1) {
          baseList.splice(srcIdx, 1);
          baseList.splice(tgtIdx, 0, sourceId);

          setSidebarCustomOrder((prev) => {
            const next: SidebarCustomOrder = {
              accounts: [...(prev?.accounts || [])],
              subcategories: { ...(prev?.subcategories || {}) },
              items: { ...(prev?.items || {}) },
            };
            if (target.level === 'account') {
              next.accounts = baseList;
            } else if (target.level === 'subcategory' && target.parentKey) {
              next.subcategories = {
                ...next.subcategories,
                [target.parentKey]: baseList,
              };
            } else if (target.level === 'item' && target.parentKey) {
              next.items = {
                ...next.items,
                [target.parentKey]: baseList,
              };
            }
            return next;
          });
        }
      }
    } catch (err) {
      debug.error('Failed to parse reorder drag payload', err);
    } finally {
      setDragReorderSource(null);
      setDragReorderTarget(null);
    }
  };

  interface SidebarSubcategory {
    id: string;
    label: string;
    icon: ReactNode;
    type:
      | 'folders'
      | 'tags'
      | 'shared'
      | 'google_folders'
      | 'google_categories'
      | 'google_labels'
      | 'google_stars'
      | 'microsoft_folders'
      | 'microsoft_labels';
    settingsAction?: () => void;
    itemsCount?: number;
  }

  interface SidebarAccountItem {
    id: string;
    email: string;
    type: 'comail' | 'google' | 'microsoft';
    icon: ReactNode;
    unreadTotal: number;
    subcategories: SidebarSubcategory[];
    isActive?: boolean;
    comailAccountId?: string | null;
    settingsAction?: () => void;
  }

  const comailEmail = useMemo(() => {
    const email =
      primaryIdentity?.email ||
      connectedAccounts.find((a) => a.id === activeAccountId)?.email ||
      connectedAccounts[0]?.email ||
      accounts[0]?.email;
    return email ? toUnicodeEmail(email) : 'user@comail.com';
  }, [primaryIdentity, connectedAccounts, activeAccountId, accounts]);

  const comailUnreadTotal = useMemo(() => {
    return ownTree.reduce((sum, n) => sum + (n.unreadEmails || 0), 0);
  }, [ownTree]);

  const allInboxesUnreadTotal = useMemo(() => {
    const comailInboxUnread = mailboxes.find((m) => m.role === 'inbox')?.unreadEmails || 0;
    const secondaryInboxesUnread = Object.values(accountMailboxes || {}).reduce(
      (sum, mbs) => sum + (mbs.find((m) => m.role === 'inbox')?.unreadEmails || 0),
      0
    );
    const googleInboxesUnread = googleMail.accountsData.reduce((sum, g) => {
      const ib = g.mailboxes.find((m) => m.role === 'inbox');
      return sum + (ib?.unreadEmails ?? g.unreadTotal ?? 0);
    }, 0);
    const microsoftInboxesUnread = microsoftMail.mailboxes
      .filter((m) => m.role === 'inbox')
      .reduce((sum, m) => sum + (m.unreadEmails || 0), 0);
    return comailInboxUnread + secondaryInboxesUnread + googleInboxesUnread + microsoftInboxesUnread;
  }, [mailboxes, accountMailboxes, googleMail.accountsData, microsoftMail.mailboxes]);

  const isAllInboxesSelected = !selectedKeyword && selectedMailbox === UNIFIED_MAILBOX_IDS.inbox;

  const defaultAccounts: SidebarAccountItem[] = useMemo(() => {
    const list: SidebarAccountItem[] = [];

    // Primary Comail account
    const comailSubcats: SidebarSubcategory[] = [
      {
        id: 'folders',
        label: t('folders'),
        icon: <Folder className="w-4 h-4 text-foreground/75" />,
        type: 'folders',
      },
      {
        id: 'tags',
        label: t('tags'),
        icon: <Tag className="w-4 h-4 text-foreground/75" />,
        type: 'tags',
      },
    ];

    if (sharedAccounts.length > 0) {
      comailSubcats.push({
        id: 'shared',
        label: t('shared'),
        icon: <Users className="w-4 h-4 text-foreground/75" />,
        type: 'shared',
        itemsCount: sharedAccounts.length,
      });
    }

    list.push({
      id: 'comail:primary',
      email: comailEmail,
      type: 'comail',
      icon: (
        <img
          src={withBasePath("/branding/comail/cammie-mark.png")}
          alt="Comail"
          className="w-3.5 h-3.5 object-contain flex-shrink-0"
        />
      ),
      unreadTotal: comailUnreadTotal,
      subcategories: comailSubcats,
      isActive: true,
      comailAccountId: null,
      settingsAction: () => openFolderSettings('comail:primary'),
    });

    // If multi-account mode, add secondary Comail accounts
    if (useMultiAccount) {
      connectedAccounts
        .filter((a) => a.id !== activeAccountId)
        .forEach((account) => {
          const accMailboxes = accountMailboxes?.[account.id] ?? [];
          const accUnread = accMailboxes.reduce((sum, m) => sum + (m.unreadEmails || 0), 0);
          list.push({
            id: `comail:${account.id}`,
            email: toUnicodeEmail(account.email || account.username || account.label),
            type: 'comail',
            icon: (
              <img
                src={withBasePath("/branding/comail/cammie-mark.png")}
                alt="Comail"
                className="w-3.5 h-3.5 object-contain flex-shrink-0"
              />
            ),
            unreadTotal: accUnread,
            subcategories: [
              {
                id: 'folders',
                label: t('folders'),
                icon: <Folder className="w-4 h-4 text-foreground/75" />,
                type: 'folders',
              },
            ],
            isActive: false,
            comailAccountId: account.id,
          });
        });
    }

    // Google accounts
    if (googleMail.hasGmailAccounts) {
      googleMail.accountsData.forEach(({ account, mailboxes: gMailboxes, unreadTotal }) => {
        const sysFolders = gMailboxes.filter(
          (m) => isGoogleSystemFolder(m) && !isGoogleCategoryLabel(m.originalId || m.id || m.role)
        );
        const categories = getGoogleAccountCategories(account.email, gMailboxes);
        const userLabels = gMailboxes.filter(
          (m) =>
            !isGoogleSystemFolder(m) &&
            !isGoogleCategoryLabel(m.originalId || m.id || m.role) &&
            !isGmailStarLabel(m)
        );

        const googleSubcats: SidebarSubcategory[] = [
          {
            id: 'folders',
            label: t('folders'),
            icon: <Folder className="w-4 h-4 text-foreground/75" />,
            type: 'google_folders',
            itemsCount: sysFolders.length,
          },
          {
            id: 'categories',
            label: t('categories'),
            icon: <Layers className="w-4 h-4 text-foreground/75" />,
            type: 'google_categories',
            itemsCount: categories.length,
          },
          {
            id: 'labels',
            label: t('labels'),
            icon: <Tag className="w-4 h-4 text-foreground/75" />,
            type: 'google_labels',
            itemsCount: userLabels.length,
          },
        ];

        const isStarsEnabled = Boolean(googleStarsSubmenuEnabled?.[account.email]);
        if (isStarsEnabled) {
          const hiddenStars = googleHiddenStarIds?.[account.email] || [];
          const visibleStars = (Object.keys(GMAIL_STARS) as GmailStarId[])
            .filter((id) => !hiddenStars.includes(id));
          googleSubcats.push({
            id: 'stars',
            label: 'Stars',
            icon: <Star className="w-4 h-4 text-yellow-500" />,
            type: 'google_stars',
            itemsCount: visibleStars.length,
          });
        }

        list.push({
          id: `google:${account.email}`,
          email: account.email,
          type: 'google',
          icon: <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />,
          unreadTotal,
          subcategories: googleSubcats,
          settingsAction: () => openFolderSettings(`google:${account.email}`),
        });
      });
    }

    // Microsoft accounts
    if (microsoftMail.accounts.length > 0) {
      microsoftMail.accounts.forEach((acc) => {
        const prefix = `microsoft:${acc.email}::`;
        const msMailboxes = microsoftMail.mailboxes.filter((m) => m.id.startsWith(prefix));
        const sysFolders = msMailboxes.filter((m) => Boolean(m.role));
        const customFolders = msMailboxes.filter((m) => !m.role);
        const unreadTotal =
          msMailboxes.find((m) => m.role === 'inbox')?.unreadEmails ||
          msMailboxes.reduce((sum, m) => sum + (m.unreadEmails || 0), 0);

        const msSubcats: SidebarSubcategory[] = [
          {
            id: 'folders',
            label: t('folders'),
            icon: <Folder className="w-4 h-4 text-foreground/75" />,
            type: 'microsoft_folders',
            itemsCount: sysFolders.length,
          },
        ];

        if (customFolders.length > 0) {
          msSubcats.push({
            id: 'labels',
            label: t('labels'),
            icon: <Tag className="w-4 h-4 text-foreground/75" />,
            type: 'microsoft_labels',
            itemsCount: customFolders.length,
          });
        }

        list.push({
          id: `microsoft:${acc.email}`,
          email: acc.email,
          type: 'microsoft',
          icon: <MicrosoftIcon className="w-3.5 h-3.5 flex-shrink-0" />,
          unreadTotal,
          subcategories: msSubcats,
          settingsAction: () => openFolderSettings(`microsoft:${acc.email}`),
        });
      });
    }

    return list;
  }, [
    comailEmail,
    comailUnreadTotal,
    sharedAccounts,
    useMultiAccount,
    connectedAccounts,
    activeAccountId,
    accountMailboxes,
    googleMail.hasGmailAccounts,
    googleMail.accountsData,
    microsoftMail.accounts,
    microsoftMail.mailboxes,
    openFolderSettings,
    googleStarsSubmenuEnabled,
    googleHiddenStarIds,
    t,
  ]);

  const orderedAccounts = useMemo(() => {
    return applyCustomOrder(defaultAccounts, customOrder.accounts, (a) => a.id);
  }, [defaultAccounts, customOrder.accounts]);

  const getOrderedSubcategories = (account: SidebarAccountItem) => {
    return applyCustomOrder(
      account.subcategories,
      customOrder.subcategories[account.id],
      (s) => s.id
    );
  };

  const comailFolders = useMemo(() => {
    let tree = ownTree;
    if (showScheduledMailbox && !isNodeHidden(SCHEDULED_MAILBOX_ID)) {
      if (!ownTree.some((n) => n.id === SCHEDULED_MAILBOX_ID || n.role === 'scheduled')) {
        const draftsIdx = ownTree.findIndex((n) => n.role === 'drafts');
        if (draftsIdx !== -1) {
          tree = [...ownTree.slice(0, draftsIdx + 1), scheduledNode, ...ownTree.slice(draftsIdx + 1)];
        } else {
          tree = [...ownTree, scheduledNode];
        }
      }
    }
    return filterVisibleMailboxTree(tree, isNodeHidden, selectedMailbox);
  }, [ownTree, showScheduledMailbox, isNodeHidden, scheduledNode, selectedMailbox]);

  const orderedComailFolders = useMemo(() => {
    return applyCustomOrder(comailFolders, customOrder.items['comail:primary:folders'], (n) => n.id);
  }, [comailFolders, customOrder.items]);

  const orderedComailTags = useMemo(() => {
    return applyCustomOrder(visibleTagTree, customOrder.items['comail:primary:tags'], (n) => n.id);
  }, [visibleTagTree, customOrder.items]);

  const getOrderedGoogleFolders = (accountEmail: string, sysFolders: Mailbox[]) => {
    const key = `google:${accountEmail}:folders`;
    const visible = sysFolders.filter((m) => !isNodeHidden(m.id) || m.id === selectedMailbox);
    const sorted = [...visible].sort((a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10));
    return applyCustomOrder(sorted, customOrder.items[key], (m) => m.id);
  };

  const getOrderedGoogleCategories = (accountEmail: string, cats: Mailbox[]) => {
    const key = `google:${accountEmail}:categories`;
    const visible = cats.filter((m) => !isNodeHidden(m.id) || m.id === selectedMailbox);
    const sorted = [...visible].sort((a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10));
    return applyCustomOrder(sorted, customOrder.items[key], (m) => m.id);
  };

  const getOrderedGoogleLabels = (accountEmail: string, userLabels: Mailbox[]) => {
    const key = `google:${accountEmail}:labels`;
    const tree = buildMailboxTree(userLabels);
    const visibleTree = filterVisibleMailboxTree(tree, isNodeHidden, selectedMailbox);
    return applyCustomOrder(visibleTree, customOrder.items[key], (m) => m.id);
  };

  return (
    <div
      onMouseEnter={mvShell && sidebarCollapsed ? () => setRailHovered(true) : undefined}
      onMouseLeave={mvShell && sidebarCollapsed ? () => setRailHovered(false) : undefined}
      data-mv-rail-peek={hoverExpanded ? "" : undefined}
      className={cn(
        "relative flex flex-col h-full border-e transition-all duration-300 overflow-hidden",
        hideHeader && "border-e-0",
        // Mountain View's navigation sits on the canvas, with no rule between
        // it and the content card.
        mvShell ? "bg-[var(--mv-canvas)] border-transparent" : "bg-secondary border-border",
        "max-lg:w-full",
        // Mountain View's collapsed column is 72px (--mv-rail-w), wide enough
        // for its round compose button; the default layout's rail is 48px.
        isCollapsed && !mvShell ? "lg:w-12" : "lg:w-full",
        // Floats out of the rail's own column rather than widening it, so the
        // message list underneath never moves while the pointer passes over.
        // Width comes from --mv-rail-peek-w, keyed on data-mv-rail-peek.
        hoverExpanded && "lg:absolute lg:inset-y-0 lg:start-0 lg:z-40 lg:shadow-xl",
        className
      )}
    >
      {/* Header - hidden in the Pro shell, under Mountain View, or when hoisted above rail and sidebar */}
      {!hideHeader && !isEmbedded && !mvShell && (
        // Border lives on the wrapper (outside the h-14 box) so the bar's total
        // height matches the search/reply toolbars, which border-b their wrapper too.
        <div className="border-b border-border">
          <div className="flex items-center justify-between h-14 px-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Comail brand: Cammie Mark + Wordmark (refresh button) */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 flex-shrink-0 select-none hover:opacity-80 transition-opacity cursor-pointer"
                title="Reload"
                aria-label="Comail - Reload"
              >
                <img
                  src={withBasePath("/branding/comail/cammie-mark.png")}
                  alt="Comail"
                  className="w-6 h-6 object-contain"
                />
                <img
                  src={withBasePath(isDarkSidebar ? "/branding/comail/wordmark-light.svg" : "/branding/comail/wordmark-dark.svg")}
                  alt="comail"
                  className="h-4.5 w-auto object-contain"
                />
              </button>

              {/* App Indicator: Nav icon + App Title */}
              <div className="relative flex items-center gap-1 select-none flex-shrink-0">
                <Mail className="w-3.5 h-3.5 text-foreground/75 flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground/90">
                  {t("mail") || "Mail"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSidebarClose}
                className="lg:hidden h-8 w-8 flex-shrink-0 text-foreground/75 hover:text-foreground"
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {mvShell && onCompose && (
        <div className={cn("pt-2 pb-3", isCollapsed ? "px-2" : "px-3")}>
          <button
            type="button"
            onClick={onCompose}
            data-mv-compose=""
            data-tour="compose-button"
            className={cn(
              "flex items-center bg-[var(--mv-compose-bg)] text-[var(--mv-compose-fg)] hover:shadow-md transition-shadow",
              isCollapsed ? "w-14 justify-center" : "gap-3 ps-4 pe-6"
            )}
            title={t("compose_hint")}
            aria-label={t("compose")}
          >
            <Pencil className="w-6 h-6 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">{t("compose")}</span>}
          </button>
        </div>
      )}

      {!isCollapsed && <DemoBanner />}
      {!isCollapsed && <VacationBanner />}

      {/* Mailbox List */}
      <div className="flex-1 overflow-y-scroll [scrollbar-gutter:stable]" data-tour="sidebar">
        {/* All Inboxes Button */}
        <div className="pt-2 pb-1">
          <SidebarRow
            icon={<Inbox className={getIconClass(isAllInboxesSelected, false, colorfulSidebarIcons, 'inbox')} />}
            label={t("all_inboxes") || "All Inboxes"}
            testRole="inbox"
            testName="all-inboxes"
            testMailboxId={UNIFIED_MAILBOX_IDS.inbox}
            depth={0}
            isSelected={isAllInboxesSelected}
            unread={allInboxesUnreadTotal}
            onClick={() => onMailboxSelect?.(UNIFIED_MAILBOX_IDS.inbox)}
            isCollapsed={isCollapsed}
          />
        </div>

        {(showUnified || showCrossUnread || showCrossStarred || showCrossAll) && (
          <div>
            <SidebarSectionHeader
              label={t(crossAccountActive ? "all_accounts" : "unified_mailbox")}
              expanded={unifiedExpanded}
              onToggle={toggleUnified}
              isCollapsed={isCollapsed}
              first
              status={unifiedProgress && (
                <span
                  className="ms-2 text-xs font-normal tabular-nums text-muted-foreground animate-pulse"
                  title={t("all_accounts_loading", unifiedProgress)}
                  data-testid="unified-accounts-loading"
                >
                  <span aria-hidden="true">{unifiedProgress.loaded}/{unifiedProgress.total}</span>
                  <span className="sr-only">{t("all_accounts_loading", unifiedProgress)}</span>
                </span>
              )}
            />
            {((unifiedExpanded && !isCollapsed) || isCollapsed) && (
              <>
                {showUnified && unifiedCounts.map((count) => {
                  const unifiedId = UNIFIED_MAILBOX_IDS[count.role];
                  const Icon = getUnifiedIcon(count.role);
                  const isSelected = !selectedKeyword && selectedMailbox === unifiedId;
                  return (
                    <SidebarRow
                      key={unifiedId}
                      icon={<Icon className={getIconClass(isSelected, false, colorfulSidebarIcons, count.role)} />}
                      label={t(`unified_${count.role}`)}
                      testRole={count.role}
                      testName={`unified-${count.role}`}
                      testMailboxId={unifiedId}
                      depth={0}
                      isSelected={isSelected}
                      unread={count.unreadEmails}
                      total={count.totalEmails}
                      onClick={() => onMailboxSelect?.(unifiedId)}
                      isCollapsed={isCollapsed}
                    />
                  );
                })}
                {[
                  { show: showCrossUnread, id: CROSS_VIEW_IDS.unread, Icon: MailOpen, label: t('unified_all_unread'), unread: crossUnreadCount, roleKey: 'unread' },
                  { show: showCrossStarred, id: CROSS_VIEW_IDS.starred, Icon: Star, label: t('unified_all_starred'), unread: undefined as number | undefined, roleKey: 'starred' },
                  { show: showCrossAll, id: CROSS_VIEW_IDS.all, Icon: Mails, label: t('unified_all_mail'), unread: crossUnreadCount, roleKey: 'all' },
                ].map(({ show, id, Icon, label, unread, roleKey }) => {
                  if (!show) return null;
                  const isSelected = !selectedKeyword && selectedMailbox === id;
                  return (
                    <SidebarRow
                      key={id}
                      icon={<Icon className={getIconClass(isSelected, false, colorfulSidebarIcons, roleKey)} />}
                      label={label}
                      testName={id}
                      testMailboxId={id}
                      depth={0}
                      isSelected={isSelected}
                      unread={unread}
                      onClick={() => onMailboxSelect?.(id)}
                      isCollapsed={isCollapsed}
                    />
                  );
                })}
              </>
            )}
          </div>
        )}

        {mvFlat ? (
          <>
            <div onContextMenu={handleFoldersHeaderContextMenu}>
              {primaryTree.map((node) => (
                <Fragment key={node.id}>
                  <MailboxTreeItem
                    node={node}
                    selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                    expandedFolders={expandedFolders}
                    onMailboxSelect={onMailboxSelect}
                    onToggleExpand={handleToggleExpand}
                    isCollapsed={isCollapsed}
                    onUnreadFilterClick={onUnreadFilterClick}
                    colorful={colorfulSidebarIcons}
                    onContextMenu={handleMailboxContextMenu}
                  />
                  {node.role === 'drafts' && renderScheduledRow('scheduled')}
                  {node.role === 'inbox' && onOpenStarred && (
                    <SidebarRow
                      icon={<Star className={getIconClass(!selectedKeyword && selectedMailbox === CROSS_VIEW_IDS.starred, false, colorfulSidebarIcons, 'starred')} />}
                      label={t("mailboxes.starred")}
                      testName="mv-starred"
                      depth={0}
                      isSelected={!selectedKeyword && selectedMailbox === CROSS_VIEW_IDS.starred}
                      onClick={onOpenStarred}
                      isCollapsed={false}
                    />
                  )}
                </Fragment>
              ))}
              {!primaryTree.some((node) => node.role === 'drafts') && renderScheduledRow('scheduled')}
              <SidebarRow
                icon={moreExpanded
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                label={moreExpanded ? t("show_fewer") : t("show_more")}
                testName="mv-more"
                depth={0}
                isSelected={false}
                onClick={() => setMoreExpanded((prev) => !prev)}
                isCollapsed={false}
              />
              {moreExpanded && moreTree.map((node) => (
                <MailboxTreeItem
                  key={node.id}
                  node={node}
                  selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                  expandedFolders={expandedFolders}
                  onMailboxSelect={onMailboxSelect}
                  onToggleExpand={handleToggleExpand}
                  isCollapsed={isCollapsed}
                  onUnreadFilterClick={onUnreadFilterClick}
                  colorful={colorfulSidebarIcons}
                  onContextMenu={handleMailboxContextMenu}
                />
              ))}
              {moreExpanded && sharedAccounts.length > 0 && (
                <div>
                  {sharedAccounts.map((accountNode) => {
                    const accountExpanded = expandedSharedAccounts.has(accountNode.id);
                    return (
                      <Fragment key={accountNode.id}>
                        <SidebarRow
                          icon={<Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                          label={accountNode.name}
                          depth={0}
                          isSelected={false}
                          hasChildren={accountNode.children.length > 0}
                          isExpanded={accountExpanded}
                          onExpandToggle={() => toggleSharedAccount(accountNode.id)}
                          onContextMenu={(e) => handleSharedAccountContextMenu(e, accountNode.id)}
                          isCollapsed={isCollapsed}
                        />
                        {accountExpanded && accountNode.children.map((child) => (
                          <MailboxTreeItem
                            key={child.id}
                            node={child}
                            selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                            expandedFolders={expandedFolders}
                            onMailboxSelect={onMailboxSelect}
                            onToggleExpand={handleToggleExpand}
                            isCollapsed={isCollapsed}
                            onUnreadFilterClick={onUnreadFilterClick}
                            colorful={colorfulSidebarIcons}
                            onContextMenu={handleMailboxContextMenu}
                            depthOffset={0}
                          />
                        ))}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {googleMail.hasGmailAccounts && (
              <GoogleMailSidebarSection
                accountsData={googleMail.accountsData}
                selectedMailbox={selectedMailbox}
                onMailboxSelect={(mbId) => {
                  onMailboxSelect?.(mbId);
                }}
                onAccountSettings={(email) => {
                  openFolderSettings(`google:${email}`);
                }}
                isCollapsed={isCollapsed}
              />
            )}

            {!useMultiAccount && (
              <div data-mv-labels="">
                <div className="flex items-center justify-between ps-[26px] pe-3 pt-4 pb-1">
                  <span className="text-base font-medium text-foreground">{t("labels")}</span>
                  {onCreateFolder && (
                    <button
                      type="button"
                      onClick={() => onCreateFolder()}
                      className="grid place-items-center w-8 h-8 rounded-full text-foreground hover:bg-[var(--mv-nav-hover)] transition-colors"
                      title={t("create_label")}
                      aria-label={t("create_label")}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {labelTree.map((node) => (
                  <MailboxTreeItem
                    key={node.id}
                    node={node}
                    selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                    expandedFolders={expandedFolders}
                    onMailboxSelect={onMailboxSelect}
                    onToggleExpand={handleToggleExpand}
                    isCollapsed={isCollapsed}
                    onUnreadFilterClick={onUnreadFilterClick}
                    colorful={colorfulSidebarIcons}
                    onContextMenu={handleMailboxContextMenu}
                  />
                ))}
              </div>
            )}

            {emailKeywords.length > 0 && (
              <div data-tour="keyword-tags">
                {visibleTagTree.map((node) => (
                  <TagItem
                    key={node.id}
                    node={node}
                    selectedKeyword={selectedKeyword}
                    expandedTags={expandedTags}
                    isCollapsed={isCollapsed}
                    onTagSelect={onTagSelect}
                    onToggleExpand={handleToggleTagExpand}
                    tagCounts={tagCounts}
                    colorful={colorfulSidebarIcons}
                  />
                ))}
                {(hiddenTagCount > 0 || showAllTags) && (
                  <ShowAllTagsRow
                    hiddenCount={hiddenTagCount}
                    showAll={showAllTags}
                    onToggle={() => setShowAllTags((prev) => !prev)}
                    isCollapsed={isCollapsed}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            {orderedAccounts.map((account, accountIdx) => {
              const isAccountExpanded = !collapsedAccounts.has(account.id);
              const subcats = getOrderedSubcategories(account);
              const isCurrentDraggingAccount =
                dragReorderSource?.level === 'account' && dragReorderSource?.id === account.id;
              const isCurrentDragOverAccount =
                dragReorderTarget?.level === 'account' && dragReorderTarget?.id === account.id;

              return (
                <div key={account.id} className="mb-2 last:mb-0">
                  <SidebarSectionHeader
                    label={account.email}
                    expanded={isAccountExpanded}
                    onToggle={() => toggleAccountCollapse(account.id)}
                    onSettings={account.settingsAction}
                    settingsTitle={t('settings')}
                    isCollapsed={isCollapsed}
                    first={accountIdx === 0}
                    icon={account.icon}
                    unreadBadge={account.unreadTotal}
                    isAccount={true}
                    accountType={account.type}
                    draggable={true}
                    onDragStart={(e) => handleReorderDragStart(e, { level: 'account', id: account.id })}
                    onDragOver={(e) => handleReorderDragOver(e, { level: 'account', id: account.id })}
                    onDrop={(e) =>
                      handleReorderDrop(e, { level: 'account', id: account.id }, orderedAccounts.map((a) => a.id))
                    }
                    onDragEnd={handleReorderDragEnd}
                    isDragging={isCurrentDraggingAccount}
                    isDragOver={isCurrentDragOverAccount}
                  />

                  {((isAccountExpanded && !isCollapsed) || isCollapsed) && (
                    <div className="space-y-0.5">
                      {subcats.map((subcat) => {
                        const subcatKey = `${account.id}:${subcat.id}`;
                        let isSubcatExpanded = !collapsedSubcategories.has(subcatKey);
                        if (account.id === 'comail:primary' && subcat.id === 'folders') {
                          isSubcatExpanded = foldersExpanded && !collapsedSubcategories.has(subcatKey);
                        } else if (account.id === 'comail:primary' && subcat.id === 'tags') {
                          isSubcatExpanded = tagsExpanded && !collapsedSubcategories.has(subcatKey);
                        }

                        const toggleSubcat = () => {
                          toggleSubcategoryCollapse(subcatKey);
                          if (account.id === 'comail:primary') {
                            if (subcat.id === 'folders') toggleFolders();
                            if (subcat.id === 'tags') toggleTags();
                          }
                        };

                        const isCurrentDraggingSubcat =
                          dragReorderSource?.level === 'subcategory' &&
                          dragReorderSource?.id === subcat.id &&
                          dragReorderSource?.parentKey === account.id;
                        const isCurrentDragOverSubcat =
                          dragReorderTarget?.level === 'subcategory' &&
                          dragReorderTarget?.id === subcat.id &&
                          dragReorderTarget?.parentKey === account.id;

                        return (
                          <div key={subcat.id}>
                            <SidebarSectionHeader
                              label={subcat.label}
                              expanded={isSubcatExpanded}
                              onToggle={toggleSubcat}
                              onSettings={subcat.settingsAction}
                              settingsTitle={t('settings')}
                              isCollapsed={isCollapsed}
                              icon={subcat.icon}
                              sub
                              draggable={true}
                              onDragStart={(e) =>
                                handleReorderDragStart(e, {
                                  level: 'subcategory',
                                  id: subcat.id,
                                  parentKey: account.id,
                                })
                              }
                              onDragOver={(e) =>
                                handleReorderDragOver(e, {
                                  level: 'subcategory',
                                  id: subcat.id,
                                  parentKey: account.id,
                                })
                              }
                              onDrop={(e) =>
                                handleReorderDrop(
                                  e,
                                  { level: 'subcategory', id: subcat.id, parentKey: account.id },
                                  subcats.map((s) => s.id)
                                )
                              }
                              onDragEnd={handleReorderDragEnd}
                              isDragging={isCurrentDraggingSubcat}
                              isDragOver={isCurrentDragOverSubcat}
                            />

                            {((isSubcatExpanded && !isCollapsed) || isCollapsed) && (
                              <>
                                {/* Comail Folders */}
                                {subcat.type === 'folders' && (
                                  <>
                                    {account.isActive ? (
                                      mailboxes.length === 0 ? (
                                        <div className="px-6 py-1.5 text-xs text-muted-foreground italic">
                                          {!isCollapsed && t("loading_mailboxes")}
                                        </div>
                                      ) : (
                                        <>
                                          {orderedComailFolders.map((node) => {
                                            const isItemDragging =
                                              dragReorderSource?.level === 'item' &&
                                              dragReorderSource?.id === node.id &&
                                              dragReorderSource?.parentKey === 'comail:primary:folders';
                                            const isItemDragOver =
                                              dragReorderTarget?.level === 'item' &&
                                              dragReorderTarget?.id === node.id &&
                                              dragReorderTarget?.parentKey === 'comail:primary:folders';

                                            return (
                                              <MailboxTreeItem
                                                key={node.id}
                                                node={node}
                                                selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                                                expandedFolders={expandedFolders}
                                                onMailboxSelect={onMailboxSelect}
                                                onToggleExpand={handleToggleExpand}
                                                isCollapsed={isCollapsed}
                                                onUnreadFilterClick={onUnreadFilterClick}
                                                colorful={colorfulSidebarIcons}
                                                onContextMenu={handleMailboxContextMenu}
                                                depthOffset={0}
                                                draggable={true}
                                                onDragStart={(e) =>
                                                  handleReorderDragStart(e, {
                                                    level: 'item',
                                                    id: node.id,
                                                    parentKey: 'comail:primary:folders',
                                                  })
                                                }
                                                onDragOver={(e) =>
                                                  handleReorderDragOver(e, {
                                                    level: 'item',
                                                    id: node.id,
                                                    parentKey: 'comail:primary:folders',
                                                  })
                                                }
                                                onDrop={(e) =>
                                                  handleReorderDrop(
                                                    e,
                                                    {
                                                      level: 'item',
                                                      id: node.id,
                                                      parentKey: 'comail:primary:folders',
                                                    },
                                                    orderedComailFolders.map((n) => n.id)
                                                  )
                                                }
                                                onDragEnd={handleReorderDragEnd}
                                                isDragging={isItemDragging}
                                                isDragOver={isItemDragOver}
                                              />
                                            );
                                          })}
                                        </>
                                      )
                                    ) : (
                                      // Secondary Comail Account
                                      (() => {
                                        const secAccId = account.comailAccountId!;
                                        const secMailboxes = accountMailboxes?.[secAccId] ?? [];
                                        const secTree = buildMailboxTree(secMailboxes).filter(
                                          (n) => !n.id.startsWith('shared-account-') && !isGmailStarLabel(n)
                                        );
                                        const visibleSecTree = filterVisibleMailboxTree(secTree, isNodeHidden, selectedMailbox);
                                        const orderedSecTree = applyCustomOrder(
                                          visibleSecTree,
                                          customOrder.items[`comail:${secAccId}:folders`],
                                          (n) => n.id
                                        );
                                        const isViewing = viewingAccountId === secAccId;

                                        return secMailboxes.length === 0 ? (
                                          <div className="px-6 py-1.5 text-xs text-muted-foreground italic">
                                            {!isCollapsed && t("loading_mailboxes")}
                                          </div>
                                        ) : (
                                          orderedSecTree.map((node) => (
                                            <MailboxTreeItem
                                              key={node.id}
                                              node={node}
                                              selectedMailbox={selectedKeyword || !isViewing ? "" : selectedMailbox}
                                              expandedFolders={expandedFolders}
                                              onMailboxSelect={(mailboxId) =>
                                                onAccountMailboxSelect?.(secAccId, mailboxId)
                                              }
                                              onToggleExpand={handleToggleExpand}
                                              isCollapsed={isCollapsed}
                                              colorful={colorfulSidebarIcons}
                                              depthOffset={0}
                                              dragAccountId={secAccId}
                                              draggable={true}
                                              onDragStart={(e) =>
                                                handleReorderDragStart(e, {
                                                  level: 'item',
                                                  id: node.id,
                                                  parentKey: `comail:${secAccId}:folders`,
                                                })
                                              }
                                              onDragOver={(e) =>
                                                handleReorderDragOver(e, {
                                                  level: 'item',
                                                  id: node.id,
                                                  parentKey: `comail:${secAccId}:folders`,
                                                })
                                              }
                                              onDrop={(e) =>
                                                handleReorderDrop(
                                                  e,
                                                  {
                                                    level: 'item',
                                                    id: node.id,
                                                    parentKey: `comail:${secAccId}:folders`,
                                                  },
                                                  orderedSecTree.map((n) => n.id)
                                                )
                                              }
                                              onDragEnd={handleReorderDragEnd}
                                              isDragging={
                                                dragReorderSource?.level === 'item' &&
                                                dragReorderSource?.id === node.id &&
                                                dragReorderSource?.parentKey === `comail:${secAccId}:folders`
                                              }
                                              isDragOver={
                                                dragReorderTarget?.level === 'item' &&
                                                dragReorderTarget?.id === node.id &&
                                                dragReorderTarget?.parentKey === `comail:${secAccId}:folders`
                                              }
                                            />
                                          ))
                                        );
                                      })()
                                    )}
                                  </>
                                )}

                                {/* Comail Tags */}
                                {subcat.type === 'tags' && (
                                  <div data-tour="keyword-tags">
                                    {orderedComailTags.length === 0 ? (
                                      <div className="px-6 py-1.5 text-xs text-muted-foreground italic">
                                        {!isCollapsed && "No tags"}
                                      </div>
                                    ) : (
                                      <>
                                        {orderedComailTags.map((node) => {
                                          const isTagDragging =
                                            dragReorderSource?.level === 'item' &&
                                            dragReorderSource?.id === node.id &&
                                            dragReorderSource?.parentKey === 'comail:primary:tags';
                                          const isTagDragOver =
                                            dragReorderTarget?.level === 'item' &&
                                            dragReorderTarget?.id === node.id &&
                                            dragReorderTarget?.parentKey === 'comail:primary:tags';

                                          return (
                                            <TagItem
                                              key={node.id}
                                              node={node}
                                              selectedKeyword={selectedKeyword}
                                              expandedTags={expandedTags}
                                              isCollapsed={isCollapsed}
                                              onTagSelect={onTagSelect}
                                              onToggleExpand={handleToggleTagExpand}
                                              tagCounts={tagCounts}
                                              colorful={colorfulSidebarIcons}
                                              depthOffset={0}
                                              draggable={true}
                                              onDragStart={(e) =>
                                                handleReorderDragStart(e, {
                                                  level: 'item',
                                                  id: node.id,
                                                  parentKey: 'comail:primary:tags',
                                                })
                                              }
                                              onDragOver={(e) =>
                                                handleReorderDragOver(e, {
                                                  level: 'item',
                                                  id: node.id,
                                                  parentKey: 'comail:primary:tags',
                                                })
                                              }
                                              onDrop={(e) =>
                                                handleReorderDrop(
                                                  e,
                                                  {
                                                    level: 'item',
                                                    id: node.id,
                                                    parentKey: 'comail:primary:tags',
                                                  },
                                                  orderedComailTags.map((n) => n.id)
                                                )
                                              }
                                              onDragEnd={handleReorderDragEnd}
                                              isDragging={isTagDragging}
                                              isDragOver={isTagDragOver}
                                            />
                                          );
                                        })}
                                        {(hiddenTagCount > 0 || showAllTags) && (
                                          <ShowAllTagsRow
                                            hiddenCount={hiddenTagCount}
                                            showAll={showAllTags}
                                            onToggle={() => setShowAllTags((prev) => !prev)}
                                            isCollapsed={isCollapsed}
                                          />
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Comail Shared Accounts */}
                                {subcat.type === 'shared' && (
                                  <div>
                                    {sharedAccounts.map((accountNode) => {
                                      const accountExpanded = expandedSharedAccounts.has(accountNode.id);
                                      return (
                                        <Fragment key={accountNode.id}>
                                          <SidebarRow
                                            icon={<Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                            label={accountNode.name}
                                            depth={0}
                                            isSelected={false}
                                            hasChildren={accountNode.children.length > 0}
                                            isExpanded={accountExpanded}
                                            onExpandToggle={() => toggleSharedAccount(accountNode.id)}
                                            onContextMenu={(e) => handleSharedAccountContextMenu(e, accountNode.id)}
                                            isCollapsed={isCollapsed}
                                          />
                                          {accountExpanded && accountNode.children.map((child) => (
                                            <MailboxTreeItem
                                              key={child.id}
                                              node={child}
                                              selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                                              expandedFolders={expandedFolders}
                                              onMailboxSelect={onMailboxSelect}
                                              onToggleExpand={handleToggleExpand}
                                              isCollapsed={isCollapsed}
                                              onUnreadFilterClick={onUnreadFilterClick}
                                              colorful={colorfulSidebarIcons}
                                              onContextMenu={handleMailboxContextMenu}
                                              depthOffset={1}
                                            />
                                          ))}
                                        </Fragment>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Google System Folders */}
                                {subcat.type === 'google_folders' && (() => {
                                  const gAccountData = googleMail.accountsData.find(
                                    (g) => g.account.email === account.email
                                  );
                                  const sysFolders = (gAccountData?.mailboxes ?? []).filter(
                                    (m) =>
                                      isGoogleSystemFolder(m) &&
                                      !isGoogleCategoryLabel(m.originalId || m.id || m.role)
                                  );
                                  const orderedFolders = getOrderedGoogleFolders(account.email, sysFolders);
                                  const parentKey = `google:${account.email}:folders`;

                                  return orderedFolders.length === 0 ? (
                                    <div className="px-6 py-1.5 text-xs text-muted-foreground italic">
                                      {!isCollapsed && t("loading_mailboxes")}
                                    </div>
                                  ) : (
                                    orderedFolders.map((mb) => {
                                      const isSelected = !selectedKeyword && selectedMailbox === mb.id;
                                      const roleKey = resolveRoleKey(mb.role, mb.name);
                                      const Icon = getIconForMailbox(mb.role, mb.name, false, false, false, mb.id);
                                      const isItemDragging =
                                        dragReorderSource?.level === 'item' &&
                                        dragReorderSource?.id === mb.id &&
                                        dragReorderSource?.parentKey === parentKey;
                                      const isItemDragOver =
                                        dragReorderTarget?.level === 'item' &&
                                        dragReorderTarget?.id === mb.id &&
                                        dragReorderTarget?.parentKey === parentKey;

                                      return (
                                        <SidebarRow
                                          key={mb.id}
                                          icon={<Icon className={getIconClass(isSelected, false, colorfulSidebarIcons, roleKey)} />}
                                          label={mb.name}
                                          testRole={mb.role}
                                          testName={mb.name}
                                          testMailboxId={mb.id}
                                          depth={0}
                                          isSelected={isSelected}
                                          unread={mb.unreadEmails}
                                          total={mb.totalEmails}
                                          isGoogle={true}
                                          onClick={() => onMailboxSelect?.(mb.id)}
                                          isCollapsed={isCollapsed}
                                          draggable={true}
                                          onDragStart={(e) =>
                                            handleReorderDragStart(e, {
                                              level: 'item',
                                              id: mb.id,
                                              parentKey,
                                            })
                                          }
                                          onDragOver={(e) =>
                                            handleReorderDragOver(e, {
                                              level: 'item',
                                              id: mb.id,
                                              parentKey,
                                            })
                                          }
                                          onDrop={(e) =>
                                            handleReorderDrop(
                                              e,
                                              {
                                                level: 'item',
                                                id: mb.id,
                                                parentKey,
                                              },
                                              orderedFolders.map((m) => m.id)
                                            )
                                          }
                                          onDragEnd={handleReorderDragEnd}
                                          isDragging={isItemDragging}
                                          isDragOver={isItemDragOver}
                                        />
                                      );
                                    })
                                  );
                                })()}

                                {/* Google Categories */}
                                {subcat.type === 'google_categories' && (() => {
                                  const gAccountData = googleMail.accountsData.find(
                                    (g) => g.account.email === account.email
                                  );
                                  const cats = getGoogleAccountCategories(account.email, gAccountData?.mailboxes ?? []);
                                  const orderedCats = getOrderedGoogleCategories(account.email, cats);
                                  const parentKey = `google:${account.email}:categories`;

                                  return orderedCats.map((cat) => {
                                    const isSelected = !selectedKeyword && selectedMailbox === cat.id;
                                    const isItemDragging =
                                      dragReorderSource?.level === 'item' &&
                                      dragReorderSource?.id === cat.id &&
                                      dragReorderSource?.parentKey === parentKey;
                                    const isItemDragOver =
                                      dragReorderTarget?.level === 'item' &&
                                      dragReorderTarget?.id === cat.id &&
                                      dragReorderTarget?.parentKey === parentKey;

                                    return (
                                      <SidebarRow
                                        key={cat.id}
                                        icon={getCategoryIcon(cat.role || '', isSelected, colorfulSidebarIcons)}
                                        label={cat.name}
                                        testRole={cat.role}
                                        testName={cat.name}
                                        testMailboxId={cat.id}
                                        depth={0}
                                        isSelected={isSelected}
                                        unread={cat.unreadEmails}
                                        total={cat.totalEmails}
                                        isGoogle={true}
                                        onClick={() => onMailboxSelect?.(cat.id)}
                                        isCollapsed={isCollapsed}
                                        draggable={true}
                                        onDragStart={(e) =>
                                          handleReorderDragStart(e, {
                                            level: 'item',
                                            id: cat.id,
                                            parentKey,
                                          })
                                        }
                                        onDragOver={(e) =>
                                          handleReorderDragOver(e, {
                                            level: 'item',
                                            id: cat.id,
                                            parentKey,
                                          })
                                        }
                                        onDrop={(e) =>
                                          handleReorderDrop(
                                            e,
                                            {
                                              level: 'item',
                                              id: cat.id,
                                              parentKey,
                                            },
                                            orderedCats.map((c) => c.id)
                                          )
                                        }
                                        onDragEnd={handleReorderDragEnd}
                                        isDragging={isItemDragging}
                                        isDragOver={isItemDragOver}
                                      />
                                    );
                                  });
                                })()}

                                {/* Google User Labels */}
                                {subcat.type === 'google_labels' && (() => {
                                  const gAccountData = googleMail.accountsData.find(
                                    (g) => g.account.email === account.email
                                  );
                                  const userLabels = (gAccountData?.mailboxes ?? []).filter(
                                    (m) =>
                                      !isGoogleSystemFolder(m) &&
                                      !isGoogleCategoryLabel(m.originalId || m.id || m.role) &&
                                      !isGmailStarLabel(m)
                                  );
                                  const orderedLabels = getOrderedGoogleLabels(account.email, userLabels);
                                  const parentKey = `google:${account.email}:labels`;

                                  return orderedLabels.length === 0 ? (
                                    <div className="px-6 py-1.5 text-xs text-muted-foreground italic">
                                      {!isCollapsed && "No labels"}
                                    </div>
                                  ) : (
                                    orderedLabels.map((node) => {
                                      const isItemDragging =
                                        dragReorderSource?.level === 'item' &&
                                        dragReorderSource?.id === node.id &&
                                        dragReorderSource?.parentKey === parentKey;
                                      const isItemDragOver =
                                        dragReorderTarget?.level === 'item' &&
                                        dragReorderTarget?.id === node.id &&
                                        dragReorderTarget?.parentKey === parentKey;

                                      return (
                                        <MailboxTreeItem
                                          key={node.id}
                                          node={node}
                                          selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                                          expandedFolders={expandedFolders}
                                          onMailboxSelect={onMailboxSelect}
                                          onToggleExpand={handleToggleExpand}
                                          isCollapsed={isCollapsed}
                                          colorful={colorfulSidebarIcons}
                                          depthOffset={0}
                                          dragAccountId={`google:${account.email}`}
                                          draggable={true}
                                          isGoogle={true}
                                          onDragStart={(e) =>
                                            handleReorderDragStart(e, {
                                              level: 'item',
                                              id: node.id,
                                              parentKey,
                                            })
                                          }
                                          onDragOver={(e) =>
                                            handleReorderDragOver(e, {
                                              level: 'item',
                                              id: node.id,
                                              parentKey,
                                            })
                                          }
                                          onDrop={(e) =>
                                            handleReorderDrop(
                                              e,
                                              {
                                                level: 'item',
                                                id: node.id,
                                                parentKey,
                                              },
                                              orderedLabels.map((n) => n.id)
                                            )
                                          }
                                          onDragEnd={handleReorderDragEnd}
                                          isDragging={isItemDragging}
                                          isDragOver={isItemDragOver}
                                        />
                                      );
                                    })
                                  );
                                })()}

                                {/* Google 12 Stars Subcategory */}
                                {subcat.type === 'google_stars' && (() => {
                                  const hiddenStars = googleHiddenStarIds?.[account.email] || [];
                                  const visibleStars = (Object.keys(GMAIL_STARS) as GmailStarId[])
                                    .map((id) => GMAIL_STARS[id])
                                    .filter((s) => !hiddenStars.includes(s.id));

                                  return visibleStars.map((star) => {
                                    const starMailboxId = `google:${account.email}::star:${star.id}`;
                                    const isSelected = !selectedKeyword && selectedMailbox === starMailboxId;

                                    return (
                                      <SidebarRow
                                        key={star.id}
                                        icon={
                                          <img
                                            src={withBasePath(star.iconPath)}
                                            alt={star.name}
                                            className="w-4 h-4 object-contain flex-shrink-0"
                                          />
                                        }
                                        label={star.name}
                                        testRole="star"
                                        testName={star.name}
                                        testMailboxId={starMailboxId}
                                        depth={0}
                                        isSelected={isSelected}
                                        isGoogle={true}
                                        onClick={() => onMailboxSelect?.(starMailboxId)}
                                        isCollapsed={isCollapsed}
                                      />
                                    );
                                  });
                                })()}

                                {/* Microsoft System Folders */}
                                {subcat.type === 'microsoft_folders' && (() => {
                                  const prefix = `microsoft:${account.email}::`;
                                  const msFolders = microsoftMail.mailboxes.filter(
                                    (m) => m.id.startsWith(prefix) && Boolean(m.role)
                                  );
                                  const visible = msFolders.filter(
                                    (m) => !isNodeHidden(m.id) || m.id === selectedMailbox
                                  );
                                  const sorted = [...visible].sort(
                                    (a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10)
                                  );
                                  const parentKey = `microsoft:${account.email}:folders`;
                                  const orderedFolders = applyCustomOrder(
                                    sorted,
                                    customOrder.items[parentKey],
                                    (m) => m.id
                                  );

                                  return orderedFolders.length === 0 ? (
                                    <div className="px-6 py-1.5 text-xs text-muted-foreground italic">
                                      {!isCollapsed && t("loading_mailboxes")}
                                    </div>
                                  ) : (
                                    orderedFolders.map((mb) => {
                                      const isSelected = !selectedKeyword && selectedMailbox === mb.id;
                                      const roleKey = resolveRoleKey(mb.role, mb.name);
                                      const Icon = getIconForMailbox(mb.role, mb.name, false, false, false, mb.id);

                                      return (
                                        <SidebarRow
                                          key={mb.id}
                                          icon={<Icon className={getIconClass(isSelected, false, colorfulSidebarIcons, roleKey)} />}
                                          label={mb.name}
                                          testRole={mb.role}
                                          testName={mb.name}
                                          testMailboxId={mb.id}
                                          depth={0}
                                          isSelected={isSelected}
                                          unread={mb.unreadEmails}
                                          total={mb.totalEmails}
                                          isGoogle={true}
                                          onClick={() => onMailboxSelect?.(mb.id)}
                                          isCollapsed={isCollapsed}
                                        />
                                      );
                                    })
                                  );
                                })()}

                                {/* Microsoft Custom Folders */}
                                {subcat.type === 'microsoft_labels' && (() => {
                                  const prefix = `microsoft:${account.email}::`;
                                  const customFolders = microsoftMail.mailboxes.filter(
                                    (m) => m.id.startsWith(prefix) && !m.role
                                  );
                                  const tree = buildMailboxTree(customFolders);
                                  const visibleTree = filterVisibleMailboxTree(tree, isNodeHidden, selectedMailbox);

                                  return visibleTree.map((node) => (
                                    <MailboxTreeItem
                                      key={node.id}
                                      node={node}
                                      selectedMailbox={selectedKeyword ? "" : selectedMailbox}
                                      expandedFolders={expandedFolders}
                                      onMailboxSelect={onMailboxSelect}
                                      onToggleExpand={handleToggleExpand}
                                      isCollapsed={isCollapsed}
                                      colorful={colorfulSidebarIcons}
                                      depthOffset={0}
                                      dragAccountId={`microsoft:${account.email}`}
                                      isGoogle={true}
                                    />
                                  ));
                                })()}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isCollapsed && <PluginSlot name="sidebar-widget" className="border-t border-border" />}
      </div>

      <MailboxContextMenu
        target={mailboxContextMenu.data}
        position={mailboxContextMenu.position}
        isOpen={mailboxContextMenu.isOpen}
        onClose={closeMailboxContextMenu}
        menuRef={mailboxMenuRef}
        mailboxes={mailboxes}
        onMarkFolderRead={onMarkFolderRead}
        onMarkFolderTreeRead={onMarkFolderTreeRead}
        onMarkAllFoldersRead={onMarkAllFoldersRead}
        onEmptyFolder={onEmptyFolder}
        onCreateSubfolder={onCreateSubfolder}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onShareFolder={onShareFolder}
        onImportEmail={onImportEmail}
        onRefresh={onRefreshMailboxes}
      />
    </div>
  );
}
