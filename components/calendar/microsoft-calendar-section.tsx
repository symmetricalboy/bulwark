"use client";

import { useState, useMemo } from 'react';
import { useMicrosoftCalendar } from '@/hooks/use-microsoft-calendar';
import { useCalendarStore } from '@/stores/calendar-store';
import { Check, RefreshCw, LogOut, ChevronDown, ChevronRight, Cake, MicrosoftCalendarIcon, MicrosoftIcon, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Calendar } from '@/lib/jmap/types';

interface MicrosoftCalendarSectionProps {
  onToggleVisibility?: (id: string) => void;
  selectedCalendarIds?: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  microsoftCalendar?: ReturnType<typeof useMicrosoftCalendar>;
  onContextMenu?: (e: React.MouseEvent, cal: Calendar) => void;
}

export function MicrosoftCalendarSection(props: MicrosoftCalendarSectionProps) {
  if (props.microsoftCalendar) {
    return <MicrosoftCalendarSectionContent {...props} microsoftCalendar={props.microsoftCalendar} />;
  }
  return <MicrosoftCalendarSectionWithHook {...props} />;
}

function MicrosoftCalendarSectionWithHook(props: MicrosoftCalendarSectionProps) {
  const microsoftCalendar = useMicrosoftCalendar();
  return <MicrosoftCalendarSectionContent {...props} microsoftCalendar={microsoftCalendar} />;
}

function MicrosoftCalendarSectionContent({
  onToggleVisibility,
  selectedCalendarIds = [],
  isExpanded,
  onToggleExpand,
  microsoftCalendar,
  onContextMenu,
}: MicrosoftCalendarSectionProps & { microsoftCalendar: ReturnType<typeof useMicrosoftCalendar> }) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = isExpanded !== undefined ? isExpanded : internalExpanded;
  const handleToggleExpand = onToggleExpand ?? (() => setInternalExpanded((v) => !v));
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});

  const toggleAccountCollapsed = (email: string) => {
    setCollapsedAccounts((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  const { status, calendars, isLoading, connectMicrosoft, disconnectMicrosoft, loadCalendars, refreshEvents } = microsoftCalendar;
  const toggleVisibility = useCalendarStore((s) => s.toggleCalendarVisibility);

  const accountGroups = useMemo(() => {
    const groups = new Map<string, { email: string; name?: string; calendars: Calendar[] }>();

    (status.accounts || []).forEach((acc) => {
      if (acc.email) {
        groups.set(acc.email.toLowerCase(), {
          email: acc.email,
          name: acc.name,
          calendars: [],
        });
      }
    });

    if (status.email && !groups.has(status.email.toLowerCase())) {
      groups.set(status.email.toLowerCase(), {
        email: status.email,
        name: status.name,
        calendars: [],
      });
    }

    calendars.forEach((cal) => {
      let email = '';
      if (cal.localAccountId?.startsWith('microsoft:')) {
        email = cal.localAccountId.replace(/^microsoft:/, '');
      } else if (cal.id.startsWith('microsoft:')) {
        email = cal.id.split('::')[0].replace(/^microsoft:/, '');
      } else {
        email = status.email || 'microsoft';
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
    <div className="pt-3 pb-1">
      {!status.connected ? (
        <>
          <div className="group flex items-center py-1 select-none rounded-md hover:bg-muted/40 transition-colors mx-2 w-[calc(100%-16px)] px-2 mb-0.5">
            <button
              type="button"
              onClick={handleToggleExpand}
              className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent focus:outline-none"
              title={expanded ? "Collapse Microsoft" : "Expand Microsoft"}
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              )}
              <MicrosoftCalendarIcon className="w-4 h-4 shrink-0" />
              <span className="text-[13px] font-bold text-foreground/90 tracking-tight truncate ms-1">
                Microsoft Calendars
              </span>
            </button>
          </div>

          {expanded && (
            <div className="mx-2 w-[calc(100%-16px)] py-1.5">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-8 flex items-center justify-center gap-2 border-border/60 bg-background !text-[#1f1f1f] dark:!text-[#e3e3e3] hover:bg-accent hover:!text-black dark:hover:!text-white font-medium shadow-sm"
                onClick={connectMicrosoft}
              >
                <MicrosoftIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium !text-[#1f1f1f] dark:!text-[#e3e3e3]">Sign in with Microsoft</span>
              </Button>
              {!status.configured && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/80 leading-tight px-1">
                  OAuth credentials needed in <code className="text-[10px] bg-muted px-1 py-0.5 rounded">.env.local</code>
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {accountGroups.map((group) => {
            const isGroupCollapsed = collapsedAccounts[group.email] === true;
            return (
              <div key={group.email}>
                <div className="group flex items-center py-1.5 px-2.5 mx-2 w-[calc(100%-16px)] select-none rounded-lg border shadow-xs transition-colors bg-accent/40 hover:bg-accent/60 border-accent/40 text-foreground dark:bg-accent/25 dark:hover:bg-accent/40 dark:border-accent/35 mb-1">
                  <button
                    type="button"
                    onClick={() => toggleAccountCollapsed(group.email)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-start bg-transparent hover:bg-transparent focus:outline-none"
                    title={group.email}
                  >
                    {isGroupCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="w-5 h-5 rounded-md flex items-center justify-center bg-background/60 flex-shrink-0 shadow-2xs border border-border/40">
                      <MicrosoftCalendarIcon className="w-3.5 h-3.5 shrink-0" />
                    </span>
                    <span className="truncate text-xs font-semibold text-foreground tracking-tight ms-1" title={group.email}>
                      {group.email}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    className="ms-1 p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Refresh Microsoft Calendars & Events"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void disconnectMicrosoft(group.email)}
                    className="p-1 rounded text-muted-foreground/70 hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                    title={`Disconnect ${group.email}`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!isGroupCollapsed && (
                  <div className="space-y-0.5">
                    {group.calendars.length === 0 ? (
                      <div className="mx-2 w-[calc(100%-16px)] ps-3.5 pe-3 py-1.5 text-xs text-muted-foreground italic">
                        {isLoading ? 'Loading calendars...' : 'No calendars found'}
                      </div>
                    ) : (
                      group.calendars.map((cal) => {
                        const isSelected = selectedCalendarIds.includes(cal.id);
                        const color = cal.color || '#0078D4';

                        return (
                          <div
                            key={cal.id}
                            className="mx-2 w-[calc(100%-16px)] rounded-md flex items-center gap-2 ps-3.5 pe-3 text-sm text-foreground/80 hover:bg-muted/50 cursor-pointer group transition-colors duration-150"
                            style={{ paddingBlock: 'var(--density-sidebar-py, 4px)', minHeight: '32px' }}
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
                                "w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center transition-colors shrink-0",
                                isSelected ? "border-transparent text-white" : "border-muted-foreground/40 bg-transparent"
                              )}
                              style={{ backgroundColor: isSelected ? color : undefined, borderColor: isSelected ? color : undefined }}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" stroke={3.5} />}
                            </div>
                            <span className={cn("truncate flex-1", !isSelected && "text-muted-foreground")}>{cal.name}</span>
                            {(cal.originalId === '#birthdays' || cal.name.toLowerCase() === 'birthdays') && (
                              <Cake className="w-3 h-3 text-muted-foreground shrink-0" />
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

          <div className="mx-2 w-[calc(100%-16px)] pt-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs h-7 flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-border/60 hover:border-border"
              onClick={connectMicrosoft}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add another Microsoft Account</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
