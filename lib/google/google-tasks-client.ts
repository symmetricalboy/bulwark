import type { GoogleTask, GoogleTaskList } from './types';
import { getGoogleStatus, type GoogleAccountStatus } from './google-calendar-client';
import { getComailAccountHeaders } from './comail-headers';

export { getGoogleStatus, type GoogleAccountStatus };

export async function fetchGoogleTaskLists(): Promise<GoogleTaskList[]> {
  const res = await fetch('/api/google/tasks/lists', {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch Google task lists (${res.status})`);
  }
  const data = await res.json();
  return data.taskLists || [];
}

export async function createGoogleTaskList(title: string): Promise<GoogleTaskList> {
  const res = await fetch('/api/google/tasks/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create Google task list (${res.status})`);
  const data = await res.json();
  return data.taskList;
}

export async function updateGoogleTaskList(listId: string, title: string): Promise<GoogleTaskList> {
  const res = await fetch(`/api/google/tasks/lists/${encodeURIComponent(listId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to update Google task list (${res.status})`);
  const data = await res.json();
  return data.taskList;
}

export async function deleteGoogleTaskList(listId: string): Promise<void> {
  const res = await fetch(`/api/google/tasks/lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete Google task list (${res.status})`);
}

export async function fetchGoogleTasks(listId?: string, showCompleted: boolean = true): Promise<GoogleTask[]> {
  const query = new URLSearchParams();
  if (listId) query.set('listId', listId);
  query.set('showCompleted', showCompleted ? 'true' : 'false');

  const res = await fetch(`/api/google/tasks?${query.toString()}`, {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch Google tasks (${res.status})`);
  }
  const data = await res.json();
  return data.tasks || [];
}

export async function fetchAllGoogleTasks(): Promise<{ listId: string; listTitle: string; tasks: GoogleTask[] }[]> {
  const res = await fetch('/api/google/tasks?all=true', {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch all Google tasks (${res.status})`);
  }
  const data = await res.json();
  return data.tasksByList || [];
}

export async function createGoogleTask(
  listId: string,
  task: { title: string; notes?: string; due?: string; parent?: string },
  parent?: string
): Promise<GoogleTask> {
  const res = await fetch('/api/google/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ listId, task, parent: parent || task.parent }),
  });
  if (!res.ok) throw new Error(`Failed to create Google task (${res.status})`);
  const data = await res.json();
  return data.task;
}

export async function updateGoogleTask(
  listId: string,
  taskId: string,
  updates: Partial<GoogleTask>
): Promise<GoogleTask> {
  const res = await fetch(`/api/google/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ listId, updates }),
  });
  if (!res.ok) throw new Error(`Failed to update Google task (${res.status})`);
  const data = await res.json();
  return data.task;
}

export async function deleteGoogleTask(listId: string, taskId: string): Promise<void> {
  const query = new URLSearchParams({ listId });
  const res = await fetch(`/api/google/tasks/${encodeURIComponent(taskId)}?${query.toString()}`, {
    method: 'DELETE',
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete Google task (${res.status})`);
}

export async function clearCompletedGoogleTasks(listId: string): Promise<void> {
  const res = await fetch('/api/google/tasks/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ listId }),
  });
  if (!res.ok) throw new Error(`Failed to clear completed Google tasks (${res.status})`);
}
