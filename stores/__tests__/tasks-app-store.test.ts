import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTasksAppStore } from '../tasks-app-store';
import { useTaskStore } from '../task-store';
import { useAccountStore } from '../account-store';
import { COMAIL_TASKS_CALENDAR_ID, GOOGLE_TASKS_CALENDAR_ID } from '@/lib/google/tasks-mapper';

vi.mock('@/lib/google/google-tasks-client', () => ({
  getGoogleStatus: vi.fn().mockResolvedValue({ connected: false }),
  fetchGoogleTaskLists: vi.fn().mockResolvedValue([]),
  fetchAllGoogleTasks: vi.fn().mockResolvedValue([]),
  createGoogleTaskList: vi.fn(),
  updateGoogleTaskList: vi.fn(),
  deleteGoogleTaskList: vi.fn(),
  createGoogleTask: vi.fn(),
  updateGoogleTask: vi.fn(),
  deleteGoogleTask: vi.fn(),
  clearCompletedGoogleTasks: vi.fn(),
}));

describe('useTasksAppStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.setState({ accounts: [], activeAccountId: null });
    useTaskStore.setState({ tasks: [] });

    // Reset store state
    useTasksAppStore.setState({
      lists: [{ id: 'default-list', title: 'My Tasks', isDefault: true, source: 'comail' }],
      activeListId: 'default-list',
      tasks: [],
      selectedTaskId: null,
      filter: 'all',
      sortBy: 'myOrder',
      isGoogleConnected: false,
      isSyncing: false,
      isInitialized: false,
      error: null,
      currentAccountId: null,
    });
  });

  it('initializes with native Comail default list without any external account', async () => {
    await useTasksAppStore.getState().initialize('acc-1');

    const state = useTasksAppStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isGoogleConnected).toBe(false);
    expect(state.lists.length).toBeGreaterThanOrEqual(1);
    expect(state.lists[0].source).toBe('comail');
    expect(state.lists[0].title).toBe('My Tasks');
  });

  it('creates and selects a new native Comail list', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const newList = await store.createList('Work Tasks');

    const updated = useTasksAppStore.getState();
    expect(updated.lists.length).toBe(2);
    expect(newList.source).toBe('comail');
    expect(newList.comailAccountId).toBe('acc-1');
    expect(updated.lists.find((l) => l.title === 'Work Tasks')).toBeDefined();
    expect(updated.activeListId).toBe(newList.id);
  });

  it('updates a list title', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const listId = store.lists[0].id;
    await store.updateList(listId, 'Personal To-Dos');

    const updated = useTasksAppStore.getState();
    expect(updated.lists[0].title).toBe('Personal To-Dos');
  });

  it('creates a task in the active list and syncs to calendar store', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const task = await store.createTask({
      title: 'Complete project proposal',
      notes: 'Send PDF to team',
      due: '2026-10-15T00:00:00.000Z',
    });

    const updated = useTasksAppStore.getState();
    expect(updated.tasks).toHaveLength(1);
    expect(updated.tasks[0].id).toBe(task.id);
    expect(updated.tasks[0].title).toBe('Complete project proposal');
    expect(updated.tasks[0].status).toBe('needsAction');
    expect(updated.tasks[0].source).toBe('comail');
    expect(updated.tasks[0].comailAccountId).toBe('acc-1');
    expect(updated.selectedTaskId).toBe(task.id);

    // Verify it synced to useTaskStore (calendar store)
    const calendarTasks = useTaskStore.getState().tasks;
    expect(calendarTasks).toHaveLength(1);
    expect(calendarTasks[0].id).toBe(task.id);
    expect(calendarTasks[0].calendarIds?.[COMAIL_TASKS_CALENDAR_ID]).toBe(true);
  });

  it('toggles task completion status', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const task = await store.createTask({ title: 'Task to toggle' });

    await store.toggleTaskComplete(task.id);
    let updated = useTasksAppStore.getState();
    expect(updated.tasks[0].status).toBe('completed');
    expect(updated.tasks[0].completed).toBeDefined();

    await store.toggleTaskComplete(task.id);
    updated = useTasksAppStore.getState();
    expect(updated.tasks[0].status).toBe('needsAction');
  });

  it('toggles task star', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const task = await store.createTask({ title: 'Star test' });

    await store.toggleTaskStar(task.id);
    let updated = useTasksAppStore.getState();
    expect(updated.tasks[0].starred).toBe(true);

    await store.toggleTaskStar(task.id);
    updated = useTasksAppStore.getState();
    expect(updated.tasks[0].starred).toBe(false);
  });

  it('deletes a task', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const task = await store.createTask({ title: 'Task to delete' });

    await store.deleteTask(task.id);
    const updated = useTasksAppStore.getState();
    expect(updated.tasks).toHaveLength(0);
    expect(updated.selectedTaskId).toBeNull();
  });

  it('clears completed tasks from list', async () => {
    await useTasksAppStore.getState().initialize('acc-1');
    const store = useTasksAppStore.getState();
    const t1 = await store.createTask({ title: 'Active 1' });
    const t2 = await store.createTask({ title: 'Completed 1' });
    await store.toggleTaskComplete(t2.id);

    await store.clearCompleted(store.activeListId);
    const updated = useTasksAppStore.getState();
    expect(updated.tasks).toHaveLength(1);
    expect(updated.tasks[0].id).toBe(t1.id);
  });

  it('partitions native tasks per Comail account', async () => {
    // Account A
    await useTasksAppStore.getState().initialize('acc-alice');
    await useTasksAppStore.getState().createTask({ title: "Alice's Secret Task" });
    expect(useTasksAppStore.getState().tasks).toHaveLength(1);
    expect(useTasksAppStore.getState().tasks[0].title).toBe("Alice's Secret Task");

    // Switch to Account B
    await useTasksAppStore.getState().initialize('acc-bob');
    expect(useTasksAppStore.getState().tasks).toHaveLength(0);
    await useTasksAppStore.getState().createTask({ title: "Bob's Project Task" });
    expect(useTasksAppStore.getState().tasks).toHaveLength(1);
    expect(useTasksAppStore.getState().tasks[0].title).toBe("Bob's Project Task");

    // Switch back to Account A
    await useTasksAppStore.getState().initialize('acc-alice');
    expect(useTasksAppStore.getState().tasks).toHaveLength(1);
    expect(useTasksAppStore.getState().tasks[0].title).toBe("Alice's Secret Task");
  });

  it('migrates legacy unpartitioned storage data gracefully', async () => {
    localStorage.setItem(
      'bulwark_tasks_lists',
      JSON.stringify([{ id: 'legacy-list-1', title: 'Legacy Tasks', isDefault: true }])
    );
    localStorage.setItem(
      'bulwark_tasks_items',
      JSON.stringify([{ id: 'legacy-task-1', listId: 'legacy-list-1', title: 'Old Legacy Item', status: 'needsAction' }])
    );

    await useTasksAppStore.getState().initialize('migrated-acc');

    const state = useTasksAppStore.getState();
    expect(state.lists.some((l) => l.title === 'Legacy Tasks')).toBe(true);
    expect(state.tasks.some((t) => t.title === 'Old Legacy Item')).toBe(true);
  });
});
