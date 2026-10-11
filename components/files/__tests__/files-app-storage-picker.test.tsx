import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAccountStore } from '@/stores/account-store';
import { useAuthStore } from '@/stores/auth-store';
import { useFileStore } from '@/stores/file-store';
import { FilesApp } from '../files-app';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/files',
}));

vi.mock('@/hooks/use-config', () => ({
  useConfig: () => ({
    filesEnabled: true,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: 'Files',
      bulwark_files: 'Files',
      google_drive: 'Google Drive',
      not_available: 'Files not available',
      open_google_drive: 'Open Google Drive',
      stability_warning: 'Stability warning',
    };
    return map[key] || key;
  },
}));

vi.mock('@/lib/google/google-drive-client', () => ({
  getGoogleStatus: vi.fn().mockResolvedValue({
    connected: true,
    email: 'user@gmail.com',
    name: 'Google User',
    picture: '',
  }),
  fetchGoogleDriveFiles: vi.fn().mockResolvedValue({ files: [] }),
}));

vi.mock('@/hooks/use-google-drive', () => ({
  useGoogleDrive: () => ({
    files: [],
    loading: false,
    error: null,
    accountStatus: { connected: true, email: 'user@gmail.com' },
    currentFolderId: null,
    breadcrumbs: [],
    searchQuery: '',
    section: 'my-drive',
    refresh: vi.fn(),
    navigateToFolder: vi.fn(),
    setSearchQuery: vi.fn(),
    setSection: vi.fn(),
    createFolder: vi.fn(),
    deleteFile: vi.fn(),
    starFile: vi.fn(),
  }),
}));

vi.mock('../file-browser', () => ({
  FileBrowser: () => <div data-testid="file-browser">File Browser Content</div>,
}));

vi.mock('../google-drive-browser', () => ({
  GoogleDriveBrowser: () => <div data-testid="google-drive-browser">Google Drive Browser Content</div>,
}));

vi.mock('@/components/layout/navigation-rail', () => ({
  NavigationRail: () => <div data-testid="navigation-rail" />,
}));

describe('FilesApp Storage & Account Picker', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      activeAccountId: 'acc-1',
      client: {
        supportsPrincipals: () => false,
        getFilesAccountId: () => 'acc-1',
        getMaxSizeUpload: () => 0,
      } as never,
    });
    useAccountStore.setState({
      accounts: [
        {
          id: 'acc-1',
          label: 'Primary Account',
          displayName: 'Primary Account',
          email: 'user@comail.at',
          username: 'user',
          serverUrl: 'https://mail.comail.at',
          authMode: 'basic',
          cookieSlot: 0,
          rememberMe: true,
          lastLoginAt: Date.now(),
          isConnected: true,
          hasError: false,
          isDefault: true,
          avatarColor: '#6366F1',
        },
      ],
      activeAccountId: 'acc-1',
      defaultAccountId: 'acc-1',
    });
    useFileStore.setState({
      supportsFiles: true,
      currentAccountId: 'acc-1',
      client: {
        supportsPrincipals: () => false,
        getFilesAccountId: () => 'acc-1',
      } as never,
    });
  });

  it('renders the top picker dropdown and switches between Comail Files and Google Drive', async () => {
    render(<FilesApp />);

    // Top picker button initially shows active Comail Files account
    const pickerButton = await screen.findByRole('button', { name: /Primary Account/i });
    expect(pickerButton).toBeInTheDocument();
    expect(screen.getByTestId('file-browser')).toBeInTheDocument();

    // Verify there are no duplicate/segmented Google Drive buttons
    expect(screen.queryByRole('button', { name: 'Google Drive' })).not.toBeInTheDocument();

    // Open dropdown menu
    fireEvent.click(pickerButton);

    // Dropdown reveals Comail Files and External Accounts sections
    expect(screen.getByText('Comail Files')).toBeInTheDocument();
    expect(screen.getByText('External Accounts')).toBeInTheDocument();
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();

    // Select Google Drive
    const googleDriveOption = screen.getByRole('button', { name: /Google Drive user@gmail\.com/i });
    fireEvent.click(googleDriveOption);

    // Now Google Drive browser is active
    expect(await screen.findByTestId('google-drive-browser')).toBeInTheDocument();
    expect(screen.queryByTestId('file-browser')).not.toBeInTheDocument();

    // Top picker button now displays Google Drive
    const updatedPicker = screen.getByRole('button', { name: /Google Drive.*user@gmail\.com/i });
    expect(updatedPicker).toBeInTheDocument();

    // Switch back to Comail Files via dropdown
    fireEvent.click(updatedPicker);
    const comailOption = screen.getByRole('button', { name: /Primary Account user@comail\.at/i });
    fireEvent.click(comailOption);

    // Back to FileBrowser
    expect(await screen.findByTestId('file-browser')).toBeInTheDocument();
  });
});
