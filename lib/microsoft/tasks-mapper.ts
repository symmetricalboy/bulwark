import type { CalendarTask } from '@/lib/jmap/types';
import type { TaskItem, TaskList } from '@/stores/tasks-app-store';
import type { MicrosoftGraphTodoList, MicrosoftGraphTodoTask } from './types';

export const MICROSOFT_TASKS_CALENDAR_ID = 'microsoft-tasks';

export function mapMicrosoftToJmapTaskList(
  msList: MicrosoftGraphTodoList,
  accountEmail: string,
  index = 0
): TaskList {
  return {
    id: `microsoft:${accountEmail}::${msList.id}`,
    title: msList.displayName || 'Tasks',
    isDefault: index === 0 || msList.wellknownListName === 'defaultList',
    source: 'microsoft',
    accountEmail,
    localAccountId: `microsoft:${accountEmail}`,
  };
}

export function mapMicrosoftToJmapTask(
  msTask: MicrosoftGraphTodoTask,
  namespacedTaskListId: string,
  accountEmail: string
): TaskItem {
  const isCompleted = msTask.status === 'completed';

  let due: string | undefined;
  if (msTask.dueDateTime?.dateTime) {
    due = `${msTask.dueDateTime.dateTime.slice(0, 10)}T00:00:00.000Z`;
  }

  return {
    id: `microsoft:${accountEmail}::${msTask.id}`,
    listId: namespacedTaskListId,
    title: msTask.title || '(No Title)',
    notes: msTask.body?.content || undefined,
    due,
    status: isCompleted ? 'completed' : 'needsAction',
    completed: msTask.completedDateTime?.dateTime,
    starred: msTask.importance === 'high',
    updated: msTask.lastModifiedDateTime,
    isLocal: false,
    source: 'microsoft',
    accountEmail,
    localAccountId: `microsoft:${accountEmail}`,
  };
}

export function mapJmapToMicrosoftTask(task: Partial<TaskItem>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (task.title !== undefined) {
    payload.title = task.title;
  }

  if (task.notes !== undefined) {
    payload.body = {
      contentType: 'text',
      content: task.notes || '',
    };
  }

  if (task.status !== undefined) {
    payload.status = task.status === 'completed' ? 'completed' : 'notStarted';
  }

  if (task.starred !== undefined) {
    payload.importance = task.starred ? 'high' : 'normal';
  }

  if ('due' in task) {
    if (task.due) {
      const datePart = task.due.split('T')[0];
      payload.dueDateTime = {
        dateTime: `${datePart}T00:00:00`,
        timeZone: 'UTC',
      };
    } else {
      payload.dueDateTime = null;
    }
  }

  return payload;
}

export function microsoftTaskToCalendarTask(task: TaskItem): CalendarTask {
  const isCompleted = task.status === 'completed';
  const hasTime = task.due
    ? !task.due.endsWith('T00:00:00.000Z') && !task.due.endsWith('T00:00:00Z')
    : false;

  return {
    id: task.id,
    calendarIds: {
      [task.listId]: true,
      [MICROSOFT_TASKS_CALENDAR_ID]: true,
    },
    '@type': 'Task',
    uid: `mstask-${task.id}`,
    title: task.title || '',
    description: task.notes || '',
    due: task.due || null,
    start: null,
    duration: null,
    timeZone: null,
    showWithoutTime: !hasTime,
    progress: isCompleted ? 'completed' : 'needs-action',
    progressUpdated: task.completed || null,
    priority: task.starred ? 1 : 0,
    privacy: 'public',
    keywords: null,
    categories: null,
    color: '#0078D4',
    created: null,
    updated: task.updated || new Date().toISOString(),
    recurrenceRules: null,
    alerts: null,
    relatedTo: task.parent
      ? {
          [task.parent]: {
            '@type': 'Relation',
            relation: { parent: true },
          },
        }
      : null,
  };
}
