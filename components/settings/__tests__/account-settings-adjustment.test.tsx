import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSettings } from '../account-settings';
import { AccountInfoDialog } from '../account-info-dialog';
import { LinkedAccountsModal } from '../linked-accounts-modal';

const { accountState, authState, emailState } = vi.hoisted(() => ({
  accountState: {
    accounts: [] as Array<Record<string, unknown>>,
    activeAccountId: 'alice@example.com@mail.example.com',
    setDefaultAccount: vi.fn(),
    reorderAccounts: vi.fn(),
    getAccountById: vi.fn(),
    getActiveAccount: vi.fn(() => null),
  },
  authState: {
    username: 'alice@example.com',
    serverUrl: 'https://mail.example.com',
    isDemoMode: false,
    primaryIdentity: { name: 'Alice Smith', email: 'alice@example.com' },
    authMode: 'basic',
    client: null,
    activeAccountId: null as string | null,
    switchAccount: vi.fn(async () => {}),
    removeAccount: vi.fn(),
  },
  emailState: {
    quota: { used: 1024 * 1024 * 50, total: 1024 * 1024 * 100 }, // 50%
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${namespace}.${key}(${JSON.stringify(params)})`;
    }
    return `${namespace ? namespace + '.' : ''}${key}`;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));

vi.mock('@/stores/account-store', () => ({
  useAccountStore: (selector: (state: typeof accountState) => unknown) => selector(accountState),
}));

vi.mock('@/stores/email-store', () => ({
  useEmailStore: () => emailState,
}));

vi.mock('@/stores/managed-account-store', () => ({
  useManagedAccountStore: (selector: (state: { setManagedAccount: () => void }) => unknown) =>
    selector({ setManagedAccount: vi.fn() }),
}));

const ACCOUNT_1 = {
  id: 'alice@example.com@mail.example.com',
  label: 'Alice Work',
  serverUrl: 'https://mail.example.com',
  username: 'alice@example.com',
  authMode: 'basic',
  cookieSlot: 0,
  rememberMe: true,
  displayName: 'Alice Smith',
  email: 'alice@example.com',
  avatarColor: '#123456',
  did: undefined,
  lastLoginAt: 1000,
  isConnected: true,
  hasError: false,
  isDefault: true,
};

const ACCOUNT_2 = {
  id: 'bob@example.com@mail.example.com',
  label: 'Bob Personal',
  serverUrl: 'https://mail.example.com',
  username: 'bob@example.com',
  authMode: 'oauth',
  cookieSlot: 1,
  rememberMe: true,
  displayName: 'Bob Jones',
  email: 'bob@example.com',
  avatarColor: '#654321',
  did: undefined,
  lastLoginAt: 2000,
  isConnected: true,
  hasError: false,
  isDefault: false,
};

describe('AccountSettings adjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountState.accounts = [ACCOUNT_1, ACCOUNT_2];
    accountState.getAccountById.mockImplementation((id: string) =>
      id === ACCOUNT_1.id ? ACCOUNT_1 : ACCOUNT_2
    );
    authState.activeAccountId = ACCOUNT_1.id;
  });

  it('renders Accounts page heading and Linked Accounts buttons on each account card', () => {
    render(<AccountSettings />);

    expect(screen.getByText('settings.account.title')).toBeInTheDocument();
    const linkedButtons = screen.getAllByText('settings.account.linked_accounts.button');
    expect(linkedButtons).toHaveLength(2);
  });

  it('removes arrow buttons on account rows in the list', () => {
    render(<AccountSettings />);

    // move_up and move_down titles should not exist
    expect(screen.queryByTitle('settings.account.accounts.move_up')).not.toBeInTheDocument();
    expect(screen.queryByTitle('settings.account.accounts.move_down')).not.toBeInTheDocument();
  });

  it('renders Details button on each account card in the list', () => {
    render(<AccountSettings />);

    const infoButtons = screen.getAllByTitle('settings.account.info_button');
    expect(infoButtons).toHaveLength(2);
  });

  it('opens AccountInfoDialog when Details button is clicked', () => {
    render(<AccountSettings />);

    const infoButtons = screen.getAllByTitle('settings.account.info_button');
    fireEvent.click(infoButtons[0]);

    // Dialog title and account details should be in the document
    expect(screen.getByText('settings.account.info_dialog_title')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
  });

  it('opens LinkedAccountsModal scoped to account when Linked Accounts button is clicked', () => {
    render(<AccountSettings />);

    const linkedButtons = screen.getAllByText('settings.account.linked_accounts.button');
    fireEvent.click(linkedButtons[0]);

    expect(screen.getByText('settings.account.linked_accounts.title')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(1);
  });

  it('renders Remove button on each account card in the list', () => {
    render(<AccountSettings />);

    const removeButtons = screen.getAllByTitle('settings.account.remove_button');
    expect(removeButtons).toHaveLength(2);
  });

  it('opens ConfirmDialog when Remove button is clicked, and calls removeAccount on confirm', () => {
    render(<AccountSettings />);

    const removeButtons = screen.getAllByTitle('settings.account.remove_button');
    fireEvent.click(removeButtons[0]);

    // Confirm dialog should be open
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('settings.account.remove_confirm_title')).toBeInTheDocument();

    // Confirm removal
    const confirmButton = within(dialog).getByRole('button', { name: 'settings.account.remove_button' });
    fireEvent.click(confirmButton);

    expect(authState.removeAccount).toHaveBeenCalledWith(ACCOUNT_1.id);
  });

  it('cancels removal when Cancel button is clicked in ConfirmDialog', () => {
    render(<AccountSettings />);

    const removeButtons = screen.getAllByTitle('settings.account.remove_button');
    fireEvent.click(removeButtons[1]);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    const cancelButton = within(dialog).getByRole('button', { name: 'confirm_dialog.cancel' });
    fireEvent.click(cancelButton);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(authState.removeAccount).not.toHaveBeenCalled();
  });
});

describe('AccountInfoDialog', () => {
  it('displays full details for an account including auth mode and server', () => {
    render(
      <AccountInfoDialog
        isOpen={true}
        onClose={vi.fn()}
        account={ACCOUNT_1 as never}
        isActive={true}
        quota={{ used: 500, total: 1000 }}
      />
    );

    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('settings.account.account_age_label')).toBeInTheDocument();
    expect(screen.getByText('settings.account.auth_method_basic')).toBeInTheDocument();
    expect(screen.getByText('mail.example.com')).toBeInTheDocument();
    expect(screen.getByText('settings.account.storage.label')).toBeInTheDocument();
  });

  it('displays non-editable ATProto Handle, ATProto DID, and PDS Host when account has a DID', () => {
    const atprotoAccount = {
      ...ACCOUNT_1,
      did: 'did:plc:vfueyv27ch72hrpxzr4jm3pm',
    };

    render(
      <AccountInfoDialog
        isOpen={true}
        onClose={vi.fn()}
        account={atprotoAccount as never}
        isActive={true}
      />
    );

    // ATProto Handle, ATProto DID, and PDS Host row headers are present
    expect(screen.getByText('ATProto Handle')).toBeInTheDocument();
    expect(screen.getByText('ATProto DID')).toBeInTheDocument();
    expect(screen.getByText('PDS Host')).toBeInTheDocument();

    // DID value is displayed
    expect(screen.getByText('did:plc:vfueyv27ch72hrpxzr4jm3pm')).toBeInTheDocument();

    // Verify there are no edit pencil buttons or inputs (cannot be editable)
    expect(screen.queryByTitle(/Change ATProto account/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Connect ATProto account/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/spaces/i)).not.toBeInTheDocument();
  });
});

describe('LinkedAccountsModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and displays connected Google accounts with per-app toggles and reconnect/remove buttons', async () => {
    const mockAccounts = [
      {
        id: 'user1@gmail.com',
        email: 'user1@gmail.com',
        name: 'Google User 1',
        enabledApps: { calendar: true, tasks: true, drive: false, contacts: true },
        connectedAt: Date.now(),
      },
      {
        id: 'user2@gmail.com',
        email: 'user2@gmail.com',
        name: 'Google User 2',
        enabledApps: { calendar: false, tasks: true, drive: true, contacts: false },
        connectedAt: Date.now(),
      },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            accounts: mockAccounts,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    render(<LinkedAccountsModal isOpen={true} onClose={vi.fn()} />);

    // Wait for accounts to appear
    await waitFor(() => {
      expect(screen.getByText('Google User 1')).toBeInTheDocument();
      expect(screen.getByText('Google User 2')).toBeInTheDocument();
    });

    // Reconnect and Remove buttons
    const reconnectButtons = screen.getAllByTitle('settings.account.linked_accounts.reconnect');
    expect(reconnectButtons).toHaveLength(2);

    const removeButtons = screen.getAllByTitle('settings.account.linked_accounts.remove');
    expect(removeButtons).toHaveLength(2);

    // Verify all 4 apps are rendered for each account
    expect(screen.getAllByText('settings.account.linked_accounts.apps.calendar')).toHaveLength(2);
    expect(screen.getAllByText('settings.account.linked_accounts.apps.tasks')).toHaveLength(2);
    expect(screen.getAllByText('settings.account.linked_accounts.apps.drive')).toHaveLength(2);
    expect(screen.getAllByText('settings.account.linked_accounts.apps.contacts')).toHaveLength(2);
  });

  it('toggling an app sends POST to /api/auth/google/toggle-app', async () => {
    const mockAccounts = [
      {
        id: 'user1@gmail.com',
        email: 'user1@gmail.com',
        name: 'Google User 1',
        enabledApps: { calendar: true, tasks: true, drive: true, contacts: true },
        connectedAt: Date.now(),
      },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            accounts: mockAccounts,
          }),
        } as Response;
      }
      if (typeof url === 'string' && url.includes('/api/auth/google/toggle-app')) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    render(<LinkedAccountsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Google User 1')).toBeInTheDocument();
    });

    const driveToggle = screen.getByLabelText(
      'settings.account.linked_accounts.apps.drive for user1@gmail.com'
    );
    expect(driveToggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(driveToggle);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/google/toggle-app',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          accountId: 'user1@gmail.com',
          settings: { drive: false },
          app: 'drive',
          enabled: false,
        }),
      })
    );
  });

  it('scopes status and toggle requests to specific comailAccount when provided', async () => {
    const mockAccounts = [
      {
        id: 'user1@gmail.com_alice@example.com@mail.example.com',
        email: 'user1@gmail.com',
        name: 'Google User 1',
        enabledApps: { calendar: true, tasks: true, drive: true, contacts: true },
        connectedAt: Date.now(),
        comailAccountId: ACCOUNT_1.id,
        comailAccountEmail: ACCOUNT_1.email,
      },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            accounts: mockAccounts,
          }),
        } as Response;
      }
      if (typeof url === 'string' && url.includes('/api/auth/google/toggle-app')) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    render(<LinkedAccountsModal isOpen={true} onClose={vi.fn()} comailAccount={ACCOUNT_1 as never} />);

    await waitFor(() => {
      expect(screen.getByText('Google User 1')).toBeInTheDocument();
    });

    // Check that status was called with query params & headers
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`comailAccountId=${encodeURIComponent(ACCOUNT_1.id)}`),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-comail-account-id': ACCOUNT_1.id,
          'x-comail-account-email': ACCOUNT_1.email,
        }),
      })
    );

    const driveToggle = screen.getByLabelText(
      'settings.account.linked_accounts.apps.drive for user1@gmail.com'
    );
    fireEvent.click(driveToggle);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/google/toggle-app',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-comail-account-id': ACCOUNT_1.id,
          'x-comail-account-email': ACCOUNT_1.email,
        }),
        body: JSON.stringify({
          accountId: 'user1@gmail.com_alice@example.com@mail.example.com',
          settings: { drive: false },
          app: 'drive',
          enabled: false,
          comailAccountId: ACCOUNT_1.id,
          comailAccountEmail: ACCOUNT_1.email,
        }),
      })
    );
  });

  it('clicking Remove opens ConfirmDialog, and clicking Cancel does not close the parent modal', async () => {
    const mockAccounts = [
      {
        id: 'user1@gmail.com',
        email: 'user1@gmail.com',
        name: 'Google User 1',
        enabledApps: { calendar: true, tasks: true, drive: true, contacts: true },
        connectedAt: Date.now(),
      },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            accounts: mockAccounts,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    const onClose = vi.fn();
    render(<LinkedAccountsModal isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Google User 1')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('settings.account.linked_accounts.remove');
    fireEvent.click(removeBtn);

    // Confirm dialog should be open
    expect(screen.getByText('settings.account.linked_accounts.remove_confirm_title')).toBeInTheDocument();

    // Mousedown inside confirm dialog or clicking cancel should NOT trigger onClose of parent modal
    const cancelBtn = screen.getByText('confirm_dialog.cancel');
    fireEvent.mouseDown(cancelBtn);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(cancelBtn);
    expect(onClose).not.toHaveBeenCalled();

    // Confirm dialog should now be closed, but modal should remain open with account visible
    expect(screen.queryByText('settings.account.linked_accounts.remove_confirm_title')).not.toBeInTheDocument();
    expect(screen.getByText('Google User 1')).toBeInTheDocument();
  });

  it('clicking Remove in ConfirmDialog disconnects account and keeps LinkedAccountsModal open', async () => {
    const mockAccounts = [
      {
        id: 'user1@gmail.com',
        email: 'user1@gmail.com',
        name: 'Google User 1',
        enabledApps: { calendar: true, tasks: true, drive: true, contacts: true },
        connectedAt: Date.now(),
      },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            accounts: mockAccounts,
          }),
        } as Response;
      }
      if (typeof url === 'string' && url.includes('/api/auth/google/disconnect')) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    const onClose = vi.fn();
    render(<LinkedAccountsModal isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Google User 1')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('settings.account.linked_accounts.remove');
    fireEvent.click(removeBtn);

    expect(screen.getByText('settings.account.linked_accounts.remove_confirm_title')).toBeInTheDocument();

    // In confirm dialog, find the confirm button (which has text 'settings.account.linked_accounts.remove')
    const confirmButtons = screen.getAllByRole('button', { name: 'settings.account.linked_accounts.remove' });
    const confirmRemoveButton = confirmButtons[confirmButtons.length - 1];

    fireEvent.mouseDown(confirmRemoveButton);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(confirmRemoveButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/auth/google/disconnect',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            accountId: 'user1@gmail.com',
            email: 'user1@gmail.com',
          }),
        })
      );
    });

    // Parent modal was not dismissed
    expect(onClose).not.toHaveBeenCalled();

    // Account list now empty state
    await waitFor(() => {
      expect(screen.getByText('settings.account.linked_accounts.empty_title')).toBeInTheDocument();
    });
  });
});
