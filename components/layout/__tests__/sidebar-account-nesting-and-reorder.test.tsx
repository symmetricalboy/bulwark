import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mailbox } from '@/lib/jmap/types';
import { UNIFIED_MAILBOX_IDS } from '@/lib/jmap/types';

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
  { id: 'mb-inbox', name: 'Inbox', role: 'inbox', parentId: null, totalEmails: 10, unreadEmails: 2, myRights: { mayAddItems: true } },
  { id: 'mb-sent', name: 'Sent', role: 'sent', parentId: null, totalEmails: 5, unreadEmails: 0, myRights: { mayAddItems: true } },
  { id: 'mb-drafts', name: 'Drafts', role: 'drafts', parentId: null, totalEmails: 1, unreadEmails: 0, myRights: { mayAddItems: true } },
] as unknown as Mailbox[];

describe('Sidebar Account Nesting, Gmail Mirroring, and All Inboxes', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: false,
      accountsData: [],
    });
    useAuthStore.setState({
      primaryIdentity: { email: 'dylan@comail.com' },
      activeAccountId: 'acc-1',
    } as never);
    useAccountStore.setState({
      accounts: [{ id: 'acc-1', email: 'dylan@comail.com', isConnected: true }],
    } as never);
    useSettingsStore.setState({
      emailKeywords: [
        { id: 'work', label: 'Work', color: 'blue' },
        { id: 'personal', label: 'Personal', color: 'green' },
      ],
      enableUnifiedMailbox: false,
      hideAccountSwitcher: true,
      interfaceLayout: 'standard',
    } as never);
  });

  it('renders "All Inboxes" button at the top and selects unified inbox on click', () => {
    const onMailboxSelect = vi.fn();
    render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" onMailboxSelect={onMailboxSelect} />);

    const allInboxesRow = screen.getByText('all_inboxes');
    expect(allInboxesRow).toBeInTheDocument();

    fireEvent.click(allInboxesRow);
    expect(onMailboxSelect).toHaveBeenCalledWith(UNIFIED_MAILBOX_IDS.inbox);
  });

  it('nests Folders and Tags under a container named after the Comail account with Comail icon', () => {
    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);

    // Comail account header
    const comailAccountHeader = screen.getByText('dylan@comail.com');
    expect(comailAccountHeader).toBeInTheDocument();

    // Comail icon next to it
    const comailImg = container.querySelector('img[src*="cammie-mark.png"]');
    expect(comailImg).toBeInTheDocument();

    // Subcategories Folders and Tags
    expect(screen.getByText('folders')).toBeInTheDocument();
    expect(screen.getByText('tags')).toBeInTheDocument();

    // Mailboxes inside Folders
    expect(container.querySelector('[data-mailbox-id="mb-inbox"]')).toBeInTheDocument();
    // Tags inside Tags
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('renders Gmail content with exact same nesting logic, categories, and labels', () => {
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: true,
      accountsData: [
        {
          account: { id: 'g1', email: 'user@gmail.com', name: 'Gmail User' },
          mailboxes: [
            { id: 'google:user@gmail.com::INBOX', name: 'Inbox', role: 'inbox', unreadEmails: 4, totalEmails: 20, isSubscribed: true },
            { id: 'google:user@gmail.com::SENT', name: 'Sent', role: 'sent', unreadEmails: 0, totalEmails: 10, isSubscribed: true },
            { id: 'google:user@gmail.com::CATEGORY_PERSONAL', name: 'Primary', role: 'category_personal', originalId: 'CATEGORY_PERSONAL', unreadEmails: 1, totalEmails: 5, isSubscribed: true },
            { id: 'google:user@gmail.com::CATEGORY_SOCIAL', name: 'Social', role: 'category_social', originalId: 'CATEGORY_SOCIAL', unreadEmails: 2, totalEmails: 8, isSubscribed: true },
            { id: 'google:user@gmail.com::ClientWork', name: 'ClientWork', role: undefined, unreadEmails: 0, totalEmails: 3, isSubscribed: true },
          ],
          unreadTotal: 7,
        },
      ],
    });

    const onMailboxSelect = vi.fn();
    render(
      <Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" onMailboxSelect={onMailboxSelect} />
    );

    // Gmail account container header
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();

    // Subcategories for Gmail: Folders, Categories, Labels
    expect(screen.getByText('categories')).toBeInTheDocument();
    expect(screen.getByText('labels')).toBeInTheDocument();

    // Gmail Categories items: Primary, Social, Updates, Forums, Promotions
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Updates')).toBeInTheDocument();
    expect(screen.getByText('Forums')).toBeInTheDocument();
    expect(screen.getByText('Promotions')).toBeInTheDocument();

    // Gmail Custom Label
    expect(screen.getByText('ClientWork')).toBeInTheDocument();

    // Clicking a category selects it
    fireEvent.click(screen.getByText('Primary'));
    expect(onMailboxSelect).toHaveBeenCalledWith('google:user@gmail.com::CATEGORY_PERSONAL');
  });

  it('aggregates unread count in "All Inboxes" across Comail and Gmail inboxes', () => {
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: true,
      accountsData: [
        {
          account: { id: 'g1', email: 'user@gmail.com', name: 'Gmail User' },
          mailboxes: [
            { id: 'google:user@gmail.com::INBOX', name: 'Inbox', role: 'inbox', unreadEmails: 7, totalEmails: 20, isSubscribed: true },
          ],
          unreadTotal: 7,
        },
      ],
    });

    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);
    // Comail has 2 unread in inbox, Google has 7 unread in inbox -> All inboxes should show 9 unread
    const allInboxesRow = container.querySelector('[data-folder-name="all-inboxes"]');
    expect(allInboxesRow).toBeInTheDocument();
    expect(allInboxesRow?.getAttribute('data-has-unread')).toBe('');
    expect(allInboxesRow?.textContent).toContain('9');
  });

  it('makes account containers, subcategories, and items draggable for reordering', () => {
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: true,
      accountsData: [
        {
          account: { id: 'g1', email: 'user@gmail.com', name: 'Gmail User' },
          mailboxes: [
            { id: 'google:user@gmail.com::INBOX', name: 'Inbox', role: 'inbox', unreadEmails: 0, totalEmails: 5, isSubscribed: true },
          ],
          unreadTotal: 0,
        },
      ],
    });

    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);

    // Account headers are draggable
    const comailSection = container.querySelector('[data-section-name="dylan@comail.com"]')?.parentElement;
    expect(comailSection?.getAttribute('draggable')).toBe('true');

    const gmailSection = container.querySelector('[data-section-name="user@gmail.com"]')?.parentElement;
    expect(gmailSection?.getAttribute('draggable')).toBe('true');

    // Subcategories are draggable
    const foldersSubcat = container.querySelector('[data-section-name="folders"]')?.parentElement;
    expect(foldersSubcat?.getAttribute('draggable')).toBe('true');

    // Mailbox rows are draggable
    const inboxRow = container.querySelector('[data-mailbox-id="mb-inbox"]');
    expect(inboxRow?.getAttribute('draggable')).toBe('true');
  });

  it('reorders accounts, subcategories, and items on drag and drop and saves to localStorage', () => {
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: true,
      accountsData: [
        {
          account: { id: 'g1', email: 'user@gmail.com', name: 'Gmail User' },
          mailboxes: [
            { id: 'google:user@gmail.com::INBOX', name: 'Inbox', role: 'inbox', unreadEmails: 0, totalEmails: 5, isSubscribed: true },
          ],
          unreadTotal: 0,
        },
      ],
    });

    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);

    const createDataTransfer = () => {
      const store: Record<string, string> = {};
      return {
        types: ['application/x-bulwark-sidebar-reorder'],
        setData: (format: string, data: string) => {
          store[format] = data;
        },
        getData: (format: string) => store[format] || '',
        effectAllowed: 'move',
        dropEffect: 'move',
      };
    };

    // 1. Reorder Accounts: drag Gmail over Comail
    const comailAccountHeader = container.querySelector('[data-section-name="dylan@comail.com"]')?.parentElement;
    const gmailAccountHeader = container.querySelector('[data-section-name="user@gmail.com"]')?.parentElement;
    expect(comailAccountHeader).toBeInTheDocument();
    expect(gmailAccountHeader).toBeInTheDocument();

    const accountDt = createDataTransfer();
    fireEvent.dragStart(gmailAccountHeader!, { dataTransfer: accountDt });
    fireEvent.dragOver(comailAccountHeader!, { dataTransfer: accountDt });
    fireEvent.drop(comailAccountHeader!, { dataTransfer: accountDt });

    let saved = JSON.parse(localStorage.getItem('mail_sidebar_custom_order_v1') || '{}');
    expect(saved.accounts).toEqual(['google:user@gmail.com', 'comail:primary']);

    // 2. Reorder Subcategories: drag Tags over Folders within Comail
    const comailSectionEl = comailAccountHeader?.closest('.mb-2');
    const foldersSubcat = comailSectionEl?.querySelector('[data-section-name="folders"]')?.parentElement;
    const tagsSubcat = comailSectionEl?.querySelector('[data-section-name="tags"]')?.parentElement;
    expect(foldersSubcat).toBeInTheDocument();
    expect(tagsSubcat).toBeInTheDocument();

    const subcatDt = createDataTransfer();
    fireEvent.dragStart(tagsSubcat!, { dataTransfer: subcatDt });
    fireEvent.dragOver(foldersSubcat!, { dataTransfer: subcatDt });
    fireEvent.drop(foldersSubcat!, { dataTransfer: subcatDt });

    saved = JSON.parse(localStorage.getItem('mail_sidebar_custom_order_v1') || '{}');
    expect(saved.subcategories?.['comail:primary']).toEqual(['tags', 'folders']);

    // 3. Reorder Items: drag Sent over Inbox in Comail Folders
    const inboxItem = comailSectionEl?.querySelector('[data-mailbox-id="mb-inbox"]');
    const sentItem = comailSectionEl?.querySelector('[data-mailbox-id="mb-sent"]');
    expect(inboxItem).toBeInTheDocument();
    expect(sentItem).toBeInTheDocument();

    const itemDt = createDataTransfer();
    fireEvent.dragStart(sentItem!, { dataTransfer: itemDt });
    fireEvent.dragOver(inboxItem!, { dataTransfer: itemDt });
    fireEvent.drop(inboxItem!, { dataTransfer: itemDt });

    saved = JSON.parse(localStorage.getItem('mail_sidebar_custom_order_v1') || '{}');
    expect(saved.items?.['comail:primary:folders']).toEqual(['mb-sent', 'mb-inbox', 'mb-drafts']);
  });

  it('only displays unread count on Gmail folders, categories, and labels without total fractions', () => {
    useSettingsStore.setState({
      showFolderTotalCount: true,
    } as never);

    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: true,
      accountsData: [
        {
          account: { id: 'g1', email: 'user@gmail.com', name: 'Gmail User' },
          mailboxes: [
            { id: 'google:user@gmail.com::INBOX', name: 'Inbox', role: 'inbox', unreadEmails: 4, totalEmails: 20, isSubscribed: true },
            { id: 'google:user@gmail.com::SENT', name: 'Sent', role: 'sent', unreadEmails: 0, totalEmails: 10, isSubscribed: true },
            { id: 'google:user@gmail.com::DRAFTS', name: 'Drafts', role: 'drafts', unreadEmails: 0, totalEmails: 3, isSubscribed: true },
            { id: 'google:user@gmail.com::CATEGORY_PERSONAL', name: 'Primary', role: 'category_personal', originalId: 'CATEGORY_PERSONAL', unreadEmails: 1, totalEmails: 5, isSubscribed: true },
            { id: 'google:user@gmail.com::ClientWork', name: 'ClientWork', role: undefined, unreadEmails: 0, totalEmails: 6, isSubscribed: true },
          ],
          unreadTotal: 5,
        },
      ],
    });

    const { container } = render(<Sidebar mailboxes={mailboxes} selectedMailbox="mb-inbox" />);

    // Comail Inbox displays "2" (only unread, never total count or fraction)
    const comailInboxRow = container.querySelector('[data-mailbox-id="mb-inbox"]');
    const comailCounts = comailInboxRow?.querySelector('[data-testid="folder-counts"]');
    expect(comailCounts?.getAttribute('data-unread')).toBe('2');
    expect(comailCounts?.getAttribute('data-total')).toBe('0');
    expect(comailCounts?.textContent).toBe('2');
    expect(comailCounts?.textContent).not.toContain('/');
    expect(comailCounts?.textContent).not.toContain('10');

    // When an account is collapsed, it must NOT show an unread badge
    const comailAccountHeader = container.querySelector('[data-section-name="dylan@comail.com"]');
    const toggleBtn = comailAccountHeader?.querySelector('button');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn!);
    expect(comailAccountHeader?.getAttribute('data-expanded')).toBe('false');
    const comailHeaderBadge = comailAccountHeader?.querySelector('span.rounded-full');
    expect(comailHeaderBadge).toBeNull();
    // Toggle back to expanded
    fireEvent.click(toggleBtn!);
    expect(comailAccountHeader?.getAttribute('data-expanded')).toBe('true');

    // Gmail Inbox (unread: 4, total: 20) -> only unread "4", totalCount is 0
    const gmailInboxRow = container.querySelector('[data-mailbox-id="google:user@gmail.com::INBOX"]');
    const gmailInboxCounts = gmailInboxRow?.querySelector('[data-testid="folder-counts"]');
    expect(gmailInboxCounts).toBeInTheDocument();
    expect(gmailInboxCounts?.getAttribute('data-unread')).toBe('4');
    expect(gmailInboxCounts?.getAttribute('data-total')).toBe('0');
    expect(gmailInboxCounts?.textContent).toBe('4');
    expect(gmailInboxCounts?.textContent).not.toContain('/');
    expect(gmailInboxCounts?.textContent).not.toContain('20');

    // Gmail Sent (unread: 0, total: 10) -> no count badge rendered
    const gmailSentRow = container.querySelector('[data-mailbox-id="google:user@gmail.com::SENT"]');
    const gmailSentCounts = gmailSentRow?.querySelector('[data-testid="folder-counts"]');
    expect(gmailSentCounts).toBeNull();

    // Gmail Drafts (unread: 0, total: 3) -> displays drafts count 3
    const gmailDraftsRow = container.querySelector('[data-mailbox-id="google:user@gmail.com::DRAFTS"]');
    const gmailDraftsCounts = gmailDraftsRow?.querySelector('[data-testid="folder-counts"]');
    expect(gmailDraftsCounts).toBeInTheDocument();
    expect(gmailDraftsCounts?.getAttribute('data-total')).toBe('3');
    expect(gmailDraftsCounts?.textContent).toBe('3');

    // Gmail Category Personal (unread: 1, total: 5) -> only unread "1"
    const gmailCategoryRow = container.querySelector('[data-mailbox-id="google:user@gmail.com::CATEGORY_PERSONAL"]');
    const gmailCategoryCounts = gmailCategoryRow?.querySelector('[data-testid="folder-counts"]');
    expect(gmailCategoryCounts).toBeInTheDocument();
    expect(gmailCategoryCounts?.getAttribute('data-unread')).toBe('1');
    expect(gmailCategoryCounts?.getAttribute('data-total')).toBe('0');
    expect(gmailCategoryCounts?.textContent).toBe('1');
    expect(gmailCategoryCounts?.textContent).not.toContain('/');

    // Gmail Label ClientWork (unread: 0, total: 6) -> no count badge rendered
    const gmailLabelRow = container.querySelector('[data-mailbox-id="google:user@gmail.com::ClientWork"]');
    const gmailLabelCounts = gmailLabelRow?.querySelector('[data-testid="folder-counts"]');
    expect(gmailLabelCounts).toBeNull();
  });

  it('caps counter displays at 999+ and positions badges equidistant with marginInlineEnd', () => {
    mockUseGoogleMail.mockReturnValue({
      hasGmailAccounts: true,
      accountsData: [
        {
          account: { id: 'g1', email: 'user@gmail.com', name: 'Gmail User' },
          mailboxes: [
            { id: 'google:user@gmail.com::INBOX', name: 'Inbox', role: 'inbox', unreadEmails: 1500, totalEmails: 5000, isSubscribed: true },
          ],
          unreadTotal: 1500,
        },
      ],
    });

    const highCountMailboxes: Mailbox[] = [
      { id: 'mb-inbox', name: 'Inbox', role: 'inbox', parentId: null, totalEmails: 2500, unreadEmails: 1000, myRights: { mayAddItems: true } },
    ] as unknown as Mailbox[];

    const { container } = render(
      <Sidebar mailboxes={highCountMailboxes} selectedMailbox="mb-inbox" />
    );

    // Comail Inbox count capped at 999+
    const comailInboxRow = container.querySelector('[data-mailbox-id="mb-inbox"]');
    const comailCounts = comailInboxRow?.querySelector('[data-testid="folder-counts"]');
    expect(comailCounts).toBeInTheDocument();
    expect(comailCounts?.textContent).toContain('999+');
    // Equidistant positioning: centered 72px column (matching icon midpoint 36px from left)
    expect(comailCounts).toHaveStyle({ width: '72px' });

    // Gmail Inbox count capped at 999+
    const gmailInboxRow = container.querySelector('[data-mailbox-id="google:user@gmail.com::INBOX"]');
    const gmailInboxCounts = gmailInboxRow?.querySelector('[data-testid="folder-counts"]');
    expect(gmailInboxCounts).toBeInTheDocument();
    expect(gmailInboxCounts?.textContent).toContain('999+');
    // Equidistant positioning: centered 72px column (matching icon midpoint 36px from left)
    expect(gmailInboxCounts).toHaveStyle({ width: '72px' });

    // Both badges use unified pill badge classes (text-xs, rounded-full, font-semibold, tabular-nums)
    const comailBadge = comailCounts?.querySelector('span.rounded-full');
    const gmailBadge = gmailInboxCounts?.querySelector('span.rounded-full');
    expect(comailBadge?.className).toContain('rounded-full');
    expect(comailBadge?.className).toContain('tabular-nums');
    expect(gmailBadge?.className).toContain('rounded-full');
    expect(gmailBadge?.className).toContain('tabular-nums');
  });
});

