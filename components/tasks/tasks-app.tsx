"use client";

import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowDownAZ,
  MoreVertical,
  CheckCircle2,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasksAppStore, type TaskSortBy } from '@/stores/tasks-app-store';
import { TasksSidebar } from './tasks-sidebar';
import { TaskItemRow } from './task-item-row';
import { TaskDetailPanel } from './task-detail-panel';
import { NavigationRail } from '@/components/layout/navigation-rail';
import { AppNavRail } from '@/components/layout/app-layout';
import { SidebarAppsModal } from '@/components/layout/sidebar-apps-modal';
import { InlineAppView } from '@/components/layout/inline-app-view';
import { AppTopBannerSlot } from '@/components/plugins/app-top-banner-slot';
import { useSidebarApps } from '@/hooks/use-sidebar-apps';
import { useIsEmbedded } from '@/hooks/use-is-embedded';
import { useIsMobile } from '@/hooks/use-media-query';
import { useAuthStore, redirectToLogin, saveRedirectAfterLogin } from '@/stores/auth-store';
import { useAccountStore } from '@/stores/account-store';
import { useEmailStore } from '@/stores/email-store';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useTranslations } from 'next-intl';

interface TasksAppProps {
  linkSegments?: string[];
}

export function TasksApp({ linkSegments = [] }: TasksAppProps) {
  const lists = useTasksAppStore((s) => s.lists);
  const activeListId = useTasksAppStore((s) => s.activeListId);
  const tasks = useTasksAppStore((s) => s.tasks);
  const selectedTaskId = useTasksAppStore((s) => s.selectedTaskId);
  const filter = useTasksAppStore((s) => s.filter);
  const sortBy = useTasksAppStore((s) => s.sortBy);

  const initialize = useTasksAppStore((s) => s.initialize);
  const setActiveListId = useTasksAppStore((s) => s.setActiveListId);
  const setSelectedTaskId = useTasksAppStore((s) => s.setSelectedTaskId);
  const setSortBy = useTasksAppStore((s) => s.setSortBy);
  const createTask = useTasksAppStore((s) => s.createTask);
  const clearCompleted = useTasksAppStore((s) => s.clearCompleted);

  const isMobile = useIsMobile();
  const isEmbedded = useIsEmbedded();
  const { showAppsModal, inlineApp, loadedApps, handleManageApps, handleInlineApp, closeInlineApp, closeAppsModal } = useSidebarApps();
  const { isAuthenticated, logout, checkAuth, isLoading: authLoading } = useAuthStore();
  const [initialCheckDone, setInitialCheckDone] = useState(() => useAuthStore.getState().isAuthenticated && !!useAuthStore.getState().client);
  const { quota, isPushConnected } = useEmailStore();
  const tSidebar = useTranslations('sidebar');
  useDocumentTitle(tSidebar('tasks'));

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Quick add task states
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDue, setNewTaskDue] = useState<string | undefined>();
  const [expandedSubtaskMap, setExpandedSubtaskMap] = useState<Record<string, boolean>>({});
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const authActiveAccountId = useAuthStore((s) => s.activeAccountId);
  const accountActiveAccountId = useAccountStore((s) => s.activeAccountId);
  const activeAccountId = authActiveAccountId || accountActiveAccountId;

  // Check auth on mount – skip when already authenticated so that navigating
  // between routes doesn't retrigger checkAuth's transient `{ client: null,
  // isLoading: true }` reset.
  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated && state.client) {
      setInitialCheckDone(true);
      return;
    }
    checkAuth().finally(() => {
      setInitialCheckDone(true);
    });
  }, [checkAuth]);

  useEffect(() => {
    if (initialCheckDone && !authLoading && !isAuthenticated) {
      saveRedirectAfterLogin();
      redirectToLogin();
    }
  }, [initialCheckDone, authLoading, isAuthenticated]);

  useEffect(() => {
    void initialize(activeAccountId || undefined);
  }, [initialize, activeAccountId]);

  // Handle deep-link segments
  useEffect(() => {
    if (linkSegments.length > 0) {
      const [first, second] = linkSegments;
      if (first && lists.some((l) => l.id === first)) {
        setActiveListId(first);
      }
      if (second) {
        setSelectedTaskId(second);
      }
    }
  }, [linkSegments, lists, setActiveListId, setSelectedTaskId]);

  const activeList = useMemo(() => {
    return lists.find((l) => l.id === activeListId) || lists[0];
  }, [lists, activeListId]);

  // Filter tasks based on current view/search
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by list unless in special global view
    if (filter === 'starred') {
      result = result.filter((t) => t.starred);
    } else if (filter === 'today') {
      const now = new Date();
      result = result.filter((t) => {
        if (!t.due) return false;
        try {
          const d = new Date(t.due);
          return (
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          );
        } catch {
          return false;
        }
      });
    } else {
      result = result.filter((t) => t.listId === activeListId);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'date') {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      }
      if (sortBy === 'starred') {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
      }
      // Default: order by creation / position
      return (b.updated || '').localeCompare(a.updated || '');
    });
  }, [tasks, activeListId, filter, searchQuery, sortBy]);

  // Separate into top-level incomplete, subtasks, and completed
  const { topLevelIncomplete, completedTasks, subtasksByParent } = useMemo(() => {
    const topLevel: typeof filteredTasks = [];
    const completed: typeof filteredTasks = [];
    const subtasks: Record<string, typeof filteredTasks> = {};

    filteredTasks.forEach((t) => {
      if (t.parent) {
        if (!subtasks[t.parent]) subtasks[t.parent] = [];
        subtasks[t.parent].push(t);
      } else if (t.status === 'completed') {
        completed.push(t);
      } else {
        topLevel.push(t);
      }
    });

    return {
      topLevelIncomplete: topLevel,
      completedTasks: completed,
      subtasksByParent: subtasks,
    };
  }, [filteredTasks]);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await createTask({
      title: newTaskTitle.trim(),
      notes: newTaskNotes.trim() || undefined,
      due: newTaskDue,
      listId: activeList?.id,
    });

    setNewTaskTitle('');
    setNewTaskNotes('');
    setNewTaskDue(undefined);
    setIsAddingTask(false);
  };

  const toggleSubtaskExpand = (taskId: string) => {
    setExpandedSubtaskMap((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const viewTitle =
    filter === 'starred'
      ? 'Starred'
      : filter === 'today'
      ? 'Due Today'
      : activeList?.title || 'My Tasks';

  return (
    <div className={cn("flex flex-col bg-background overflow-hidden pt-[env(safe-area-inset-top)]", isEmbedded ? "h-full" : "h-dvh")}>
      <AppTopBannerSlot />
      <div className={cn("flex flex-1 min-h-0 overflow-hidden", isMobile && "flex-col")}>
        {/* Navigation Rail - desktop only (hidden when embedded in Pro shell) */}
        {!isMobile && !isEmbedded && (
          <AppNavRail
            quota={quota}
            isPushConnected={isPushConnected}
            onLogout={logout}
            onManageApps={handleManageApps}
            onInlineApp={handleInlineApp}
            onCloseInlineApp={closeInlineApp}
            activeAppId={inlineApp?.id ?? null}
          />
        )}

        {inlineApp && (
          <InlineAppView apps={loadedApps} activeAppId={inlineApp!.id} onClose={closeInlineApp} className="flex-1" />
        )}

        {!inlineApp && (
          <div className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden">
            {/* Mobile Sidebar Backdrop */}
            {mobileSidebarOpen && (
              <div
                onClick={() => setMobileSidebarOpen(false)}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
              />
            )}

            {/* Sidebar (Desktop permanent, Mobile drawer) */}
            <div
              className={cn(
                'fixed inset-y-0 start-0 z-50 md:static md:z-0 transition-transform duration-200 ease-in-out',
                mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
              )}
            >
              <TasksSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
            </div>

      {/* Main Task List Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
        {/* Main Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground md:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
              {viewTitle}
            </h2>
            <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-medium shrink-0">
              {topLevelIncomplete.length}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative hidden sm:block w-48 lg:w-64">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full text-xs ps-8 pe-3 py-1.5 bg-muted/40 hover:bg-muted/70 focus:bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortMenu((v) => !v)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Sort tasks"
              >
                <ArrowDownAZ className="w-4 h-4" />
              </button>

              {showSortMenu && (
                <div className="absolute end-0 top-full mt-1 w-36 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-1 z-30 text-xs">
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                    Sort by
                  </div>
                  {(['myOrder', 'date', 'title', 'starred'] as TaskSortBy[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSortBy(s);
                        setShowSortMenu(false);
                      }}
                      className={cn(
                        'w-full text-start px-2 py-1.5 rounded text-xs transition-colors',
                        sortBy === s
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      {s === 'myOrder'
                        ? 'My order'
                        : s === 'date'
                        ? 'Due date'
                        : s === 'title'
                        ? 'Title'
                        : 'Starred first'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Options Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOptionsMenu((v) => !v)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showOptionsMenu && (
                <div className="absolute end-0 top-full mt-1 w-44 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-1 z-30 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      void clearCompleted(activeList?.id);
                      setShowOptionsMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-muted text-start rounded text-foreground"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Clear completed tasks</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Task List Content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 max-w-4xl w-full mx-auto space-y-4">
          {/* Quick Add Bar (Google Tasks style) */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all">
            {!isAddingTask ? (
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="flex items-center gap-3 w-full px-4 py-3 text-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/60 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3 text-primary" />
                </div>
                <span>Add a task</span>
              </button>
            ) : (
              <form onSubmit={handleQuickAddSubmit} className="p-3.5 space-y-2.5">
                <input
                  type="text"
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full text-sm font-medium bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-foreground placeholder:text-muted-foreground"
                />

                <textarea
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  placeholder="Details"
                  rows={2}
                  className="w-full text-xs bg-muted/30 border border-border/50 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newTaskDue ? newTaskDue.split('T')[0] : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setNewTaskDue(new Date(e.target.value).toISOString());
                        } else {
                          setNewTaskDue(undefined);
                        }
                      }}
                      className="text-xs bg-muted/40 text-foreground border border-border/50 rounded px-2 py-1 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingTask(false);
                        setNewTaskTitle('');
                        setNewTaskNotes('');
                        setNewTaskDue(undefined);
                      }}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!newTaskTitle.trim()}
                      className="h-7 text-xs px-3"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Incomplete Tasks */}
          {topLevelIncomplete.length > 0 ? (
            <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border/40 overflow-hidden">
              {topLevelIncomplete.map((task) => (
                <TaskItemRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onSelect={() => setSelectedTaskId(task.id)}
                  subtasks={subtasksByParent[task.id] || []}
                  isSubtaskExpanded={expandedSubtaskMap[task.id]}
                  onToggleSubtaskExpand={() => toggleSubtaskExpand(task.id)}
                  onAddSubtask={() => setSelectedTaskId(task.id)}
                />
              ))}
            </div>
          ) : (
            !isAddingTask && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                  <CheckCircle2 className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">All done!</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {filter === 'starred'
                    ? 'No starred tasks. Click the star on any task to prioritize it.'
                    : filter === 'today'
                    ? 'No tasks due today. Enjoy your day or add a new task above.'
                    : 'Nice job! You have completed all tasks in this list.'}
                </p>
              </div>
            )
          )}

          {/* Completed Tasks Collapsible Section */}
          {completedTasks.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <button
                type="button"
                onClick={() => setCompletedExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground py-1 px-1 transition-colors"
              >
                {completedExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>Completed ({completedTasks.length})</span>
              </button>

              {completedExpanded && (
                <div className="bg-card border border-border rounded-xl shadow-sm divide-y divide-border/40 overflow-hidden">
                  {completedTasks.map((task) => (
                    <TaskItemRow
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onSelect={() => setSelectedTaskId(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Slide-in Panel */}
      {selectedTaskId && (
        <div className="fixed inset-0 z-40 sm:static sm:inset-auto sm:z-auto sm:flex-shrink-0 h-full">
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
          />
        </div>
      )}
          </div>
        )}

        {/* Mobile Bottom Navigation */}
        {isMobile && !isEmbedded && (
          <div className="shrink-0">
            <NavigationRail
              orientation="horizontal"
              onManageApps={handleManageApps}
              onInlineApp={handleInlineApp}
              onCloseInlineApp={closeInlineApp}
              activeAppId={inlineApp?.id ?? null}
            />
          </div>
        )}
      </div>

      <SidebarAppsModal isOpen={showAppsModal} onClose={closeAppsModal} />
    </div>
  );
}
