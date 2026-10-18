"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Globe, ListTodo, Pencil, RefreshCw, Share2, Star, Trash2, Cake, User, Users, Plus, Eraser, Palette, Shuffle, Check, Calendar as CalendarIcon, ExternalLink, MoreVertical } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { cn, formatDateTime } from "@/lib/utils";
import { withBasePath } from "@/lib/browser-navigation";
import type { Calendar } from "@/lib/jmap/types";
import { CalendarColorPicker } from "@/components/settings/calendar-management-settings";
import { useCalendarStore } from "@/stores/calendar-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTaskStore } from "@/stores/task-store";
import { useAccountStore } from "@/stores/account-store";
import { BIRTHDAY_CALENDAR_ID } from "@/lib/birthday-calendar";
import { sharedCalendarColorKey } from "@/lib/shared-calendar-colors";
import { toast } from "@/stores/toast-store";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubMenu } from "@/components/ui/context-menu";
import { useContextMenu } from "@/hooks/use-context-menu";
import type { IJMAPClient } from '@/lib/jmap/client-interface';
import { displayNow } from "@/lib/timezone";
import { GoogleCalendarSection } from "./google-calendar-section";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { readableTextOn } from "@/lib/color-transform";

/**
 * Split a per-account calendar list into "owned" (the user's own) and
 * "shared" sub-buckets, then group shared by the owning principal so each
 * delegator gets its own sub-section.
 */
type AccountCalendarSplit = {
  owned: Calendar[];
  sharedGroups: { label: string; calendars: Calendar[] }[];
};

function splitAccountCalendars(list: Calendar[]): AccountCalendarSplit {
  const owned: Calendar[] = [];
  const sharedBuckets = new Map<string, { label: string; calendars: Calendar[] }>();
  for (const cal of list) {
    if (cal.isShared) {
      const key = cal.accountId || cal.accountName || cal.id;
      const bucket = sharedBuckets.get(key);
      if (bucket) {
        bucket.calendars.push(cal);
      } else {
        sharedBuckets.set(key, { label: cal.accountName || key, calendars: [cal] });
      }
    } else {
      owned.push(cal);
    }
  }
  return { owned, sharedGroups: Array.from(sharedBuckets.values()) };
}

interface CalendarSidebarPanelProps {
  calendars: Calendar[];
  selectedCalendarIds: string[];
  onToggleVisibility: (id: string) => void;
  onColorChange?: (calendarId: string, color: string) => void;
  onResetColor?: (calendar: Calendar) => void;
  onShareCalendar?: (calendar: Calendar) => void;
  onCreateEvent?: (calendar: Calendar) => void;
  onClearCalendar?: (calendar: Calendar) => void;
  onDeleteCalendar?: (calendar: Calendar) => void;
  onCreateCalendar?: () => void;
  onSubscribe?: () => void;
  onEditSubscription?: (subscriptionId: string) => void;
  client?: IJMAPClient | null;
  /**
   * When true, render one collapsible section per connected local account,
   * mirroring the mail sidebar's Pro-shell layout. Calendars are bucketed
   * by their `localAccountId` and the active account is shown first.
   */
  multiAccountMode?: boolean;
}

