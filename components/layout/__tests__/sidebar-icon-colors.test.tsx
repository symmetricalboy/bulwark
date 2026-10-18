import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mailbox } from '@/lib/jmap/types';

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
const { useSettingsStore } = await import('@/stores/settings-store');

const mailboxes: Mailbox[] = [
  { id: 'mb-inbox', name: 'Inbox', role: 'inbox', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-unread', name: 'Unread', role: 'unread', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-important', name: 'Important', role: 'important', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-starred', name: 'Starred', role: 'starred', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-drafts', name: 'Drafts', role: 'drafts', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-sent', name: 'Sent', role: 'sent', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-all', name: 'All Mail', role: 'all', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-archive', name: 'Archive', role: 'archive', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-spam', name: 'Spam', role: 'junk', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-trash', name: 'Trash', role: 'trash', parentId: null, totalEmails: 0, unreadEmails: 0, myRights: { mayAddItems: true } },
] as unknown as Mailbox[];

describe('Sidebar icon colors', () => {
  beforeEach(() => {
    useAccountStore.setState({ accounts: [{ id: 'a', isConnected: true }] } as never);
    useSettingsStore.setState({
      colorfulSidebarIcons: true,
      iconColorPalette: 'theme-accent',
      emailKeywords: [
        { id: 'orange', label: 'Orange', color: 'orange' },
        { id: 'pink', label: 'Pink', color: 'pink' },
      ],
      hideAccountSwitcher: true,
    } as never);
  });

  it('renders folder icons with colors matching the default tag palette', () => {
    const { container } = render(
      <Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" showScheduledMailbox={true} />
    );

    const expectedByMailboxId: Record<string, string> = {
      'mb-inbox': 'text-blue-500',
      'mb-unread': 'text-lime-500',
      'mb-important': 'text-pink-500',
      'mb-starred': 'text-yellow-500',
      'mb-drafts': 'text-purple-500',
      '__scheduled__': 'text-cyan-500',
      'mb-sent': 'text-green-500',
      'mb-all': 'text-indigo-500',
      'mb-archive': 'text-orange-500',
      'mb-spam': 'text-red-500',
      'mb-trash': 'text-gray-500',
    };

    for (const [mailboxId, expectedClass] of Object.entries(expectedByMailboxId)) {
      const row = container.querySelector(`[data-mailbox-id="${mailboxId}"]`);
      expect(row, `row for ${mailboxId}`).not.toBeNull();
      const svg = row?.querySelector('svg');
      expect(svg, `svg for ${mailboxId}`).not.toBeNull();
      expect(svg?.getAttribute('class')).toContain(expectedClass);
    }
  });

  it('renders Important icon from the selected icon pack (Tabler, Material Symbols, Lucide)', () => {
    useSettingsStore.setState({ iconSet: 'tabler' } as never);
    const { container, rerender } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);
    let importantSvg = container.querySelector('[data-mailbox-id="mb-important"] svg');
    expect(importantSvg?.getAttribute('class')).toContain('tabler-icon-label-important');

    useSettingsStore.setState({ iconSet: 'material-symbols' } as never);
    rerender(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);
    importantSvg = container.querySelector('[data-mailbox-id="mb-important"] svg');
    expect(importantSvg?.textContent).toBe('label_important');

    useSettingsStore.setState({ iconSet: 'lucide' } as never);
    rerender(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);
    importantSvg = container.querySelector('[data-mailbox-id="mb-important"] svg');
    expect(importantSvg?.getAttribute('class')).toContain('lucide-milestone');
  });

  it('renders Orange and Pink tags with their respective colors', () => {
    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);

    // Orange tag
    const orangeSvg = container.querySelector('svg.text-orange-500');
    expect(orangeSvg).not.toBeNull();

    // Pink tag
    const pinkSvg = container.querySelector('svg.text-pink-500');
    expect(pinkSvg).not.toBeNull();
  });
});
