import { describe, it, expect, vi } from 'vitest';
import {
  resolveTimestampConflict,
  parseTimestamp,
  reconcileContacts,
  reconcileCalendarEvents,
  reconcileTasks,
} from '../sync-engine';
import type { ContactCard, CalendarEvent } from '@/lib/jmap/types';
import type { TaskItem } from '@/stores/tasks-app-store';

describe('sync-engine', () => {
  describe('resolveTimestampConflict', () => {
    it('favors incoming item when incoming timestamp is newer', () => {
      const local = { id: '1', updated: '2026-01-01T00:00:00Z', val: 'old' };
      const incoming = { id: '1', updated: '2026-01-02T00:00:00Z', val: 'new' };

      const res = resolveTimestampConflict(local, incoming, (i) => parseTimestamp(i.updated));
      expect(res.incomingWon).toBe(true);
      expect(res.winner.val).toBe('new');
    });

    it('favors local item when local timestamp is newer', () => {
      const local = { id: '1', updated: '2026-01-05T00:00:00Z', val: 'local-new' };
      const incoming = { id: '1', updated: '2026-01-02T00:00:00Z', val: 'google-old' };

      const res = resolveTimestampConflict(local, incoming, (i) => parseTimestamp(i.updated));
      expect(res.incomingWon).toBe(false);
      expect(res.winner.val).toBe('local-new');
    });
  });

  describe('reconcileContacts', () => {
    it('merges new contacts into default address book', () => {
      const incoming: ContactCard[] = [
        {
          id: 'c1',
          name: { full: 'Google Contact 1' },
          addressBookIds: { 'google-book': true },
          updated: '2026-03-01T00:00:00Z',
        } as unknown as ContactCard,
      ];

      const res = reconcileContacts({
        accountEmail: 'user1@gmail.com',
        incomingContacts: incoming,
        defaultAddressBookId: 'default-comail-book',
        currentContacts: [],
      });

      expect(res.addedCount).toBe(1);
      expect(res.merged).toHaveLength(1);
      expect(res.merged[0].addressBookIds).toEqual({ 'default-comail-book': true });
    });

    it('reconciles conflicting contacts using last-write-wins and propagates to other sync accounts', () => {
      const existing: ContactCard = {
        id: 'local-c1',
        name: { full: 'Old Name' },
        emails: { e1: { address: 'friend@example.com' } },
        addressBookIds: { 'default-comail-book': true },
        updated: '2026-01-01T00:00:00Z',
      } as unknown as ContactCard;

      const incoming: ContactCard = {
        id: 'google-c1',
        name: { full: 'New Name from Google' },
        emails: { e1: { address: 'friend@example.com' } },
        addressBookIds: { 'temp-book': true },
        updated: '2026-02-01T00:00:00Z', // newer!
      } as unknown as ContactCard;

      const pushMock = vi.fn();
      const res = reconcileContacts({
        accountEmail: 'user1@gmail.com',
        incomingContacts: [incoming],
        defaultAddressBookId: 'default-comail-book',
        currentContacts: [existing],
        otherSyncAccounts: [
          { id: 'user2@gmail.com', email: 'user2@gmail.com', connectedAt: 0, enabledApps: { contacts: 'sync' } },
        ],
        onPushToGoogle: pushMock,
      });

      expect(res.updatedCount).toBe(1);
      expect(res.merged[0]?.name?.full).toBe('New Name from Google');
      expect(res.merged[0]?.id).toBe('local-c1');
      expect(pushMock).toHaveBeenCalledWith('user2@gmail.com', expect.objectContaining({
        name: { full: 'New Name from Google' },
      }));
    });
  });

  describe('reconcileCalendarEvents', () => {
    it('merges new events into default calendar and updates newer existing events', () => {
      const existing: CalendarEvent = {
        id: 'evt-1',
        title: 'Old Meeting',
        start: '2026-06-01T10:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        calendarIds: { 'default-cal': true },
      } as unknown as CalendarEvent;

      const incoming: CalendarEvent = {
        id: 'evt-1',
        title: 'Rescheduled Meeting',
        start: '2026-06-01T11:00:00Z',
        updated: '2026-02-01T00:00:00Z',
        calendarIds: { 'google-cal': true },
      } as unknown as CalendarEvent;

      const res = reconcileCalendarEvents({
        accountEmail: 'user1@gmail.com',
        incomingEvents: [incoming],
        defaultCalendarId: 'default-cal',
        currentEvents: [existing],
      });

      expect(res.updatedCount).toBe(1);
      expect(res.merged[0]?.title).toBe('Rescheduled Meeting');
      expect(res.merged[0]?.calendarIds).toEqual({ 'default-cal': true });
    });
  });

  describe('reconcileTasks', () => {
    it('merges and resolves tasks based on timestamp', () => {
      const existing: TaskItem = {
        id: 'task-1',
        listId: 'default-list',
        title: 'Local task',
        status: 'needsAction',
        updated: '2026-05-01T00:00:00Z', // Local is newer
      };

      const incoming: TaskItem = {
        id: 'task-1',
        listId: 'google-list',
        title: 'Google older task',
        status: 'completed',
        updated: '2026-01-01T00:00:00Z',
      };

      const pushMock = vi.fn();
      const res = reconcileTasks({
        accountEmail: 'user1@gmail.com',
        incomingTasks: [incoming],
        defaultListId: 'default-list',
        currentTasks: [existing],
        onPushToGoogle: pushMock,
      });

      expect(res.updatedCount).toBe(0);
      expect(res.merged[0].title).toBe('Local task');
      // Because local is newer, it pushed back to user1@gmail.com
      expect(pushMock).toHaveBeenCalledWith('user1@gmail.com', existing);
    });
  });
});