export function CalendarSidebarPanel({
  calendars,
  selectedCalendarIds,
  onToggleVisibility,
  onColorChange,
  onResetColor,
  onShareCalendar,
  onCreateEvent,
  onClearCalendar,
  onDeleteCalendar,
  onCreateCalendar,
  onSubscribe,
  onEditSubscription,
  client,
  multiAccountMode,
}: CalendarSidebarPanelProps) {
  const t = useTranslations("calendar");
  const tSub = useTranslations("calendar.subscription");
  const tMgmt = useTranslations("calendar.management");
  const isSubscriptionCalendar = useCalendarStore((s) => s.isSubscriptionCalendar);
  const allSubs = useCalendarStore((s) => s.icalSubscriptions);
  const currentAccountId = client?.getAccountId();
  const icalSubscriptions = useMemo(
    () => allSubs.filter(s => !s.accountId || s.accountId === currentAccountId),
    [allSubs, currentAccountId],
  );
  const refreshICalSubscription = useCalendarStore((s) => s.refreshICalSubscription);
  const removeICalSubscription = useCalendarStore((s) => s.removeICalSubscription);
  const setDefaultCalendar = useCalendarStore((s) => s.setDefaultCalendar);
  const updateCalendar = useCalendarStore((s) => s.updateCalendar);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const sharedCalendarColors = useSettingsStore((s) => s.sharedCalendarColors);
  const enableCalendarTasks = useSettingsStore((s) => s.enableCalendarTasks);
  const showTasksOnCalendar = useSettingsStore((s) => s.showTasksOnCalendar);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const tasks = useTaskStore((s) => s.tasks);
  const setViewMode = useCalendarStore((s) => s.setViewMode);

  const pendingTaskCount = useMemo(() => tasks.filter(t => t.progress !== 'completed' && t.progress !== 'cancelled').length, [tasks]);
  const overdueTaskCount = useMemo(() => {
    const now = displayNow();
    return tasks.filter(t => t.progress !== 'completed' && t.progress !== 'cancelled' && t.due && new Date(t.due) < now).length;
  }, [tasks]);

  const { contextMenu, openContextMenu, closeContextMenu, menuRef } = useContextMenu<Calendar>();
  const [refreshingSubId, setRefreshingSubId] = useState<string | null>(null);

  // Persisted across mounts so toggle state survives tab switches in the
  // Pro shell (same key family as the mail sidebar's account collapse).
  const [collapsedAccountGroups, setCollapsedAccountGroups] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('calendar-sidebar-collapsed-accounts');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const toggleAccountGroup = (key: string) => {
    setCollapsedAccountGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('calendar-sidebar-collapsed-accounts', JSON.stringify(Array.from(next))); } catch { /* */ }
      return next;
    });
  };

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('calendar-sidebar-collapsed-sections');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('calendar-sidebar-collapsed-sections', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const localAccounts = useAccountStore((s) => s.accounts);
  const activeLocalAccountId = useAccountStore((s) => s.activeAccountId);

  const googleCalendar = useGoogleCalendar();

  const allCombinedCalendars = useMemo(() => {
    const existingIds = new Set(calendars.map(c => c.id));
    const extraGoogle = (googleCalendar.status.connected ? googleCalendar.calendars : []).filter(gc => !existingIds.has(gc.id));
    return [...calendars, ...extraGoogle];
  }, [calendars, googleCalendar.calendars, googleCalendar.status.connected]);

  // Tasks-only calendars (VTODO, no events) are kept in the store for the tasks
  // view but hidden from the event calendar list here.
  const eventCalendars = useMemo(() => allCombinedCalendars.filter(c => !c.isTasksOnly), [allCombinedCalendars]);

  const isGoogleCalendar = (cal: Calendar) =>
    cal.id.startsWith('google:') || (cal.localAccountId?.startsWith('google:') ?? false);

  const comailEventCalendars = useMemo(
    () => eventCalendars.filter(c => !isGoogleCalendar(c)),
    [eventCalendars],
  );
  const comailPersonalCalendars = useMemo(
    () => comailEventCalendars.filter(c => !c.isShared),
    [comailEventCalendars],
  );
  const comailSharedAccountGroups = useMemo(() => {
    const shared = comailEventCalendars.filter(c => c.isShared);
    const groups = new Map<string, { accountName: string; calendars: Calendar[] }>();
    for (const cal of shared) {
      const key = cal.accountId || cal.accountName || cal.id;
      if (!groups.has(key)) {
        groups.set(key, { accountName: cal.accountName || key, calendars: [] });
      }
      groups.get(key)!.calendars.push(cal);
    }
    return Array.from(groups.values());
  }, [comailEventCalendars]);

  /**
   * Pro / multi-account grouping: every calendar bucketed by its owning
   * local account. Active account comes first, then the rest in their
   * account-store order. Calendars without a `localAccountId` (e.g. the
   * birthday calendar) fall into a separate "other" bucket so they still
   * render.
   */
  const localAccountGroups = useMemo(() => {
    if (!multiAccountMode) return [];
    const byAccount = new Map<string, Calendar[]>();
    for (const cal of comailEventCalendars) {
      const key = cal.localAccountId || '__other__';
      const list = byAccount.get(key) ?? [];
      list.push(cal);
      byAccount.set(key, list);
    }
    const ordered: { key: string; label: string; split: AccountCalendarSplit }[] = [];
    // Active account first.
    if (activeLocalAccountId && byAccount.has(activeLocalAccountId)) {
      const acct = localAccounts.find(a => a.id === activeLocalAccountId);
      ordered.push({
        key: activeLocalAccountId,
        label: acct?.label || acct?.email || acct?.username || activeLocalAccountId,
        split: splitAccountCalendars(byAccount.get(activeLocalAccountId)!),
      });
      byAccount.delete(activeLocalAccountId);
    }
    // Then the rest in account-store order so the layout matches the mail sidebar.
    for (const acct of localAccounts) {
      if (!byAccount.has(acct.id)) continue;
      ordered.push({
        key: acct.id,
        label: acct.label || acct.email || acct.username,
        split: splitAccountCalendars(byAccount.get(acct.id)!),
      });
      byAccount.delete(acct.id);
    }
    // Any leftover buckets (deleted accounts, untagged calendars).
    for (const [key, list] of byAccount.entries()) {
      const fallbackLabel = key === '__other__'
        ? t('my_calendars')
        : list[0]?.accountName || key;
      ordered.push({ key, label: fallbackLabel, split: splitAccountCalendars(list) });
    }
    return ordered;
  }, [multiAccountMode, comailEventCalendars, localAccounts, activeLocalAccountId, t]);

  const getSubscriptionForCalendar = (calendarId: string) => {
    return icalSubscriptions.find(s => s.calendarId === calendarId);
  };

  const handleRefreshSubscription = async (subId: string) => {
    if (!client) return;
    setRefreshingSubId(subId);
    try {
      await refreshICalSubscription(client, subId);
      toast.success(tSub('refresh_success'));
    } catch {
      toast.error(tSub('refresh_error'));
    } finally {
      setRefreshingSubId(null);
    }
  };

  const handleUnsubscribe = async (subId: string) => {
    if (!client) return;
    try {
      await removeICalSubscription(client, subId);
      toast.success(tSub('deleted'));
    } catch {
      toast.error(tSub('delete_error'));
    }
  };

  const handleSetDefault = async (calendarId: string) => {
    try {
      await setDefaultCalendar(client, calendarId);
      toast.success(tMgmt('default_updated'));
    } catch {
      toast.error(tMgmt('error_default'));
    }
  };

  const handleStartRename = async (cal: Calendar) => {
    const newName = window.prompt(tMgmt('edit'), cal.name);
    if (newName && newName.trim() && newName.trim() !== cal.name) {
      try {
        await updateCalendar(client, cal.id, { name: newName.trim() });
        toast.success(tMgmt('calendar_updated'));
      } catch {
        toast.error(tMgmt('error_update'));
      }
    }
  };

  if (calendars.length === 0 && !onSubscribe) return null;

  const activeAccount = localAccounts.find(a => a.id === activeLocalAccountId);
  const activeAccountEmail = activeAccount?.email || activeAccount?.username || (client ? client.getUsername() : '');

  const getCalendarDisplayName = (cal: Calendar) => {
    if (!isGoogleCalendar(cal)) {
      if (cal.name === 'Stalwart Calendar' || (cal.isDefault && (!cal.name || cal.name === 'Stalwart Calendar' || cal.name === 'Default'))) {
        const matchedAccount = localAccounts.find(a => a.id === cal.localAccountId || a.id === activeLocalAccountId);
        return cal.accountName || matchedAccount?.email || matchedAccount?.username || activeAccountEmail || cal.name;
      }
    }
    return cal.name;
  };

  const renderCalendarItem = (cal: Calendar) => {
    const isVisible = selectedCalendarIds.includes(cal.id);
    const color = cal.color || "#3b82f6";
    const hasMenu = isSubscriptionCalendar(cal.id) ? !!client : true;
    const displayName = getCalendarDisplayName(cal);

    return (
      <div key={cal.id} className="relative group/cal">
        <button
          onClick={() => onToggleVisibility(cal.id)}
          onContextMenu={hasMenu ? (e) => openContextMenu(e, cal) : undefined}
          role="checkbox"
          aria-checked={isVisible}
          data-testid="calendar-item"
          data-calendar-name={displayName}
          data-account={cal.accountName ?? ''}
          data-visible={isVisible}
          className={cn(
            "mx-2 w-[calc(100%-16px)] rounded-md flex items-center gap-2 ps-3.5 pe-3 text-sm text-foreground/80 transition-colors duration-150",
            "hover:bg-muted/50",
            hasMenu && "pe-9"
          )}
          style={{ paddingBlock: 'var(--density-sidebar-py, 4px)', minHeight: '32px' }}
        >
          {/* A checkbox filled in the calendar colour, empty when hidden. */}
          <span
            className={cn(
              "w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors",
              !isVisible && "border-muted-foreground/40 bg-transparent"
            )}
            style={isVisible ? { backgroundColor: color, borderColor: color, color: readableTextOn(color) } : undefined}
            aria-hidden="true"
          >
            {isVisible && <Check className="w-2.5 h-2.5" stroke={3.5} />}
          </span>
          <span className={cn("truncate", !isVisible && "text-muted-foreground")}>
            {displayName}
          </span>
          {isSubscriptionCalendar(cal.id) && (
            <>
              <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              {refreshingSubId === getSubscriptionForCalendar(cal.id)?.id && (
                <RefreshCw className="w-3 h-3 text-muted-foreground flex-shrink-0 animate-spin" />
              )}
            </>
          )}
          {(cal.id === BIRTHDAY_CALENDAR_ID || cal.id.endsWith('::#birthdays') || cal.name.toLowerCase() === 'birthdays') && (
            <Cake className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
          {!cal.isShared && Object.keys(cal.shareWith || {}).length > 0 && (
            <Users
              className="w-3 h-3 text-muted-foreground flex-shrink-0"
              aria-label={tMgmt('share')}
            />
          )}
        </button>
        {hasMenu && (
          <button
            type="button"
            onClick={(e) => openContextMenu(e, cal)}
            className={cn(
              "absolute end-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-opacity",
              "opacity-0 group-hover/cal:opacity-100 focus-visible:opacity-100",
              contextMenu.isOpen && contextMenu.data?.id === cal.id && "opacity-100"
            )}
            aria-label={t('calendar_options', { name: cal.name })}
            title={t('calendar_options', { name: cal.name })}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  const renderCalendarMenu = () => {
    const cal = contextMenu.data;
    if (!cal) return null;

    if (isSubscriptionCalendar(cal.id)) {
      const sub = getSubscriptionForCalendar(cal.id);
      if (!sub || !client) return null;
      return (
        <ContextMenu ref={menuRef} isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={closeContextMenu}>
          <ContextMenuItem
            icon={Pencil}
            label={tSub('edit')}
            onClick={() => { closeContextMenu(); onEditSubscription?.(sub.id); }}
          />
          <ContextMenuItem
            icon={RefreshCw}
            label={tSub('refresh')}
            onClick={() => { closeContextMenu(); handleRefreshSubscription(sub.id); }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={Trash2}
            label={tSub('unsubscribe')}
            onClick={() => { closeContextMenu(); handleUnsubscribe(sub.id); }}
            destructive
          />
          {sub.lastRefreshed && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border mt-1 pt-1">
              {tSub('last_refreshed', { time: formatDateTime(sub.lastRefreshed, timeFormat, { month: 'short', day: 'numeric', year: 'numeric' }) })}
            </div>
          )}
        </ContextMenu>
      );
    }

    const isBirthday = cal.id === BIRTHDAY_CALENDAR_ID || cal.id.endsWith('::#birthdays') || cal.name.toLowerCase() === 'birthdays';
    const canCreate = onCreateEvent && !isBirthday && cal.myRights?.mayWriteOwn !== false;
    const canShare = onShareCalendar && cal.myRights?.mayShare && !cal.isShared && !isGoogleCalendar(cal);
    const canSetDefault = !isBirthday && !cal.spaceConsentRequired && !cal.isShared && !cal.isDefault;
    const canEdit = !isBirthday && !cal.spaceConsentRequired && !cal.isShared;
    const canChangeColor = !!onColorChange;
    const hasColorOverride = !!cal.isShared && !!sharedCalendarColors[sharedCalendarColorKey(cal)];
    const canResetColor = !!onResetColor && hasColorOverride;
    const canClear = onClearCalendar && !isBirthday && cal.myRights?.mayDelete !== false && !isGoogleCalendar(cal);
    const canDelete = onDeleteCalendar && !isBirthday && !cal.spaceConsentRequired && !cal.isDefault && !cal.isShared && !isGoogleCalendar(cal);
    const showSeparator = (canCreate || canShare || canSetDefault || canEdit || canChangeColor || canResetColor) && (canClear || canDelete);
    const color = cal.color || "#3b82f6";

    return (
      <ContextMenu ref={menuRef} isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={closeContextMenu}>
        {canCreate && (
          <ContextMenuItem
            icon={Plus}
            label={tMgmt('new_event_in_calendar')}
            onClick={() => { closeContextMenu(); onCreateEvent(cal); }}
          />
        )}
        {canShare && (
          <ContextMenuItem
            icon={Users}
            label={tMgmt('share')}
            onClick={() => { closeContextMenu(); onShareCalendar(cal); }}
          />
        )}
        {canSetDefault && (
          <ContextMenuItem
            icon={Star}
            label={tMgmt('set_default')}
            onClick={() => { closeContextMenu(); handleSetDefault(cal.id); }}
          />
        )}
        {canEdit && (
          <ContextMenuItem
            icon={Pencil}
            label={tMgmt('edit')}
            onClick={() => { closeContextMenu(); handleStartRename(cal); }}
          />
        )}
        {canChangeColor && (
          <ContextMenuSubMenu icon={Palette} label={tMgmt('change_color')}>
            <div className="px-2 py-1.5 w-[200px]">
              <CalendarColorPicker
                value={color}
                onChange={(c) => { onColorChange(cal.id, c); closeContextMenu(); }}
                allowCustom
              />
            </div>
          </ContextMenuSubMenu>
        )}
        {canResetColor && (
          <ContextMenuItem
            icon={Shuffle}
            label={tMgmt('random_color')}
            onClick={() => { closeContextMenu(); onResetColor!(cal); }}
          />
        )}
        {showSeparator && <ContextMenuSeparator />}
        {canClear && (
          <ContextMenuItem
            icon={Eraser}
            label={tMgmt('clear_events')}
            onClick={() => { closeContextMenu(); onClearCalendar(cal); }}
          />
        )}
        {canDelete && (
          <ContextMenuItem
            icon={Trash2}
            label={tMgmt('delete')}
            onClick={() => { closeContextMenu(); onDeleteCalendar(cal); }}
            destructive
          />
        )}
      </ContextMenu>
    );
  };

  const renderTasksItem = () => {
    if (!enableCalendarTasks) return null;
    return (
      <div className="relative">
        <div
          className={cn(
            "mx-2 w-[calc(100%-16px)] rounded-md flex items-center justify-between gap-2 ps-3.5 pe-3 text-sm text-foreground/80 transition-colors duration-150",
            "hover:bg-muted/50 group"
          )}
          style={{ paddingBlock: 'var(--density-sidebar-py, 4px)', minHeight: '32px' }}
        >
          <button
            type="button"
            onClick={() => updateSetting('showTasksOnCalendar', !showTasksOnCalendar)}
            className="flex items-center gap-2 flex-1 min-w-0 text-start cursor-pointer"
            title={showTasksOnCalendar ? "Hide tasks on calendar" : "Show tasks on calendar"}
          >
            <span
              className={cn(
                "w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                showTasksOnCalendar ? "border-transparent bg-[#4285F4] text-white" : "border-muted-foreground/40 bg-transparent"
              )}
              style={showTasksOnCalendar ? { backgroundColor: '#4285F4', borderColor: '#4285F4' } : undefined}
              aria-hidden="true"
            >
              {showTasksOnCalendar && <Check className="w-2.5 h-2.5" stroke={3.5} />}
            </span>
            <span className={cn("truncate", !showTasksOnCalendar && "text-muted-foreground")}>
              {t('tasks.label')}
            </span>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            {pendingTaskCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums font-normal">{pendingTaskCount}</span>
            )}
            {overdueTaskCount > 0 && (
              <span className="text-[10px] text-destructive font-semibold">
                {overdueTaskCount} {t('tasks.filter_overdue').toLowerCase()}
              </span>
            )}
            <Link
              href="/tasks"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
              title="Open Tasks app"
            >
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-2">
      {/* ── ALL Section ──────────────────────────────────────── */}
      <div className="pb-1">
        <div className="group flex items-center py-1 select-none rounded-md hover:bg-muted/40 transition-colors mx-2 w-[calc(100%-16px)] px-2 mb-0.5">
          <button
            type="button"
            onClick={() => toggleSection('all')}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent focus:outline-none"
            title={!collapsedSections['all'] ? "Collapse All Calendars" : "Expand All Calendars"}
          >
            {!collapsedSections['all'] ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            <CalendarIcon className="w-4 h-4 shrink-0 text-foreground/80" />
            <span className="text-[13px] font-bold text-foreground/90 tracking-tight truncate ms-1">
              All Calendars
            </span>
          </button>
        </div>

        {!collapsedSections['all'] && (
          <div className="space-y-0.5">
            {eventCalendars.map(renderCalendarItem)}
            {renderTasksItem()}
          </div>
        )}
      </div>

      {/* ── COMAIL Section ───────────────────────────────────── */}
      <div className="pt-3 pb-1">
        <div className="group flex items-center py-1.5 px-2.5 mx-2 w-[calc(100%-16px)] select-none rounded-lg border shadow-xs transition-colors bg-accent/40 hover:bg-accent/60 border-accent/40 text-foreground dark:bg-accent/25 dark:hover:bg-accent/40 dark:border-accent/35 mb-1">
          <button
            type="button"
            onClick={() => toggleSection('comail')}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent focus:outline-none"
            title={!collapsedSections['comail'] ? "Collapse Comail" : "Expand Comail"}
          >
            {!collapsedSections['comail'] ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="w-5 h-5 rounded-md flex items-center justify-center bg-background/60 flex-shrink-0 shadow-2xs border border-border/40">
              <img
                src={withBasePath("/branding/comail/cammie-mark.png")}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
            </span>
            <span className="text-xs font-semibold text-foreground tracking-tight truncate ms-1">
              {activeAccountEmail || "Comail"}
            </span>
          </button>

          {onCreateCalendar && (
            <button
              type="button"
              onClick={onCreateCalendar}
              className="ms-1 p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={tMgmt('add_calendar')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!collapsedSections['comail'] && (
          <>
            {multiAccountMode && localAccountGroups.length > 0 ? (
              localAccountGroups.map((group, idx) => {
                const expanded = !collapsedAccountGroups.has(group.key);
                const isActive = group.key === activeLocalAccountId;
                const { owned, sharedGroups } = group.split;
                return (
                  <div key={group.key} className={cn(idx === 0 ? "" : "mt-2")}>
                    <button
                      onClick={() => toggleAccountGroup(group.key)}
                      className="group flex items-center gap-1.5 mx-2 w-[calc(100%-16px)] px-2 py-1 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-semibold text-foreground/90 truncate ms-1">
                        {group.label}
                      </span>
                      {isActive && onCreateCalendar && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); onCreateCalendar(); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onCreateCalendar();
                            }
                          }}
                          className="ms-auto p-0.5 rounded text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title={tMgmt('add_calendar')}
                        >
                          <Plus className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                    {expanded && (
                      <div className="mt-0.5">
                        {owned.length > 0 && (
                          <div className="space-y-0.5">
                            {owned.map(renderCalendarItem)}
                          </div>
                        )}
                        {sharedGroups.map((sg) => (
                          <div key={`${group.key}-shared-${sg.label}`} className="mt-2">
                            <div className="mx-2 w-[calc(100%-16px)] px-2 mb-0.5 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                              <Share2 className="w-3 h-3" />
                              {sg.label}
                            </div>
                            <div className="space-y-0.5">
                              {sg.calendars.map(renderCalendarItem)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="space-y-0.5">
                {comailPersonalCalendars.map(renderCalendarItem)}
                {comailSharedAccountGroups.map((group) => (
                  <div key={group.accountName} className="mt-2">
                    <div className="mx-2 w-[calc(100%-16px)] px-2 mb-0.5 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Share2 className="w-3 h-3" />
                      {group.accountName}
                    </div>
                    <div className="space-y-0.5">
                      {group.calendars.map(renderCalendarItem)}
                    </div>
                  </div>
                ))}
                {!googleCalendar.status.connected && renderTasksItem()}
              </div>
            )}
            {multiAccountMode && localAccountGroups.length > 0 && !googleCalendar.status.connected && (
              <div className="mt-0.5">
                {renderTasksItem()}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── GOOGLE Section ───────────────────────────────────── */}
      <GoogleCalendarSection
        googleCalendar={googleCalendar}
        onToggleVisibility={onToggleVisibility}
        selectedCalendarIds={selectedCalendarIds}
        isExpanded={!collapsedSections['google']}
        onToggleExpand={() => toggleSection('google')}
        onContextMenu={(e, cal) => openContextMenu(e, cal)}
      />

      {renderCalendarMenu()}
    </div>
  );
}
