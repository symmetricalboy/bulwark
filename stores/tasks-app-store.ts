import { create } from 'zustand';
import {
  fetchGoogleTaskLists,
  createGoogleTaskList,
  updateGoogleTaskList,
  deleteGoogleTaskList,
  fetchAllGoogleTasks,
  createGoogleTask,
  updateGoogleTask,
  deleteGoogleTask,
  clearCompletedGoogleTasks,
  getGoogleStatus,
} from '@/lib/google/google-tasks-client';
import {
  googleTaskToCalendarTask,
  nativeTaskToCalendarTask,
  GOOGLE_TASKS_CALENDAR_ID,
  COMAIL_TASKS_CALENDAR_ID,
} from '@/lib/google/tasks-mapper';
import { useTaskStore } from '@/stores/task-store';
import { useAccountStore } from '@/stores/account-store';
import type { CalendarTask } from '@/lib/jmap/types';

export interface TaskList {
  id: string;
  title: string;
  updated?: string;
  isDefault?: boolean;
  source?: 'comail' | 'google';
  comailAccountId?: string;
}

export interface TaskItem {
  id: string;
  listId: string;
  title: string;
  notes?: string;
  due?: string; // ISO 8601 string
  status: 'needsAction' | 'completed';
  completed?: string;
  parent?: string;
  position?: string;
  starred?: boolean;
  updated?: string;
  isLocal?: boolean;
  source?: 'comail' | 'google';
  comailAccountId?: string;
}

export type TaskViewFilter = 'all' | 'starred' | 'today' | 'pending' | 'completed';
export type TaskSortBy = 'myOrder' | 'date' | 'title' | 'starred';

interface TasksAppState {
  lists: TaskList[];
  activeListId: string;
  tasks: TaskItem[];
  selectedTaskId: string | null;
  searchQuery: string;
  filter: TaskViewFilter;
  sortBy: TaskSortBy;
  isGoogleConnected: boolean;
  isSyncing: boolean;
  googleEmail?: string;
  googleName?: string;
  googlePicture?: string;
  isInitialized: boolean;
  error: string | null;
  currentAccountId: string | null;

  // Actions
  initialize: (forceAccountId?: string) => Promise<void>;
  setActiveListId: (id: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  setFilter: (filter: TaskViewFilter) => void;
  setSortBy: (sort: TaskSortBy) => void;
  setSearchQuery: (query: string) => void;

  createList: (title: string, source?: 'comail' | 'google') => Promise<TaskList>;
  updateList: (listId: string, title: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;

  createTask: (data: {
    title: string;
    listId?: string;
    notes?: string;
    due?: string;
    parent?: string;
  }) => Promise<TaskItem>;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  toggleTaskComplete: (taskId: string) => Promise<void>;
  toggleTaskStar: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  clearCompleted: (listId?: string) => Promise<void>;
  syncGoogle: () => Promise<void>;
}

const LEGACY_STORAGE_LISTS_KEY = 'bulwark_tasks_lists';
const LEGACY_STORAGE_TASKS_KEY = 'bulwark_tasks_items';

function getListsKey(accountId: string): string {
  return `comail_tasks_lists_${accountId}`;
}

function getTasksKey(accountId: string): string {
  return `comail_tasks_items_${accountId}`;
}

function getDefaultList(accountId: string): TaskList {
  return {
    id: `comail-list-${accountId}`,
    title: 'My Tasks',
    isDefault: true,
    source: 'comail',
    comailAccountId: accountId,
  };
}

function getLocalStoredLists(accountId: string): TaskList[] {
  if (typeof window === 'undefined') return [getDefaultList(accountId)];
  try {
    const key = getListsKey(accountId);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_LISTS_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        try {
          localStorage.setItem(key, legacyRaw);
        } catch {
          // Ignore localStorage write error
        }
      }
    }
    if (!raw) return [getDefaultList(accountId)];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [getDefaultList(accountId)];
    return parsed.map((l: TaskList, index: number) => ({
      ...l,
      source: 'comail' as const,
      comailAccountId: accountId,
      isDefault: l.isDefault ?? index === 0,
    }));
  } catch {
    return [getDefaultList(accountId)];
  }
}

function getLocalStoredTasks(accountId: string): TaskItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getTasksKey(accountId);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_TASKS_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        try {
          localStorage.setItem(key, legacyRaw);
        } catch {
          // Ignore localStorage write error
        }
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t: TaskItem) => ({
      ...t,
      source: 'comail' as const,
      comailAccountId: accountId,
    }));
  } catch {
    return [];
  }
}

