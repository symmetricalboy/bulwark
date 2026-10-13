import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleMailSidebarSection } from '../google-mail-sidebar-section';
import type { GoogleMailAccountData } from '@/hooks/use-google-mail';
import { useSettingsStore } from '@/stores/settings-store';

describe('GoogleMailSidebarSection', () => {
  const accountsData: GoogleMailAccountData[] = [
    {
      account: {
        id: 'g-1',
        email: 'alice@gmail.com',
        name: 'Alice',
        enabledApps: { gmail: true, drive: false, calendar: 'none', tasks: 'none', contacts: 'none' },
        connectedAt: 1700000000000,
      },
      unreadTotal: 1200,
      mailboxes: [
        { id: 'mb-g-inbox', name: 'Inbox', role: 'inbox', unreadEmails: 1200, totalEmails: 5000, parentId: null } as never,
        { id: 'mb-g-sent', name: 'Sent', role: 'sent', unreadEmails: 0, totalEmails: 300, parentId: null } as never,
        { id: 'mb-g-drafts', name: 'Drafts', role: 'drafts', unreadEmails: 15, totalEmails: 15, parentId: null } as never,
      ],
    },
  ];

  beforeEach(() => {
    useSettingsStore.setState({ hiddenFolderIds: [] } as never);
  });

  it('renders account header and mailboxes with unified row container, equidistant badge positioning, and 999+ cap', () => {
    const onMailboxSelect = vi.fn();
    const { container } = render(
      <GoogleMailSidebarSection
        accountsData={accountsData}
        selectedMailbox="mb-g-inbox"
        onMailboxSelect={onMailboxSelect}
      />
    );

    // Account Header email
    expect(screen.getByText('alice@gmail.com')).toBeInTheDocument();

    // Mailboxes rendered
    expect(screen.getByText(/Inbox|sidebar\.mailboxes\.inbox/)).toBeInTheDocument();
    expect(screen.getByText(/Sent|sidebar\.mailboxes\.sent/)).toBeInTheDocument();
    expect(screen.getByText(/Drafts|sidebar\.mailboxes\.drafts/)).toBeInTheDocument();

    // Inbox count capped at 999+
    const inboxRow = container.querySelector('[data-testid="folder-row"][data-selected="true"]');
    expect(inboxRow).toBeInTheDocument();
    const inboxCounts = inboxRow?.querySelector('[data-testid="folder-counts"]');
    expect(inboxCounts).toBeInTheDocument();
    expect(inboxCounts?.textContent).toContain('999+');
    // Equidistant positioning: centered 72px column (matching icon midpoint 36px from left)
    expect(inboxCounts).toHaveStyle({ width: '72px' });

    // Drafts count is 15 (below 1000)
    const draftsCounts = container.querySelectorAll('[data-testid="folder-counts"]')[1];
    expect(draftsCounts?.textContent).toBe('15');
    expect(draftsCounts).toHaveStyle({ width: '72px' });

    // Badge styling uses pill classes
    const badge = inboxCounts?.querySelector('span');
    expect(badge?.className).toContain('rounded-full');
    expect(badge?.className).toContain('tabular-nums');

    // Clicking mailbox calls onMailboxSelect
    fireEvent.click(screen.getByText(/Drafts|sidebar\.mailboxes\.drafts/));
    expect(onMailboxSelect).toHaveBeenCalledWith('mb-g-drafts');
  });

  it('does not display unread badges on account header when collapsed', () => {
    const { container } = render(
      <GoogleMailSidebarSection
        accountsData={accountsData}
        selectedMailbox=""
        onMailboxSelect={vi.fn()}
      />
    );

    // Click header to collapse account
    fireEvent.click(screen.getByText('alice@gmail.com'));

    // Mailboxes are collapsed
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();

    // Account header unread badge is not displayed when collapsed
    const headerBadge = container.querySelector('.rounded-full.tabular-nums');
    expect(headerBadge).not.toBeInTheDocument();
  });
});
