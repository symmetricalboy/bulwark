import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FoldersAndTagsSettings } from '../folders-and-tags-settings';
import { useSettingsStore } from '@/stores/settings-store';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/settings/folder-settings', () => ({
  FolderSettings: () => <div data-testid="comail-folder-settings">Comail FolderSettings</div>,
}));

vi.mock('@/components/settings/keyword-settings', () => ({
  KeywordSettings: () => <div data-testid="comail-keyword-settings">Comail KeywordSettings</div>,
}));

const mockRefreshMailboxes = vi.fn();
vi.mock('@/hooks/use-google-mail', () => ({
  useGoogleMail: () => ({
    hasGmailAccounts: true,
    isLoading: false,
    refreshMailboxes: mockRefreshMailboxes,
    accountsData: [
      {
        account: {
          id: 'g-1',
          email: 'dylan@gmail.com',
          enabledApps: { gmail: true, calendar: true, contacts: true, drive: true },
        },
        mailboxes: [
          {
            id: 'google:dylan@gmail.com::INBOX',
            originalId: 'INBOX',
            name: 'Inbox',
            role: 'inbox',
            totalEmails: 10,
            unreadEmails: 2,
            totalThreads: 10,
            unreadThreads: 2,
            sortOrder: 1,
            isSubscribed: true,
            myRights: {
              mayReadItems: true,
              mayAddItems: true,
              mayRemoveItems: true,
              maySetSeen: true,
              maySetKeywords: true,
              mayCreateChild: false,
              mayRename: false,
              mayDelete: false,
              maySubmit: false,
            },
          },
          {
            id: 'google:dylan@gmail.com::Label_1',
            originalId: 'Label_1',
            name: 'Work',
            totalEmails: 4,
            unreadEmails: 0,
            totalThreads: 4,
            unreadThreads: 0,
            sortOrder: 20,
            isSubscribed: true,
            myRights: {
              mayReadItems: true,
              mayAddItems: true,
              mayRemoveItems: true,
              maySetSeen: true,
              maySetKeywords: true,
              mayCreateChild: false,
              mayRename: true,
              mayDelete: true,
              maySubmit: false,
            },
          },
        ],
        unreadTotal: 2,
      },
    ],
  }),
}));

describe('FoldersAndTagsSettings', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useSettingsStore.setState({
      hiddenFolderIds: [],
      googleStarsSubmenuEnabled: {},
      googleHiddenStarIds: {},
    });
  });

  it('renders the account picker and defaults to the Comail account', () => {
    render(<FoldersAndTagsSettings />);

    expect(screen.getByTestId('folders-account-picker')).toBeInTheDocument();
    expect(screen.getByTestId('account-picker-comail:primary')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('account-picker-google:dylan@gmail.com')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('comail-folder-settings')).toBeInTheDocument();
  });

  it('switches to Google account folders and stars configuration when a Google account is selected in the picker', () => {
    render(<FoldersAndTagsSettings />);

    fireEvent.click(screen.getByTestId('account-picker-google:dylan@gmail.com'));

    expect(screen.getByTestId('account-picker-google:dylan@gmail.com')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('subtab-google-folders')).toBeInTheDocument();
    expect(screen.getByTestId('subtab-google-stars')).toBeInTheDocument();
    expect(screen.getByText('Folder & Label Visibility')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();

    // Switch to Gmail Stars (12 Stars) sub-tab
    fireEvent.click(screen.getByTestId('subtab-google-stars'));
    expect(screen.getByText('Enable 12 Stars Submenu')).toBeInTheDocument();

    const toggle = screen.getByTestId('toggle-gmail-stars-submenu');
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().googleStarsSubmenuEnabled['dylan@gmail.com']).toBe(true);
    expect(screen.getByText('Visible Stars')).toBeInTheDocument();
  });

  it('pre-selects the Google account when deep-linked from the mail sidebar via sessionStorage', () => {
    sessionStorage.setItem('settings-deep-link-account', 'google:dylan@gmail.com');

    render(<FoldersAndTagsSettings />);

    expect(screen.getByTestId('account-picker-google:dylan@gmail.com')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Folder & Label Visibility')).toBeInTheDocument();
    expect(sessionStorage.getItem('settings-deep-link-account')).toBeNull();
  });
});
