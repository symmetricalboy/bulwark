import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mailbox } from '@/lib/jmap/types';
import { SCHEDULED_MAILBOX_ID } from '@/lib/deep-links';

const mockUseGoogleMail = vi.fn();
vi.mock('@/hooks/use-google-mail', () => ({
  useGoogleMail: () => mockUseGoogleMail(),
}));

vi.mock('@/components/plugins/plugin-slot', () => ({ PluginSlot: () => null }));
vi.mock('@/components/tour/tour-provider', () => ({
  useTour: () => ({ startTour: vi.fn(), resetTourCompletion: vi.fn(), activeTour: null, endTour: vi.fn(), registerStep: vi.fn() }),
}));
vi.mock('@/contexts/drag-drop-context', () => ({
  useDragDropContext: () => ({ isDragging: false }),
}));
vi.mock('@/hooks/use-mailbox-drop', () => ({
  useMailboxDrop: () => ({ dropHandlers: {}, isValidDropTarget: false, isInvalidDropTarget: false }),
}));
vi.mock('@/hooks/use-tag-drop', () => ({
  useTagDrop: () => ({ dropHandlers: {}, isValidDropTarget: false }),
}));
vi.mock('../account-switcher', () => ({ AccountSwitcher: () => null }));

const { Sidebar } = await import('../sidebar');
const { useAccountStore } = await import('@/stores/account-store');
const { useAuthStore } = await import('@/stores/auth-store');
const { useSettingsStore } = await import('@/stores/settings-store');

const mailboxes: Mailbox[] = [
  { id: 'mb-inbox', name: 'Inbox', role: 'inbox', parentId: undefined, totalEmails: 10, unreadEmails: 2, myRights: { mayAddItems: true } },
  { id: 'mb-sent', name: 'Sent', role: 'sent', parentId: undefined, totalEmails: 5, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-drafts', name: 'Drafts', role: 'drafts', parentId: undefined, totalEmails: 1, unreadEmails: 0, myRights: { mayAddItems: true } },
] as unknown as Mailbox[];

describe('Sidebar Scheduled Folder Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: false,
      accountsData: [],
    });
    useAuthStore.setState({
      primaryIdentity: { email: 'user@comail.com' },
      activeAccountId: 'acc-1',
    } as never);
    useAccountStore.setState({
      accounts: [{ id: 'acc-1', email: 'user@comail.com', isConnected: true }],
    } as never);
    useSettingsStore.setState({
      scheduledFolderName: '',
      hideScheduledFolder: false,
      emailKeywords: [],
      enableUnifiedMailbox: false,
      hideAccountSwitcher: true,
      interfaceLayout: 'standard',
    } as never);
  });

  it('renders Scheduled as a real draggable folder in the Comail folders list', () => {
    const { container } = render(
      <Sidebar
        mailboxes={mailboxes}
        showScheduledMailbox={true}
        scheduledTotal={3}
      />
    );

    const scheduledRow = container.querySelector('[data-mailbox-id="' + SCHEDULED_MAILBOX_ID + '"]');
    expect(scheduledRow).toBeInTheDocument();
    expect(scheduledRow).toHaveAttribute('data-folder-role', 'scheduled');
    expect(scheduledRow).toHaveAttribute('draggable', 'true');

    // Right-side drag handle is removed to conserve horizontal space
    const dragHandle = scheduledRow?.querySelector('span[title="Drag to rearrange"]');
    expect(dragHandle).toBeNull();
  });

  it('renders custom renamed name for Scheduled folder', () => {
    useSettingsStore.setState({
      scheduledFolderName: 'Upcoming Deliveries',
    } as never);

    render(
      <Sidebar
        mailboxes={mailboxes}
        showScheduledMailbox={true}
        scheduledTotal={3}
      />
    );

    expect(screen.getByText('Upcoming Deliveries')).toBeInTheDocument();
  });

  it('hides Scheduled folder when hideScheduledFolder is true', () => {
    useSettingsStore.setState({
      hideScheduledFolder: true,
    } as never);

    const { container } = render(
      <Sidebar
        mailboxes={mailboxes}
        showScheduledMailbox={true}
        scheduledTotal={3}
      />
    );

    const scheduledRow = container.querySelector('[data-mailbox-id="' + SCHEDULED_MAILBOX_ID + '"]');
    expect(scheduledRow).toBeNull();
  });

  it('respects custom drag-and-drop order for Scheduled folder', () => {
    // Put Scheduled before drafts
    localStorage.setItem(
      'mail_sidebar_custom_order_v1',
      JSON.stringify({
        accounts: [],
        subcategories: {},
        items: {
          'comail:primary:folders': [SCHEDULED_MAILBOX_ID, 'mb-inbox', 'mb-drafts', 'mb-sent'],
        },
      })
    );

    const { container } = render(
      <Sidebar
        mailboxes={mailboxes}
        showScheduledMailbox={true}
        scheduledTotal={3}
      />
    );

    const folderRows = Array.from(container.querySelectorAll('[data-mailbox-id]'));
    const comailIds = folderRows
      .map((r) => r.getAttribute('data-mailbox-id'))
      .filter((id): id is string => Boolean(id && !id.startsWith('__unified_')));

    expect(comailIds[0]).toBe(SCHEDULED_MAILBOX_ID);
  });
});