function saveLocalData(accountId: string, lists: TaskList[], tasks: TaskItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const comailLists = lists.filter((l) => l.source !== 'google');
    const comailTasks = tasks.filter((t) => t.source !== 'google');
    localStorage.setItem(getListsKey(accountId), JSON.stringify(comailLists));
    localStorage.setItem(getTasksKey(accountId), JSON.stringify(comailTasks));
  } catch (err) {
    console.error('Failed to save tasks to localStorage:', err);
  }
}

function syncTasksToCalendarStore(tasks: TaskItem[]) {
  try {
    const calendarTasks: CalendarTask[] = tasks
      .filter((t) => Boolean(t.due))
      .map((t) => {
        if (t.source === 'google') {
          return googleTaskToCalendarTask(
            {
              id: t.id,
              title: t.title,
              notes: t.notes,
              due: t.due,
              status: t.status,
              completed: t.completed,
              parent: t.parent,
              updated: t.updated,
            },
            t.listId
          );
        }
        return nativeTaskToCalendarTask(t, t.listId);
      });

    useTaskStore.setState((state) => {
      // Retain existing non-task-app tasks (e.g. from JMAP), replace or merge our tasks
      const nonAppTasks = state.tasks.filter(
        (task) =>
          !task.calendarIds?.[GOOGLE_TASKS_CALENDAR_ID] &&
          !task.calendarIds?.[COMAIL_TASKS_CALENDAR_ID]
      );
      return {
        tasks: [...nonAppTasks, ...calendarTasks],
      };
    });
  } catch (err) {
    console.error('Error syncing tasks to calendar store:', err);
  }
}

const INITIAL_DEFAULT_LIST = getDefaultList('default');

