import type { TaskItem, TaskList } from '@/stores/tasks-app-store';
import { logger } from '@/lib/logger';
import type { GoogleAppMode } from '@/lib/google/types';
import type { MicrosoftAccountStatusResponse } from './types';

export interface MicrosoftAccountTaskListGroup {
  email: string;
  accountEmail: string;
  mode: GoogleAppMode;
  taskLists: TaskList[];
  lists: TaskList[];
  tasks: TaskItem[];
}

export class MicrosoftTasksClient {
  async getStatus(): Promise<MicrosoftAccountStatusResponse> {
    try {
      const res = await fetch('/api/auth/microsoft/status');
      if (!res.ok) {
        return { configured: false, connected: false, accounts: [] };
      }
      return await res.json();
    } catch {
      return { configured: false, connected: false, accounts: [] };
    }
  }

  async getTaskLists(): Promise<TaskList[]> {
    const groups = await this.getTaskListGroups();
    return groups.flatMap((g) => g.taskLists);
  }

  async getTaskListGroups(): Promise<MicrosoftAccountTaskListGroup[]> {
    try {
      const res = await fetch('/api/microsoft/tasks/lists');
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) return [];
        throw new Error(`Failed to fetch Microsoft task lists: ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.accounts)) {
        return [];
      }

      const rawGroups: Array<{ email: string; mode: GoogleAppMode; taskLists: TaskList[] }> = data.accounts;
      const result: MicrosoftAccountTaskListGroup[] = [];

      for (const group of rawGroups) {
        const lists = group.taskLists || [];
        const allTasks: TaskItem[] = [];
        await Promise.all(
          lists.map(async (list) => {
            const tasks = await this.getTasks(list.id);
            allTasks.push(...tasks);
          })
        );
        result.push({
          email: group.email,
          accountEmail: group.email,
          mode: group.mode,
          taskLists: lists,
          lists,
          tasks: allTasks,
        });
      }

      return result;
    } catch (err) {
      logger.error('Error in MicrosoftTasksClient.getTaskListGroups', { error: err });
      return [];
    }
  }

  async createTaskList(title: string, accountEmail?: string): Promise<TaskList> {
    const res = await fetch('/api/microsoft/tasks/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, accountEmail }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create Microsoft task list: ${res.status}`);
    }
    const data = await res.json();
    return data.taskList;
  }

  async createList(title: string, accountEmail?: string): Promise<TaskList> {
    return this.createTaskList(title, accountEmail);
  }

  async updateTaskList(taskListId: string, title: string): Promise<TaskList> {
    const encodedId = encodeURIComponent(taskListId);
    const res = await fetch(`/api/microsoft/tasks/lists/${encodedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update Microsoft task list: ${res.status}`);
    }
    const data = await res.json();
    return data.taskList;
  }

  async updateList(taskListId: string, title: string): Promise<TaskList> {
    return this.updateTaskList(taskListId, title);
  }

  async deleteTaskList(taskListId: string): Promise<void> {
    const encodedId = encodeURIComponent(taskListId);
    const res = await fetch(`/api/microsoft/tasks/lists/${encodedId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete Microsoft task list: ${res.status}`);
    }
  }

  async deleteList(taskListId: string): Promise<void> {
    return this.deleteTaskList(taskListId);
  }

  async getTasks(taskListId: string): Promise<TaskItem[]> {
    try {
      const params = new URLSearchParams({ taskListId });
      const res = await fetch(`/api/microsoft/tasks?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) return [];
        throw new Error(`Failed to fetch Microsoft tasks: ${res.status}`);
      }
      const data = await res.json();
      return data.tasks || [];
    } catch (err) {
      logger.error('Error in MicrosoftTasksClient.getTasks', { error: err, taskListId });
      return [];
    }
  }

  async createTask(taskListId: string, task: Partial<TaskItem>): Promise<TaskItem> {
    const res = await fetch('/api/microsoft/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskListId, task }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create Microsoft task: ${res.status}`);
    }
    const data = await res.json();
    return data.task;
  }

  async updateTask(taskListId: string, taskId: string, updates: Partial<TaskItem>): Promise<TaskItem> {
    const encodedId = encodeURIComponent(taskId);
    const res = await fetch(`/api/microsoft/tasks/${encodedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskListId, updates }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update Microsoft task: ${res.status}`);
    }
    const data = await res.json();
    return data.task;
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    const encodedId = encodeURIComponent(taskId);
    const params = new URLSearchParams({ taskListId });
    const res = await fetch(`/api/microsoft/tasks/${encodedId}?${params.toString()}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete Microsoft task: ${res.status}`);
    }
  }

  async clearCompleted(taskListId: string): Promise<void> {
    const res = await fetch('/api/microsoft/tasks/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskListId }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to clear completed Microsoft tasks: ${res.status}`);
    }
  }
}

export const microsoftTasksClient = new MicrosoftTasksClient();
