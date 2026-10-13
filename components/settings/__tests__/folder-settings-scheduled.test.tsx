import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FolderSettings } from '../folder-settings';
import { useEmailStore } from '@/stores/email-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { Mailbox } from '@/lib/jmap/types';
import { SCHEDULED_MAILBOX_ID } from '@/lib/deep-links';

vi.mock('../settings-section', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../settings-section')>()),
  SettingsSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function makeMailbox(overrides: Partial<Mailbox>): Mailbox {
  return {
    id: 'mb',
    name: 'Folder',
    sortOrder: 0,
    totalEmails: 0,
    unreadEmails: 0,
    totalThreads: 0,
    unreadThreads: 0,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true,
    },
    isSubscribed: true,
    isShared: false,
    ...overrides,
  } as Mailbox;
}

describe('FolderSettings scheduled folder configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ client: null } as never);
    useSettingsStore.setState({
      scheduledFolderName: '',
      hideScheduledFolder: false,
    } as never);
    useEmailStore.setState({
      mailboxes: [
        makeMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox' }),
        makeMailbox({ id: 'drafts', name: 'Drafts', role: 'drafts' }),
      ],
      fetchMailboxes: vi.fn(),
    } as never);
  });

  it('renders Scheduled in the folder configuration list with role badge', () => {
    render(<FolderSettings />);
    expect(screen.getAllByText('role_scheduled').length).toBeGreaterThanOrEqual(1);
  });

  it('allows renaming the Scheduled folder', () => {
    render(<FolderSettings />);

    // Scheduled is the 3rd folder in the list; its rename button is the 3rd one
    const renameBtns = screen.getAllByTitle('rename');
    const scheduledRenameBtn = renameBtns[renameBtns.length - 1];
    fireEvent.click(scheduledRenameBtn);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Outbox / Queue' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useSettingsStore.getState().scheduledFolderName).toBe('Outbox / Queue');
  });

  it('allows hiding and showing the Scheduled folder', () => {
    const { container } = render(<FolderSettings />);

    const scheduledRow = container.querySelector(`[data-folder-id="${SCHEDULED_MAILBOX_ID}"]`);
    expect(scheduledRow).toBeInTheDocument();

    const hideBtn = scheduledRow!.querySelector('button[title="hide_folder"]') as HTMLButtonElement;
    expect(hideBtn).toBeInTheDocument();
    expect(scheduledRow!.textContent).not.toContain('hidden');

    fireEvent.click(hideBtn);
    expect(useSettingsStore.getState().hideScheduledFolder).toBe(true);
    expect(useSettingsStore.getState().hiddenFolderIds).toContain(SCHEDULED_MAILBOX_ID);
    expect(scheduledRow!.textContent).toContain('hidden');

    // Now clicking it again should show it
    const showBtn = scheduledRow!.querySelector('button[title="show_folder"]') as HTMLButtonElement;
    fireEvent.click(showBtn);
    expect(useSettingsStore.getState().hideScheduledFolder).toBe(false);
    expect(useSettingsStore.getState().hiddenFolderIds).not.toContain(SCHEDULED_MAILBOX_ID);
    expect(scheduledRow!.textContent).not.toContain('hidden');
  });

  it('allows hiding and showing any regular folder', () => {
    const { container } = render(<FolderSettings />);

    const inboxRow = container.querySelector('[data-folder-id="inbox"]');
    expect(inboxRow).toBeInTheDocument();

    const hideBtn = inboxRow!.querySelector('button[title="hide_folder"]') as HTMLButtonElement;
    expect(hideBtn).toBeInTheDocument();

    fireEvent.click(hideBtn);
    expect(useSettingsStore.getState().hiddenFolderIds).toContain('inbox');
    expect(inboxRow!.textContent).toContain('hidden');

    const showBtn = inboxRow!.querySelector('button[title="show_folder"]') as HTMLButtonElement;
    fireEvent.click(showBtn);
    expect(useSettingsStore.getState().hiddenFolderIds).not.toContain('inbox');
    expect(inboxRow!.textContent).not.toContain('hidden');
  });

  it('shows reset folder order button when custom order is present and resets it on click', () => {
    // 1. Without custom order, reset button is not rendered
    const { unmount } = render(<FolderSettings />);
    expect(screen.queryByText('reset_order')).not.toBeInTheDocument();
    unmount();

    // 2. Set custom order
    useSettingsStore.setState({
      sidebarCustomOrder: {
        accounts: [],
        subcategories: {},
        items: {
          'comail:primary:folders': ['drafts', 'inbox'],
        },
      },
    });

    render(<FolderSettings />);
    const resetBtn = screen.getByText('reset_order');
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(useSettingsStore.getState().sidebarCustomOrder.items['comail:primary:folders']).toBeUndefined();
    expect(screen.queryByText('reset_order')).not.toBeInTheDocument();
  });

  it('renders folders in custom order respecting Scheduled position', () => {
    useEmailStore.setState({
      mailboxes: [
        makeMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox' }),
        makeMailbox({ id: 'drafts', name: 'Drafts', role: 'drafts' }),
        makeMailbox({ id: 'sent', name: 'Sent', role: 'sent' }),
      ],
      fetchMailboxes: vi.fn(),
    } as never);

    // Place Scheduled at the very top
    useSettingsStore.setState({
      sidebarCustomOrder: {
        accounts: [],
        subcategories: {},
        items: {
          'comail:primary:folders': [SCHEDULED_MAILBOX_ID, 'inbox', 'drafts', 'sent'],
        },
      },
    });

    const { container } = render(<FolderSettings />);

    const folderIds = Array.from(container.querySelectorAll('[data-folder-id]')).map((el) =>
      el.getAttribute('data-folder-id')
    );
    expect(folderIds).toEqual([SCHEDULED_MAILBOX_ID, 'inbox', 'drafts', 'sent']);
  });

  it('naturally positions Scheduled after Drafts when mailboxes have server sortOrders and no custom order', () => {
    useEmailStore.setState({
      mailboxes: [
        makeMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox', sortOrder: 10 }),
        makeMailbox({ id: 'drafts', name: 'Drafts', role: 'drafts', sortOrder: 20 }),
        makeMailbox({ id: 'sent', name: 'Sent', role: 'sent', sortOrder: 30 }),
      ],
      fetchMailboxes: vi.fn(),
    } as never);

    useSettingsStore.setState({
      sidebarCustomOrder: {
        accounts: [],
        subcategories: {},
        items: {},
      },
    });

    const { container } = render(<FolderSettings />);

    const folderIds = Array.from(container.querySelectorAll('[data-folder-id]')).map((el) =>
      el.getAttribute('data-folder-id')
    );
    // Should be Inbox, Drafts, Scheduled, Sent (NOT glued to the bottom after Sent)
    expect(folderIds).toEqual(['inbox', 'drafts', SCHEDULED_MAILBOX_ID, 'sent']);
  });

  it('lists Scheduled in standard folder roles with Scheduled mailbox selected by default', () => {
    render(<FolderSettings />);

    // In Standard Folder Roles: Inbox (0), Drafts (1), Scheduled (2), Sent, ...
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(3);

    const scheduledSelect = selects[2] as HTMLSelectElement;
    expect(scheduledSelect.value).toBe(SCHEDULED_MAILBOX_ID);

    // The Scheduled role dropdown includes the virtual Scheduled mailbox option
    const options = Array.from(scheduledSelect.options).map((o) => o.value);
    expect(options).toContain(SCHEDULED_MAILBOX_ID);

    // Other role dropdowns (e.g. Inbox, Drafts) do NOT include the virtual Scheduled mailbox option
    const inboxSelect = selects[0] as HTMLSelectElement;
    const inboxOptions = Array.from(inboxSelect.options).map((o) => o.value);
    expect(inboxOptions).not.toContain(SCHEDULED_MAILBOX_ID);

    // Changing Scheduled role to None hides the scheduled folder
    fireEvent.change(scheduledSelect, { target: { value: '' } });
    expect(useSettingsStore.getState().hideScheduledFolder).toBe(true);
    expect(scheduledSelect.value).toBe('');

    // Changing it back to Scheduled restores it
    fireEvent.change(scheduledSelect, { target: { value: SCHEDULED_MAILBOX_ID } });
    expect(useSettingsStore.getState().hideScheduledFolder).toBe(false);
    expect(scheduledSelect.value).toBe(SCHEDULED_MAILBOX_ID);
  });
});