export const useTasksAppStore = create<TasksAppState>((set, get) => ({
  lists: [INITIAL_DEFAULT_LIST],
  activeListId: INITIAL_DEFAULT_LIST.id,
  tasks: [],
  selectedTaskId: null,
  searchQuery: '',
  filter: 'all',
  sortBy: 'myOrder',
  isGoogleConnected: false,
  isSyncing: false,
  isInitialized: false,
  error: null,
  currentAccountId: null,

  initialize: async (forceAccountId?: string) => {
    const activeAccount = useAccountStore.getState().getActiveAccount();
    const accountId = forceAccountId || activeAccount?.id || 'default';

    if (get().isInitialized && get().currentAccountId === accountId) return;
    set({ isSyncing: true, error: null, currentAccountId: accountId });

    // Step 1: Always load native Comail lists & tasks first - fully offline & account-scoped
    const nativeLists = getLocalStoredLists(accountId);
    const nativeTasks = getLocalStoredTasks(accountId);
    const initialActiveListId = nativeLists[0]?.id || getDefaultList(accountId).id;

    set({
      lists: nativeLists,
      activeListId: initialActiveListId,
      tasks: nativeTasks,
      isInitialized: true,
      isSyncing: false,
    });

    syncTasksToCalendarStore(nativeTasks);

    // Step 2: In background, check if optional Google account is connected
    try {
      const status = await getGoogleStatus();
      if (status.connected) {
        set({
          isGoogleConnected: true,
          googleEmail: status.email,
          googleName: status.name,
          googlePicture: status.picture,
        });

        const [gLists, gAllTasks] = await Promise.all([
          fetchGoogleTaskLists().catch(() => []),
          fetchAllGoogleTasks().catch(() => []),
        ]);

        const googleLists: TaskList[] = gLists.map((l) => ({
          id: l.id,
          title: l.title,
          updated: l.updated,
          isDefault: false,
          source: 'google',
        }));

        const googleTasks: TaskItem[] = [];
        gAllTasks.forEach((group) => {
          (group.tasks || []).forEach((t) => {
            googleTasks.push({
              id: t.id,
              listId: group.listId,
              title: t.title || '',
              notes: t.notes,
              due: t.due,
              status: t.status,
              completed: t.completed,
              parent: t.parent,
              position: t.position,
              updated: t.updated,
              starred: false,
              isLocal: false,
              source: 'google',
            });
          });
        });

        const currentNativeLists = get().lists.filter((l) => l.source !== 'google');
        const currentNativeTasks = get().tasks.filter((t) => t.source !== 'google');

        const combinedLists = [...currentNativeLists, ...googleLists];
        const combinedTasks = [...currentNativeTasks, ...googleTasks];

        const activeListId = combinedLists.some((l) => l.id === get().activeListId)
          ? get().activeListId
          : combinedLists[0]?.id || initialActiveListId;

        set({
          lists: combinedLists,
          activeListId,
          tasks: combinedTasks,
        });

        syncTasksToCalendarStore(combinedTasks);
      } else {
        set({ isGoogleConnected: false });
      }
    } catch {
      set({ isGoogleConnected: false });
    }
  },

  setActiveListId: (id: string) => set({ activeListId: id, selectedTaskId: null }),
  setSelectedTaskId: (id: string | null) => set({ selectedTaskId: id }),
  setFilter: (filter: TaskViewFilter) => set({ filter }),
  setSortBy: (sortBy: TaskSortBy) => set({ sortBy }),
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  createList: async (title: string, source: 'comail' | 'google' = 'comail') => {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('List title is required');
    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';

    if (source === 'google' && get().isGoogleConnected) {
      try {
        const created = await createGoogleTaskList(trimmed);
        const newList: TaskList = {
          id: created.id,
          title: created.title,
          updated: created.updated,
          source: 'google',
        };
        const nextLists = [...get().lists, newList];
        set({ lists: nextLists, activeListId: newList.id });
        return newList;
      } catch (err) {
        console.error('Failed to create Google task list:', err);
      }
    }

    // Native Comail list
    const newList: TaskList = {
      id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      updated: new Date().toISOString(),
      source: 'comail',
      comailAccountId: accountId,
    };
    const nextLists = [...get().lists, newList];
    set({ lists: nextLists, activeListId: newList.id });
    saveLocalData(accountId, nextLists, get().tasks);
    return newList;
  },

  updateList: async (listId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';
    const target = get().lists.find((l) => l.id === listId);

    if (target?.source === 'google' && get().isGoogleConnected) {
      try {
        await updateGoogleTaskList(listId, trimmed);
      } catch (err) {
        console.error('Failed to update Google task list:', err);
      }
    }

    const nextLists = get().lists.map((l) => (l.id === listId ? { ...l, title: trimmed } : l));
    set({ lists: nextLists });
    if (target?.source !== 'google') {
      saveLocalData(accountId, nextLists, get().tasks);
    }
  },

  deleteList: async (listId: string) => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list) return;

    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';
    const nativeLists = get().lists.filter((l) => l.source !== 'google');

    if (list.source !== 'google' && nativeLists.length <= 1) return; // Keep at least one native list

    if (list.source === 'google' && get().isGoogleConnected) {
      try {
        await deleteGoogleTaskList(listId);
      } catch (err) {
        console.error('Failed to delete Google task list:', err);
      }
    }

    const nextLists = get().lists.filter((l) => l.id !== listId);
    const nextTasks = get().tasks.filter((t) => t.listId !== listId);
    const activeListId = get().activeListId === listId ? nextLists[0]?.id : get().activeListId;

    set({
      lists: nextLists,
      activeListId,
      tasks: nextTasks,
      selectedTaskId: null,
    });

    if (list.source !== 'google') {
      saveLocalData(accountId, nextLists, nextTasks);
    }
    syncTasksToCalendarStore(nextTasks);
  },

  createTask: async (data) => {
    const title = data.title.trim();
    if (!title) throw new Error('Task title is required');

    const listId = data.listId || get().activeListId;
    const currentList = get().lists.find((l) => l.id === listId);
    const isGoogle = currentList?.source === 'google';
    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';

    if (isGoogle && get().isGoogleConnected) {
      try {
        const created = await createGoogleTask(
          listId,
          {
            title,
            notes: data.notes,
            due: data.due,
            parent: data.parent,
          },
          data.parent
        );

        const newTask: TaskItem = {
          id: created.id,
          listId,
          title: created.title || title,
          notes: created.notes,
          due: created.due,
          status: created.status || 'needsAction',
          completed: created.completed,
          parent: created.parent,
          position: created.position,
          updated: created.updated,
          starred: false,
          isLocal: false,
          source: 'google',
        };

        const nextTasks = [newTask, ...get().tasks];
        set({ tasks: nextTasks, selectedTaskId: newTask.id });
        syncTasksToCalendarStore(nextTasks);
        return newTask;
      } catch (err) {
        console.error('Failed to create Google task, saving as native Comail task:', err);
      }
    }

    // Native Comail task creation
    const newTask: TaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      listId,
      title,
      notes: data.notes,
      due: data.due,
      status: 'needsAction',
      parent: data.parent,
      updated: new Date().toISOString(),
      starred: false,
      isLocal: false,
      source: 'comail',
      comailAccountId: accountId,
    };

    const nextTasks = [newTask, ...get().tasks];
    set({ tasks: nextTasks, selectedTaskId: newTask.id });
    saveLocalData(accountId, get().lists, nextTasks);
    syncTasksToCalendarStore(nextTasks);
    return newTask;
  },

  updateTask: async (taskId: string, updates: Partial<TaskItem>) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';

    const updatedTask: TaskItem = {
      ...task,
      ...updates,
      updated: new Date().toISOString(),
    };

    const nextTasks = get().tasks.map((t) => (t.id === taskId ? updatedTask : t));
    set({ tasks: nextTasks });

    if (task.source === 'google' && get().isGoogleConnected) {
      const gUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) gUpdates.title = updates.title;
      if (updates.notes !== undefined) gUpdates.notes = updates.notes;
      if (updates.status !== undefined) gUpdates.status = updates.status;
      if (updates.due !== undefined) gUpdates.due = updates.due;

      try {
        await updateGoogleTask(task.listId, taskId, gUpdates);
      } catch (err) {
        console.error('Failed to update Google task:', err);
      }
    } else {
      saveLocalData(accountId, get().lists, nextTasks);
    }

    syncTasksToCalendarStore(nextTasks);
  },

  toggleTaskComplete: async (taskId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const completedTimestamp = newStatus === 'completed' ? new Date().toISOString() : undefined;

    await get().updateTask(taskId, {
      status: newStatus,
      completed: completedTimestamp,
    });
  },

  toggleTaskStar: async (taskId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    await get().updateTask(taskId, { starred: !task.starred });
  },

  deleteTask: async (taskId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';

    const nextTasks = get().tasks.filter((t) => t.id !== taskId && t.parent !== taskId);
    const selectedTaskId = get().selectedTaskId === taskId ? null : get().selectedTaskId;

    set({ tasks: nextTasks, selectedTaskId });

    if (task.source === 'google' && get().isGoogleConnected) {
      try {
        await deleteGoogleTask(task.listId, taskId);
      } catch (err) {
        console.error('Failed to delete Google task:', err);
      }
    } else {
      saveLocalData(accountId, get().lists, nextTasks);
    }

    syncTasksToCalendarStore(nextTasks);
  },

  clearCompleted: async (listId?: string) => {
    const targetListId = listId || get().activeListId;
    const targetList = get().lists.find((l) => l.id === targetListId);
    const accountId = get().currentAccountId || useAccountStore.getState().getActiveAccount()?.id || 'default';

    const nextTasks = get().tasks.filter((t) => !(t.listId === targetListId && t.status === 'completed'));
    set({ tasks: nextTasks });

    if (targetList?.source === 'google' && get().isGoogleConnected) {
      try {
        await clearCompletedGoogleTasks(targetListId);
      } catch (err) {
        console.error('Failed to clear completed Google tasks:', err);
      }
    } else {
      saveLocalData(accountId, get().lists, nextTasks);
    }

    syncTasksToCalendarStore(nextTasks);
  },

  syncGoogle: async () => {
    set({ isSyncing: true, error: null });
    try {
      const status = await getGoogleStatus();
      if (!status.connected) {
        const nativeLists = get().lists.filter((l) => l.source !== 'google');
        const nativeTasks = get().tasks.filter((t) => t.source !== 'google');
        set({
          isGoogleConnected: false,
          lists: nativeLists.length > 0 ? nativeLists : [getDefaultList(get().currentAccountId || 'default')],
          tasks: nativeTasks,
          isSyncing: false,
        });
        syncTasksToCalendarStore(nativeTasks);
        return;
      }

      set({
        isGoogleConnected: true,
        googleEmail: status.email,
        googleName: status.name,
        googlePicture: status.picture,
      });

      const [gLists, gAllTasks] = await Promise.all([
        fetchGoogleTaskLists(),
        fetchAllGoogleTasks(),
      ]);

      const googleLists: TaskList[] = gLists.map((l) => ({
        id: l.id,
        title: l.title,
        updated: l.updated,
        isDefault: false,
        source: 'google',
      }));

      const googleTasks: TaskItem[] = [];
      gAllTasks.forEach((group) => {
        (group.tasks || []).forEach((t) => {
          googleTasks.push({
            id: t.id,
            listId: group.listId,
            title: t.title || '',
            notes: t.notes,
            due: t.due,
            status: t.status,
            completed: t.completed,
            parent: t.parent,
            position: t.position,
            updated: t.updated,
            starred: false,
            isLocal: false,
            source: 'google',
          });
        });
      });

      const currentNativeLists = get().lists.filter((l) => l.source !== 'google');
      const currentNativeTasks = get().tasks.filter((t) => t.source !== 'google');

      const combinedLists = [...currentNativeLists, ...googleLists];
      const combinedTasks = [...currentNativeTasks, ...googleTasks];

      const activeListId = combinedLists.some((l) => l.id === get().activeListId)
        ? get().activeListId
        : combinedLists[0]?.id;

      set({
        lists: combinedLists,
        activeListId,
        tasks: combinedTasks,
        isSyncing: false,
      });

      syncTasksToCalendarStore(combinedTasks);
    } catch (err) {
      console.error('Error syncing Google tasks:', err);
      set({ isSyncing: false, error: 'Failed to sync with Google Tasks' });
    }
  },
}));
