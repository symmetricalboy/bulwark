"use client";

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { useCalendarStore } from '@/stores/calendar-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTaskStore } from '@/stores/task-store';
import { displayNow } from '@/lib/timezone';
import { Check, RefreshCw, LogOut, ChevronDown, ChevronRight, Cake, ExternalLink, GoogleCalendarIcon, GoogleIcon, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Calendar } from '@/lib/jmap/types';

interface GoogleCalendarSectionProps {
  onToggleVisibility?: (id: string) => void;
  selectedCalendarIds?: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  googleCalendar?: ReturnType<typeof useGoogleCalendar>;
  onContextMenu?: (e: React.MouseEvent, cal: Calendar) => void;
}

export function GoogleCalendarSection(props: GoogleCalendarSectionProps) {
  if (props.googleCalendar) {
    return <GoogleCalendarSectionContent {...props} googleCalendar={props.googleCalendar} />;
  }
  return <GoogleCalendarSectionWithHook {...props} />;
}

function GoogleCalendarSectionWithHook(props: GoogleCalendarSectionProps) {
  const googleCalendar = useGoogleCalendar();
  return <GoogleCalendarSectionContent {...props} googleCalendar={googleCalendar} />;
}

function GoogleCalendarSectionContent({
  onToggleVisibility,
  selectedCalendarIds = [],
  isExpanded,
  onToggleExpand,
  googleCalendar,
  onContextMenu,
}: GoogleCalendarSectionProps & { googleCalendar: ReturnType<typeof useGoogleCalendar> }) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = isExpanded !== undefined ? isExpanded : internalExpanded;
  const handleToggleExpand = onToggleExpand ?? (() => setInternalExpanded((v) => !v));
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});

  const toggleAccountCollapsed = (email: string) => {
    setCollapsedAccounts((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  const t = useTranslations("calendar");
  const enableCalendarTasks = useSettingsStore((s) => s.enableCalendarTasks);
  const showTasksOnCalendar = useSettingsStore((s) => s.showTasksOnCalendar);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const tasks = useTaskStore((s) => s.tasks);

  const pendingTaskCount = useMemo(
    () => tasks.filter((t) => t.progress !== 'completed' && t.progress !== 'cancelled').length,
    [tasks]
  );
  const overdueTaskCount = useMemo(() => {
    const now = displayNow();
    return tasks.filter(
      (t) => t.progress !== 'completed' && t.progress !== 'cancelled' && t.due && new Date(t.due) < now
    ).length;
  }, [tasks]);

  const { status, calendars, isLoading, connectGoogle, disconnectGoogle, loadCalendars, refreshEvents } = googleCalendar;
  const toggleVisibility = useCalendarStore((s) => s.toggleCalendarVisibility);

  // Group calendars by Google account email
  const accountGroups = useMemo(() => {
    const groups = new Map<string, { email: string; name?: string; calendars: Calendar[] }>();

    // Seed groups from status.accounts if available
    (status.accounts || []).forEach((acc) => {
      if (acc.email) {
        groups.set(acc.email.toLowerCase(), {
          email: acc.email,
          name: acc.name,
          calendars: [],
        });
      }
    });

    // Also include status.email if not already present
    if (status.email && !groups.has(status.email.toLowerCase())) {
      groups.set(status.email.toLowerCase(), {
        email: status.email,
        name: status.name,
        calendars: [],
      });
    }

    // Populate calendars into groups
    calendars.forEach((cal) => {
      let email = '';
      if (cal.localAccountId?.startsWith('google:')) {
        email = cal.localAccountId.replace(/^google:/, '');
      } else if (cal.id.startsWith('google:')) {
        email = cal.id.split('::')[0].replace(/^google:/, '');
      } else {
        email = status.email || 'google';
      }

      const key = email.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, { email, calendars: [] });
      }
      groups.get(key)!.calendars.push(cal);
    });

    return Array.from(groups.values()).map((g) => ({
      ...g,
      calendars: [...g.calendars].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (a.name || '').localeCompare(b.name || '');
      }),
    }));
  }, [calendars, status.accounts, status.email, status.name]);

  const handleToggle = (id: string) => {
    if (onToggleVisibility) {
      onToggleVisibility(id);
    } else {
      toggleVisibility(id);
    }
  };

  const handleManualRefresh = () => {
    void loadCalendars();
    void refreshEvents();
  };

  return (
    <div className="mb-3 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between mb-1 px-1">
        <button
          onClick={handleToggleExpand}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-start py-0.5 text-muted-foreground hover:text-foreground transition-colors group"
          title={expanded ? "Collapse Google" : "Expand Google"}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          )}
          {/* Google Calendar Logo */}
          <GoogleCalendarIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider truncate">
            Google Calendars
          </span>
        </button>

        {status.connected && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleManualRefresh}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Refresh Google Calendars & Events"
            >
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <>
          {!status.connected ? (
            <div className="px-1 py-1.5">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-8 flex items-center justify-center gap-2 border-border/60 bg-background !text-[#1f1f1f] dark:!text-[#e3e3e3] hover:bg-accent hover:!text-black dark:hover:!text-white font-medium shadow-sm"
                onClick={connectGoogle}
              >
                <GoogleIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium !text-[#1f1f1f] dark:!text-[#e3e3e3]">Sign in with Google</span>
              </Button>
              {!status.configured && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/80 leading-tight">
                  OAuth credentials needed in <code className="text-[10px] bg-muted px-1 py-0.5 rounded">.env.local</code>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              {accountGroups.map((group) => {
                const isGroupCollapsed = collapsedAccounts[group.email] === true;
                return (
                  <div key={group.email} className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
                      <button
                        onClick={() => toggleAccountCollapsed(group.email)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-start group"
                        title={group.email}
                      >
                        {isGroupCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-xs font-semibold text-foreground tracking-tight" title={group.email}>
                          {group.email}
                        </span>
                      </button>
                      <button
                        onClick={() => void disconnectGoogle(group.email)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                        title={`Disconnect ${group.email}`}
                      >
                        <LogOut className="w-3 h-3" />
                      </button>
                    </div>

                    {!isGroupCollapsed && (
                      <div className="p-1 space-y-0.5">
                        {group.calendars.length === 0 ? (
                          <div className="px-2 py-1 text-xs text-muted-foreground italic">
                            {isLoading ? 'Loading calendars...' : 'No calendars found'}
                          </div>
                        ) : (
                          group.calendars.map((cal) => {
                            const isSelected = selectedCalendarIds.includes(cal.id);
                            const color = cal.color || '#4285F4';

                            return (
                              <div
                                key={cal.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 cursor-pointer text-xs group transition-colors"
                                onClick={() => handleToggle(cal.id)}
                                onContextMenu={(e) => {
                                  if (onContextMenu) {
                                    e.preventDefault();
                                    onContextMenu(e, cal);
                                  }
                                }}
                              >
                                <div
                                  className={cn(
                                    "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                                    isSelected ? "border-transparent text-white" : "border-muted-foreground/30 bg-background"
                                  )}
                                  style={{ backgroundColor: isSelected ? color : undefined }}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="truncate flex-1 font-medium">{cal.name}</span>
                                {(cal.originalId === '#birthdays' || cal.name.toLowerCase() === 'birthdays') && (
                                  <Cake className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="px-1 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs h-7 flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-border/60 hover:border-border"
                  onClick={connectGoogle}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another Google Account</span>
                </Button>
              </div>

              {enableCalendarTasks && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 cursor-pointer text-xs group transition-colors mt-2 pt-2 border-t border-border/30"
                  onClick={() => updateSetting('showTasksOnCalendar', !showTasksOnCalendar)}
                  title={showTasksOnCalendar ? "Hide tasks on calendar" : "Show tasks on calendar"}
                >
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                      showTasksOnCalendar ? "border-transparent text-white bg-[#4285F4]" : "border-muted-foreground/30 bg-background"
                    )}
                    style={{ backgroundColor: showTasksOnCalendar ? '#4285F4' : undefined }}
                  >
                    {showTasksOnCalendar && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={cn("truncate flex-1 font-medium", !showTasksOnCalendar && "text-muted-foreground")}>
                    {t('tasks.label')}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {pendingTaskCount > 0 && (
                      <span className="text-[11px] text-muted-foreground font-normal">{pendingTaskCount}</span>
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
