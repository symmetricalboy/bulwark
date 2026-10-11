"use client";

import { useState } from 'react';
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
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasksAppStore, type TaskViewFilter, type TaskList } from '@/stores/tasks-app-store';
import { useAccountStore } from '@/stores/account-store';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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

  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [menuListId, setMenuListId] = useState<string | null>(null);

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

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      await createList(newListTitle.trim());
      setNewListTitle('');
      setIsCreatingList(false);
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
            'flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium text-start transition-colors cursor-pointer',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
              : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
          )}
        >
          <span className="truncate flex-1 pe-2">{l.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            {count > 0 && (
              <span className="text-[11px] text-muted-foreground font-normal">
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
        'w-64 flex flex-col h-full bg-sidebar border-e border-sidebar-border text-sidebar-foreground select-none shrink-0',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-sidebar-border/60">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CheckSquare className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-sidebar-foreground truncate tracking-tight">
            Tasks
          </h1>
          <p className="text-[11px] text-muted-foreground truncate" title={subtitle}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* Navigation & Lists */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* Quick Views */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => handleSelectFilter('all')}
            className={cn(
              'flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              filter === 'all' && activeListId
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <div className="flex items-center gap-2.5">
              <ListTodo className="w-4 h-4 text-muted-foreground" />
              <span>All Tasks</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-normal">
              {tasks.filter((t) => t.status !== 'completed').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectFilter('starred')}
            className={cn(
              'flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              filter === 'starred'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span>Starred</span>
            </div>
            {starredCount > 0 && (
              <span className="text-[11px] text-muted-foreground font-normal">
                {starredCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectFilter('today')}
            className={cn(
              'flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              filter === 'today'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <span>Due Today</span>
            </div>
            {todayCount > 0 && (
              <span className="text-[11px] text-primary font-semibold">
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
              onClick={() => setIsCreatingList(true)}
              className="p-0.5 rounded hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              title="New list"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New list form */}
          {isCreatingList && (
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
                  onClick={() => setIsCreatingList(false)}
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

        {/* Optional Google Lists (if connected) */}
        {isGoogleConnected && googleLists.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-sidebar-border/40">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Google Tasks</span>
            </div>
            <div className="space-y-0.5">
              {googleLists.map(renderListItem)}
            </div>
          </div>
        )}
      </div>

      {/* Google Account Status & Sync (only shown if Google is connected) */}
      {isGoogleConnected && (
        <div className="p-3 border-t border-sidebar-border/60 shrink-0 bg-sidebar/50">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate flex items-center gap-1.5">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Google Tasks
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{googleEmail}</p>
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
