import { describe, it, expect } from 'vitest';
import {
  googleTaskToCalendarTask,
  calendarTaskToGoogleTask,
  GOOGLE_TASKS_CALENDAR_ID,
} from '../tasks-mapper';
import type { GoogleTask } from '../types';
import type { CalendarTask } from '@/lib/jmap/types';

describe('Google Tasks Mapper', () => {
  it('converts a GoogleTask to a CalendarTask', () => {
    const gTask: GoogleTask = {
      id: 'gtask-123',
      title: 'Buy groceries',
      notes: 'Milk, eggs, bread',
      status: 'needsAction',
      due: '2026-10-15T00:00:00.000Z',
      updated: '2026-10-11T12:00:00.000Z',
    };

    const calTask = googleTaskToCalendarTask(gTask, 'list-primary');

    expect(calTask.id).toBe('gtask-123');
    expect(calTask.title).toBe('Buy groceries');
    expect(calTask.description).toBe('Milk, eggs, bread');
    expect(calTask.progress).toBe('needs-action');
    expect(calTask.calendarIds['list-primary']).toBe(true);
    expect(calTask.calendarIds[GOOGLE_TASKS_CALENDAR_ID]).toBe(true);
    expect(calTask.showWithoutTime).toBe(true);
    expect(calTask.due).toBe('2026-10-15T00:00:00.000Z');
  });

  it('marks completed status correctly', () => {
    const gTask: GoogleTask = {
      id: 'gtask-completed',
      title: 'Finished homework',
      status: 'completed',
      completed: '2026-10-11T10:00:00.000Z',
    };

    const calTask = googleTaskToCalendarTask(gTask, 'list-primary');

    expect(calTask.progress).toBe('completed');
    expect(calTask.progressUpdated).toBe('2026-10-11T10:00:00.000Z');
  });

  it('handles subtasks with parent relation', () => {
    const gTask: GoogleTask = {
      id: 'subtask-1',
      title: 'Call dentist',
      status: 'needsAction',
      parent: 'parent-task-99',
    };

    const calTask = googleTaskToCalendarTask(gTask, 'list-primary');

    expect(calTask.relatedTo).toBeDefined();
    expect(calTask.relatedTo?.['parent-task-99']).toEqual({
      '@type': 'Relation',
      relation: { parent: true },
    });
  });

  it('converts a partial CalendarTask back to GoogleTask updates', () => {
    const calTask: Partial<CalendarTask> = {
      title: 'Updated title',
      description: 'Updated notes',
      progress: 'completed',
      due: '2026-10-20T15:00:00.000Z',
    };

    const gTask = calendarTaskToGoogleTask(calTask);

    expect(gTask.title).toBe('Updated title');
    expect(gTask.notes).toBe('Updated notes');
    expect(gTask.status).toBe('completed');
    expect(gTask.due).toBe('2026-10-20T15:00:00.000Z');
  });
});
