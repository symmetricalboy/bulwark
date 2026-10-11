import type { GoogleTask, GoogleTaskList } from './types';
import type { CalendarTask } from '@/lib/jmap/types';

export const GOOGLE_TASKS_CALENDAR_ID = 'google-tasks';
export const COMAIL_TASKS_CALENDAR_ID = 'comail-tasks';

/**
 * Converts a native Comail task to a JMAP-compatible CalendarTask so it can be rendered
 * seamlessly on the calendar grid views and in the task store.
 */
export function nativeTaskToCalendarTask(
  task: {
    id: string;
    title: string;
    notes?: string;
    due?: string;
    status: 'needsAction' | 'completed';
    completed?: string;
    parent?: string;
    updated?: string;
  },
  listId: string
): CalendarTask {
  const isCompleted = task.status === 'completed';
  const hasTime = task.due ? !task.due.endsWith('T00:00:00.000Z') && !task.due.endsWith('T00:00:00Z') : false;

  return {
    id: task.id,
    calendarIds: {
      [listId]: true,
      [COMAIL_TASKS_CALENDAR_ID]: true,
    },
    '@type': 'Task',
    uid: `comail-task-${task.id}`,
    title: task.title || '',
    description: task.notes || '',
    due: task.due || null,
    start: null,
    duration: null,
    timeZone: null,
    showWithoutTime: !hasTime,
    progress: isCompleted ? 'completed' : 'needs-action',
    progressUpdated: task.completed || null,
    priority: 0,
    privacy: 'public',
    keywords: null,
    categories: null,
    color: '#6366F1',
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

/**
 * Converts a GoogleTask to a JMAP-compatible CalendarTask so it can be rendered
 * seamlessly on the calendar grid views and in the task store.
 */
export function googleTaskToCalendarTask(task: GoogleTask, listId: string): CalendarTask {
  const isCompleted = task.status === 'completed';
  const hasTime = task.due ? !task.due.endsWith('T00:00:00.000Z') && !task.due.endsWith('T00:00:00Z') : false;

  return {
    id: task.id,
    calendarIds: {
      [listId]: true,
      [GOOGLE_TASKS_CALENDAR_ID]: true,
    },
    '@type': 'Task',
    uid: `gtask-${task.id}`,
    title: task.title || '',
    description: task.notes || '',
    due: task.due || null,
    start: null,
    duration: null,
    timeZone: null,
    showWithoutTime: !hasTime,
    progress: isCompleted ? 'completed' : 'needs-action',
    progressUpdated: task.completed || null,
    priority: 0,
    privacy: 'public',
    keywords: null,
    categories: null,
    color: '#4285F4',
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

/**
 * Converts a CalendarTask to partial GoogleTask for creating or updating via Google Tasks API.
 */
export function calendarTaskToGoogleTask(task: Partial<CalendarTask>): Partial<GoogleTask> {
  const result: Partial<GoogleTask> = {};

  if (task.title !== undefined) {
    result.title = task.title;
  }
  if (task.description !== undefined) {
    result.notes = task.description;
  }
  if (task.progress !== undefined) {
    result.status = task.progress === 'completed' ? 'completed' : 'needsAction';
  }
  if (task.due !== undefined) {
    if (task.due) {
      // Google Tasks API expects RFC 3339 timestamp formatted string
      const date = new Date(task.due);
      result.due = date.toISOString();
    } else {
      result.due = undefined;
    }
  }

  return result;
}
