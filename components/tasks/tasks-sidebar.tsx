"use client";

import { useState, useMemo } from 'react';
import {
  ListTodo,
  Star,
  Calendar as CalendarIcon,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  CheckSquare,
  GoogleTasksIcon,
  ChevronDown,
  ChevronRight,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasksAppStore, type TaskViewFilter, type TaskList } from '@/stores/tasks-app-store';
import { useAccountStore } from '@/stores/account-store';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AppSidebarHeader } from '@/components/layout/app-layout';

interface TasksSidebarProps {
  className?: string;
  onCloseMobile?: () => void;
}

export function TasksSidebar({ className, onCloseMobile }: TasksSidebarProps) {
  const lists = useTasksAppStore((s) => s.lists);
  const activeListId = useTasksAppStore((s) => s.activeListId);
  const tasks = useTasksAppStore((s) => s.tasks);
  const filter = useTasksAppStore((s) => s.filter);
  const isGoogleConnected = useTasksAppStore((s) => s.isGoogleConnected);
  const connectedGoogleAccounts = useTasksAppStore((s) => s.connectedGoogleAccounts);
  const isSyncing = useTasksAppStore((s) => s.isSyncing);
  const googleEmail = useTasksAppStore((s) => s.googleEmail);

  const setActiveListId = useTasksAppStore((s) => s.setActiveListId);
  const setFilter = useTasksAppStore((s) => s.setFilter);
  const createList = useTasksAppStore((s) => s.createList);
  const updateList = useTasksAppStore((s) => s.updateList);
  const deleteList = useTasksAppStore((s) => s.deleteList);
  const syncGoogle = useTasksAppStore((s) => s.syncGoogle);

  const activeAccount = useAccountStore((s) => s.getActiveAccount());
  const accountLabel = activeAccount?.displayName || activeAccount?.label || activeAccount?.username;
  const subtitle = accountLabel
    ? isGoogleConnected
      ? `${accountLabel} • Google Synced`
      : accountLabel
    : isGoogleConnected
    ? 'Synced with Google'
    : 'Comail Tasks';

  const [creatingListTarget, setCreatingListTarget] = useState<{
    source: 'comail' | 'google';
    accountEmail?: string;
  } | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [menuListId, setMenuListId] = useState<string | null>(null);
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});

  const { dialogProps, confirm } = useConfirmDialog();

  const handleSelectFilter = (f: TaskViewFilter) => {
    setFilter(f);
    onCloseMobile?.();
  };

  const handleSelectList = (id: string) => {
    setActiveListId(id);
    setFilter('all');
    onCloseMobile?.();
  };

  const toggleAccountCollapse = (email: string) => {
    setCollapsedAccounts((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      await createList(
        newListTitle.trim(),
        creatingListTarget?.source || 'comail',
        creatingListTarget?.accountEmail
      );
      setNewListTitle('');
      setCreatingListTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameList = async (listId: string, currentTitle: string) => {
    setMenuListId(null);
    const newName = window.prompt('Rename list', currentTitle);
    if (newName && newName.trim() && newName.trim() !== currentTitle) {
      void updateList(listId, newName.trim());
    }
  };

  const handleDeleteList = async (listId: string, title: string) => {
    setMenuListId(null);
    const confirmed = await confirm({
      title: 'Delete list',
      message: `Are you sure you want to delete the list "${title}" and all its tasks?`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (confirmed) {
      void deleteList(listId);
    }
  };

  const starredCount = tasks.filter((t) => t.starred && t.status !== 'completed').length;
  const todayCount = tasks.filter((t) => {
    if (!t.due || t.status === 'completed') return false;
    try {
      const d = new Date(t.due);
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    } catch {
      return false;
    }
  }).length;

  const comailLists = lists.filter((l) => l.source !== 'google');
  const googleLists = lists.filter((l) => l.source === 'google');

  const googleAccountGroups = useMemo(() => {
    const map = new Map<string, { email: string; name?: string; lists: TaskList[] }>();

    for (const acc of connectedGoogleAccounts) {
      if (acc.email && !map.has(acc.email)) {
        map.set(acc.email, { email: acc.email, name: acc.name, lists: [] });
      }
    }

    for (const list of googleLists) {
      const email = list.accountEmail || googleEmail || 'Google Account';
      if (!map.has(email)) {
        map.set(email, { email, lists: [] });
      }
      map.get(email)!.lists.push(list);
    }

    return Array.from(map.values());
  }, [connectedGoogleAccounts, googleLists, googleEmail]);

  const renderListItem = (l: TaskList) => {
    const count = tasks.filter((t) => t.listId === l.id && t.status !== 'completed').length;
    const isActive = activeListId === l.id && filter !== 'starred' && filter !== 'today';

    return (
      <div key={l.id} className="relative group/list">
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleSelectList(l.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectList(l.id);
            }
          }}
          className={cn(
            'flex items-center justify-between mx-2 w-[calc(100%-16px)] px-2.5 py-1.5 rounded-md text-xs font-medium text-start transition-colors duration-150 cursor-pointer',
            isActive
              ? 'bg-[#1a5466] text-white font-semibold hover:bg-[#20657a] dark:bg-[#2a2d33] dark:hover:bg-[#353940]'
              : 'text-foreground/80 hover:bg-muted'
          )}
        >
          <span className="truncate flex-1 pe-2">{l.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            {count > 0 && (
              <span className={cn("text-[11px] tabular-nums font-normal", isActive ? "text-white/90 font-medium" : "text-muted-foreground")}>
                {count}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuListId(menuListId === l.id ? null : l.id);
              }}
              className="opacity-0 group-hover/list:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List Context Menu */}
        {menuListId === l.id && (
          <div className="absolute right-0 top-full mt-0.5 w-32 bg-popover text-popover-foreground border border-border rounded-md shadow-lg py-1 z-30 text-xs">
            <button
              type="button"
              onClick={() => handleRenameList(l.id, l.title)}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-muted text-foreground hover:text-foreground text-start"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
              <span>Rename</span>
            </button>
            {(l.source === 'google' || comailLists.length > 1) && (
              <button
                type="button"
                onClick={() => handleDeleteList(l.id, l.title)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-destructive/10 text-destructive text-start"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'w-[272px] flex flex-col h-full bg-secondary border-e border-border text-foreground select-none shrink-0',
        className
      )}
    >
      {/* Header */}
      <AppSidebarHeader
        icon={CheckSquare}
        title="Tasks"
      />

      {/* Navigation & Lists */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* Quick Views */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => handleSelectFilter('all')}
            className={cn(
              'flex items-center justify-between mx-2 w-[calc(100%-16px)] px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              filter === 'all' && activeListId
                ? 'bg-[#1a5466] text-white font-semibold hover:bg-[#20657a] dark:bg-[#2a2d33] dark:hover:bg-[#353940]'
                : 'text-foreground/80 hover:bg-muted'
            )}
          >
            <div className="flex items-center gap-2.5">
              <ListTodo className="w-4 h-4" />
              <span>All Tasks</span>
            </div>
            <span className={cn("text-[11px] tabular-nums font-normal", filter === 'all' && activeListId ? "text-white/90 font-medium" : "text-muted-foreground")}>
              {tasks.filter((t) => t.status !== 'completed').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectFilter('starred')}
            className={cn(
              'flex items-center justify-between mx-2 w-[calc(100%-16px)] px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              filter === 'starred'
                ? 'bg-[#1a5466] text-white font-semibold hover:bg-[#20657a] dark:bg-[#2a2d33] dark:hover:bg-[#353940]'
                : 'text-foreground/80 hover:bg-muted'
            )}
          >
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span>Starred</span>
            </div>
            {starredCount > 0 && (
              <span className={cn("text-[11px] tabular-nums font-normal", filter === 'starred' ? "text-white/90 font-medium" : "text-muted-foreground")}>
                {starredCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectFilter('today')}
            className={cn(
              'flex items-center justify-between mx-2 w-[calc(100%-16px)] px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              filter === 'today'
                ? 'bg-[#1a5466] text-white font-semibold hover:bg-[#20657a] dark:bg-[#2a2d33] dark:hover:bg-[#353940]'
                : 'text-foreground/80 hover:bg-muted'
            )}
          >
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <span>Due Today</span>
            </div>
            {todayCount > 0 && (
              <span className={cn("text-[11px] tabular-nums", filter === 'today' ? "text-white/90 font-medium" : "text-primary font-semibold")}>
                {todayCount}
              </span>
            )}
          </button>
        </div>

        {/* Task Lists Section */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>{isGoogleConnected ? 'Comail Lists' : 'Lists'}</span>
            <button
              type="button"
              onClick={() => setCreatingListTarget({ source: 'comail' })}
              className="p-0.5 rounded hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              title="New Comail list"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New list form for Comail */}
          {creatingListTarget?.source === 'comail' && (
            <form onSubmit={handleCreateList} className="px-2 py-1 space-y-1">
              <input
                type="text"
                autoFocus
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="List name"
                className="w-full text-xs px-2 py-1 bg-background text-foreground border border-sidebar-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreatingListTarget(null)}
                  className="h-6 text-[11px] px-2"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-6 text-[11px] px-2">
                  Create
                </Button>
              </div>
            </form>
          )}

          {/* Native Comail Lists */}
          <div className="space-y-0.5">
            {comailLists.map(renderListItem)}
          </div>
        </div>

        {/* Google Lists separated by Account */}
        {isGoogleConnected && googleAccountGroups.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-sidebar-border/40">
            {googleAccountGroups.map((group) => {
              const isCollapsed = !!collapsedAccounts[group.email];
              const isAddingToThisGroup =
                creatingListTarget?.source === 'google' &&
                creatingListTarget?.accountEmail === group.email;

              return (
                <div key={group.email} className="space-y-1">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group/acc">
                    <button
                      type="button"
                      onClick={() => toggleAccountCollapse(group.email)}
                      className="flex items-center gap-1.5 min-w-0 text-start hover:text-sidebar-foreground transition-colors flex-1"
                      title={group.email}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <GoogleTasksIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate lowercase font-medium text-[11px] text-foreground">
                        {group.email}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingListTarget({ source: 'google', accountEmail: group.email });
                        if (isCollapsed) toggleAccountCollapse(group.email);
                      }}
                      className="p-0.5 rounded hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors shrink-0"
                      title={`New list in ${group.email}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-0.5 ps-1">
                      {isAddingToThisGroup && (
                        <form onSubmit={handleCreateList} className="px-2 py-1 space-y-1">
                          <input
                            type="text"
                            autoFocus
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                            placeholder={`New list in ${group.email}`}
                            className="w-full text-xs px-2 py-1 bg-background text-foreground border border-sidebar-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCreatingListTarget(null)}
                              className="h-6 text-[11px] px-2"
                            >
                              Cancel
                            </Button>
                            <Button type="submit" size="sm" className="h-6 text-[11px] px-2">
                              Create
                            </Button>
                          </div>
                        </form>
                      )}

                      {group.lists.length === 0 && !isAddingToThisGroup ? (
                        <div className="px-2.5 py-1 text-[11px] text-muted-foreground italic">
                          No lists found
                        </div>
                      ) : (
                        group.lists.map(renderListItem)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Google Account Status & Sync (only shown if Google is connected) */}
      {isGoogleConnected && (
        <div className="p-3 border-t border-sidebar-border/60 shrink-0 bg-sidebar/50">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate flex items-center gap-1.5">
                <GoogleTasksIcon className="w-3.5 h-3.5 shrink-0" />
                Google Tasks
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {connectedGoogleAccounts.length > 1
                  ? `${connectedGoogleAccounts.length} accounts connected`
                  : googleEmail || 'Connected'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void syncGoogle()}
              disabled={isSyncing}
              className="p-1.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
              title="Sync now"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </aside>
  );
}
