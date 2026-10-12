import type { ContactCard, CalendarEvent } from '@/lib/jmap/types';
import type { TaskItem } from '@/stores/tasks-app-store';
import type { LinkedGoogleAccountPublic } from '@/lib/google/types';

/**
 * Resolves conflict between two records based on last-write-wins timestamping.
 * Returns the winning record and whether incoming superseded local.
 */
export function resolveTimestampConflict<T>(
  localItem: T,
  incomingItem: T,
  getTimestamp: (item: T) => number
): { winner: T; incomingWon: boolean } {
  const localTime = getTimestamp(localItem);
  const incomingTime = getTimestamp(incomingItem);

  if (incomingTime >= localTime) {
    return { winner: incomingItem, incomingWon: true };
  }
  return { winner: localItem, incomingWon: false };
}

/**
 * Parses timestamp from string or number to epoch ms.
 */
export function parseTimestamp(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Extracts a normalized timestamp from a ContactCard.
 */
export function getContactTimestamp(contact: ContactCard): number {
  // Check common updated timestamp fields
  const cardWithMeta = contact as unknown as {
    updated?: string | number;
    updatedAt?: string | number;
    syncTimestamp?: number;
    metadata?: { sources?: Array<{ updateTime?: string }> };
  };

  if (cardWithMeta.syncTimestamp) return cardWithMeta.syncTimestamp;
  if (cardWithMeta.updated) return parseTimestamp(cardWithMeta.updated);
  if (cardWithMeta.updatedAt) return parseTimestamp(cardWithMeta.updatedAt);
  if (cardWithMeta.metadata?.sources?.[0]?.updateTime) {
    return parseTimestamp(cardWithMeta.metadata.sources[0].updateTime);
  }
  return 0;
}

/**
 * Extracts a normalized timestamp from a CalendarEvent.
 */
export function getCalendarEventTimestamp(event: CalendarEvent): number {
  if (event.updated) return parseTimestamp(event.updated);
  if (event.created) return parseTimestamp(event.created);
  return 0;
}

/**
 * Extracts a normalized timestamp from a TaskItem.
 */
export function getTaskTimestamp(task: TaskItem): number {
  if (task.updated) return parseTimestamp(task.updated);
  return 0;
}

export interface ReconcileContactsOptions {
  accountEmail: string;
  incomingContacts: ContactCard[];
  defaultAddressBookId: string;
  currentContacts: ContactCard[];
  otherSyncAccounts?: LinkedGoogleAccountPublic[];
  onPushToGoogle?: (accountEmail: string, contact: ContactCard) => Promise<void>;
}

export interface ReconcileResult<T> {
  merged: T[];
  propagatedToGoogle: Array<{ accountEmail: string; item: T }>;
  addedCount: number;
  updatedCount: number;
}

/**
 * Synchronizes incoming Google contacts into the default Comail address book,
 * adhering to timestamp-based last-write-wins conflict resolution and
 * propagating updates across other accounts with Sync enabled.
 */
export function reconcileContacts({
  accountEmail,
  incomingContacts,
  defaultAddressBookId,
  currentContacts,
  otherSyncAccounts = [],
  onPushToGoogle,
}: ReconcileContactsOptions): ReconcileResult<ContactCard> {
  const mergedMap = new Map<string, ContactCard>();
  const emailToIdMap = new Map<string, string>();
  const propagatedToGoogle: Array<{ accountEmail: string; item: ContactCard }> = [];
  let addedCount = 0;
  let updatedCount = 0;

  // Index existing contacts
  for (const contact of currentContacts) {
    mergedMap.set(contact.id, contact);
    if (contact.emails) {
      for (const emailEntry of Object.values(contact.emails)) {
        if (emailEntry.address) {
          emailToIdMap.set(emailEntry.address.toLowerCase(), contact.id);
        }
      }
    }
  }

  // Process incoming Google contacts
  for (const incoming of incomingContacts) {
    // Find matching local contact by direct ID or matching primary email
    let existingId: string | undefined;
    if (mergedMap.has(incoming.id)) {
      existingId = incoming.id;
    } else if (incoming.emails) {
      for (const emailEntry of Object.values(incoming.emails)) {
        if (emailEntry.address && emailToIdMap.has(emailEntry.address.toLowerCase())) {
          existingId = emailToIdMap.get(emailEntry.address.toLowerCase());
          break;
        }
      }
    }

    if (existingId) {
      const existing = mergedMap.get(existingId)!;
      const { winner, incomingWon } = resolveTimestampConflict(
        existing,
        incoming,
        getContactTimestamp
      );

      if (incomingWon) {
        // Incoming Google contact is newer; write into default address book
        const updatedContact: ContactCard = {
          ...winner,
          id: existing.id, // Preserve Comail ID for continuity
          addressBookIds: { [defaultAddressBookId]: true },
        };
        mergedMap.set(existing.id, updatedContact);
        updatedCount++;

        // Propagate the newer contact to other accounts with sync enabled
        for (const otherAcc of otherSyncAccounts) {
          if (otherAcc.email.toLowerCase() !== accountEmail.toLowerCase()) {
            propagatedToGoogle.push({ accountEmail: otherAcc.email, item: updatedContact });
            if (onPushToGoogle) {
              void onPushToGoogle(otherAcc.email, updatedContact);
            }
          }
        }
      } else {
        // Local contact is newer; push back to this Google account
        propagatedToGoogle.push({ accountEmail, item: existing });
        if (onPushToGoogle) {
          void onPushToGoogle(accountEmail, existing);
        }
      }
    } else {
      // Brand new contact: assign to default address book
      const newContact: ContactCard = {
        ...incoming,
        addressBookIds: { [defaultAddressBookId]: true },
      };
      mergedMap.set(newContact.id, newContact);
      addedCount++;

      if (newContact.emails) {
        for (const emailEntry of Object.values(newContact.emails)) {
          if (emailEntry.address) {
            emailToIdMap.set(emailEntry.address.toLowerCase(), newContact.id);
          }
        }
      }

      // Propagate new contact to other sync-enabled accounts
      for (const otherAcc of otherSyncAccounts) {
        if (otherAcc.email.toLowerCase() !== accountEmail.toLowerCase()) {
          propagatedToGoogle.push({ accountEmail: otherAcc.email, item: newContact });
          if (onPushToGoogle) {
            void onPushToGoogle(otherAcc.email, newContact);
          }
        }
      }
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    propagatedToGoogle,
    addedCount,
    updatedCount,
  };
}

export interface ReconcileCalendarEventsOptions {
  accountEmail: string;
  incomingEvents: CalendarEvent[];
  defaultCalendarId: string;
  currentEvents: CalendarEvent[];
  otherSyncAccounts?: LinkedGoogleAccountPublic[];
  onPushToGoogle?: (accountEmail: string, event: CalendarEvent) => Promise<void>;
}

/**
 * Synchronizes incoming Google calendar events into the default Comail calendar,
 * adhering to timestamp-based last-write-wins conflict resolution and
 * propagating updates across other accounts with Sync enabled.
 */
export function reconcileCalendarEvents({
  accountEmail,
  incomingEvents,
  defaultCalendarId,
  currentEvents,
  otherSyncAccounts = [],
  onPushToGoogle,
}: ReconcileCalendarEventsOptions): ReconcileResult<CalendarEvent> {
  const mergedMap = new Map<string, CalendarEvent>();
  const propagatedToGoogle: Array<{ accountEmail: string; item: CalendarEvent }> = [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const event of currentEvents) {
    mergedMap.set(event.id, event);
  }

  for (const incoming of incomingEvents) {
    const existing = mergedMap.get(incoming.id);

    if (existing) {
      const { winner, incomingWon } = resolveTimestampConflict(
        existing,
        incoming,
        getCalendarEventTimestamp
      );

      if (incomingWon) {
        const updatedEvent: CalendarEvent = {
          ...winner,
          id: existing.id,
          calendarIds: { [defaultCalendarId]: true },
        };
        mergedMap.set(existing.id, updatedEvent);
        updatedCount++;

        for (const otherAcc of otherSyncAccounts) {
          if (otherAcc.email.toLowerCase() !== accountEmail.toLowerCase()) {
            propagatedToGoogle.push({ accountEmail: otherAcc.email, item: updatedEvent });
            if (onPushToGoogle) {
              void onPushToGoogle(otherAcc.email, updatedEvent);
            }
          }
        }
      } else {
        propagatedToGoogle.push({ accountEmail, item: existing });
        if (onPushToGoogle) {
          void onPushToGoogle(accountEmail, existing);
        }
      }
    } else {
      const newEvent: CalendarEvent = {
        ...incoming,
        calendarIds: { [defaultCalendarId]: true },
      };
      mergedMap.set(newEvent.id, newEvent);
      addedCount++;

      for (const otherAcc of otherSyncAccounts) {
        if (otherAcc.email.toLowerCase() !== accountEmail.toLowerCase()) {
          propagatedToGoogle.push({ accountEmail: otherAcc.email, item: newEvent });
          if (onPushToGoogle) {
            void onPushToGoogle(otherAcc.email, newEvent);
          }
        }
      }
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    propagatedToGoogle,
    addedCount,
    updatedCount,
  };
}

export interface ReconcileTasksOptions {
  accountEmail: string;
  incomingTasks: TaskItem[];
  defaultListId: string;
  currentTasks: TaskItem[];
  otherSyncAccounts?: LinkedGoogleAccountPublic[];
  onPushToGoogle?: (accountEmail: string, task: TaskItem) => Promise<void>;
}

/**
 * Synchronizes incoming Google tasks into the default Comail task list,
 * adhering to timestamp-based last-write-wins conflict resolution and
 * propagating updates across other accounts with Sync enabled.
 */
export function reconcileTasks({
  accountEmail,
  incomingTasks,
  defaultListId,
  currentTasks,
  otherSyncAccounts = [],
  onPushToGoogle,
}: ReconcileTasksOptions): ReconcileResult<TaskItem> {
  const mergedMap = new Map<string, TaskItem>();
  const propagatedToGoogle: Array<{ accountEmail: string; item: TaskItem }> = [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const task of currentTasks) {
    mergedMap.set(task.id, task);
  }

  for (const incoming of incomingTasks) {
    const existing = mergedMap.get(incoming.id);

    if (existing) {
      const { winner, incomingWon } = resolveTimestampConflict(
        existing,
        incoming,
        getTaskTimestamp
      );

      if (incomingWon) {
        const updatedTask: TaskItem = {
          ...winner,
          id: existing.id,
          listId: defaultListId,
        };
        mergedMap.set(existing.id, updatedTask);
        updatedCount++;

        for (const otherAcc of otherSyncAccounts) {
          if (otherAcc.email.toLowerCase() !== accountEmail.toLowerCase()) {
            propagatedToGoogle.push({ accountEmail: otherAcc.email, item: updatedTask });
            if (onPushToGoogle) {
              void onPushToGoogle(otherAcc.email, updatedTask);
            }
          }
        }
      } else {
        propagatedToGoogle.push({ accountEmail, item: existing });
        if (onPushToGoogle) {
          void onPushToGoogle(accountEmail, existing);
        }
      }
    } else {
      const newTask: TaskItem = {
        ...incoming,
        listId: defaultListId,
      };
      mergedMap.set(newTask.id, newTask);
      addedCount++;

      for (const otherAcc of otherSyncAccounts) {
        if (otherAcc.email.toLowerCase() !== accountEmail.toLowerCase()) {
          propagatedToGoogle.push({ accountEmail: otherAcc.email, item: newTask });
          if (onPushToGoogle) {
            void onPushToGoogle(otherAcc.email, newTask);
          }
        }
      }
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    propagatedToGoogle,
    addedCount,
    updatedCount,
  };
}
