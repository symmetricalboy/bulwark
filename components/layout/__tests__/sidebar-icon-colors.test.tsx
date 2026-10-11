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

  it('renders Trash icon with gray (text-muted-foreground) color', () => {
    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);
    const trashRow = container.querySelector('[data-mailbox-id="mb-trash"]');
    expect(trashRow).not.toBeNull();

    const trashSvg = trashRow?.querySelector('svg');
    expect(trashSvg).not.toBeNull();
    expect(trashSvg?.getAttribute('class')).toContain('text-muted-foreground');
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
