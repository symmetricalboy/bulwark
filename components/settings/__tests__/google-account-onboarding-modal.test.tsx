import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAccountOnboardingModal } from '../google-account-onboarding-modal';

let mockSearchParams = new URLSearchParams('google_connected=true&google_account_id=google_user_1&google_account_email=newuser@gmail.com');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => '/mail',
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${namespace ? namespace + '.' : ''}${key}(${JSON.stringify(params)})`;
    return `${namespace ? namespace + '.' : ''}${key}`;
  },
}));

describe('GoogleAccountOnboardingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState(
      {},
      '',
      '/mail?google_connected=true&google_account_id=google_user_1&google_account_email=newuser@gmail.com'
    );
  });

  it('renders modal with strictly-opt-in disabled defaults and in correct service order', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            connected: true,
            accounts: [
              {
                id: 'google_user_1',
                email: 'newuser@gmail.com',
                name: 'New Google User',
                enabledApps: {
                  gmail: false,
                  drive: false,
                  calendar: 'none',
                  tasks: 'none',
                  contacts: 'none',
                },
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    render(<GoogleAccountOnboardingModal />);

    // Shows onboarding title & account email
    expect(await screen.findByText('newuser@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('settings.account.linked_accounts.onboarding.title')).toBeInTheDocument();

    // Verify exact service order: Gmail, Drive, Calendar, Tasks, Contacts
    const serviceTitles = [
      screen.getByText('settings.account.linked_accounts.apps.gmail'),
      screen.getByText('settings.account.linked_accounts.apps.drive'),
      screen.getByText('settings.account.linked_accounts.apps.calendar'),
      screen.getByText('settings.account.linked_accounts.apps.tasks'),
      screen.getByText('settings.account.linked_accounts.apps.contacts'),
    ];

    for (let i = 0; i < serviceTitles.length - 1; i++) {
      expect(
        serviceTitles[i].compareDocumentPosition(serviceTitles[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }

    // Gmail & Drive default to unchecked (false)
    const gmailToggle = screen.getByLabelText('settings.account.linked_accounts.apps.gmail for newuser@gmail.com');
    const driveToggle = screen.getByLabelText('settings.account.linked_accounts.apps.drive for newuser@gmail.com');
    expect(gmailToggle).toHaveAttribute('aria-checked', 'false');
    expect(driveToggle).toHaveAttribute('aria-checked', 'false');

    // Calendar, Tasks, Contacts default to 'none' ("Don't Use")
    const calendarGroup = screen.getByRole('radiogroup', { name: /calendar/i });
    const tasksGroup = screen.getByRole('radiogroup', { name: /tasks/i });
    const contactsGroup = screen.getByRole('radiogroup', { name: /contacts/i });

    const calendarDontUse = within(calendarGroup).getByRole('radio', { name: /mode\.dont_use/i });
    const tasksDontUse = within(tasksGroup).getByRole('radio', { name: /mode\.dont_use/i });
    const contactsDontUse = within(contactsGroup).getByRole('radio', { name: /mode\.dont_use/i });

    expect(calendarDontUse).toHaveAttribute('aria-checked', 'true');
    expect(tasksDontUse).toHaveAttribute('aria-checked', 'true');
    expect(contactsDontUse).toHaveAttribute('aria-checked', 'true');

    // 3 options exist for Calendar, Tasks, Contacts
    expect(within(contactsGroup).getByRole('radio', { name: /mode\.show_separately/i })).toBeInTheDocument();
    expect(within(contactsGroup).getByRole('radio', { name: /mode\.synchronize/i })).toBeInTheDocument();
  });

  it('allows user to customize opt-in services and save preferences', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/google/status')) {
        return {
          ok: true,
          json: async () => ({
            connected: true,
            accounts: [
              {
                id: 'google_user_1',
                email: 'newuser@gmail.com',
                name: 'New Google User',
                enabledApps: {
                  gmail: false,
                  drive: false,
                  calendar: 'none',
                  tasks: 'none',
                  contacts: 'none',
                },
              },
            ],
          }),
        } as Response;
      }
      if (typeof url === 'string' && url.includes('/api/auth/google/toggle-app')) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<GoogleAccountOnboardingModal />);

    await waitFor(() => {
      expect(screen.getByText('newuser@gmail.com')).toBeInTheDocument();
    });

    // Toggle Gmail ON
    const gmailToggle = screen.getByLabelText('settings.account.linked_accounts.apps.gmail for newuser@gmail.com');
    fireEvent.click(gmailToggle);
    expect(gmailToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle Contacts to Synchronize
    const contactsGroup = screen.getByRole('radiogroup', { name: /contacts/i });
    const contactsSync = within(contactsGroup).getByRole('radio', { name: /mode\.synchronize/i });
    fireEvent.click(contactsSync);
    expect(contactsSync).toHaveAttribute('aria-checked', 'true');

    // Toggle Tasks to Show Separately
    const tasksGroup = screen.getByRole('radiogroup', { name: /tasks/i });
    const tasksSeparate = within(tasksGroup).getByRole('radio', { name: /mode\.show_separately/i });
    fireEvent.click(tasksSeparate);
    expect(tasksSeparate).toHaveAttribute('aria-checked', 'true');

    // Click Save and Continue
    const saveBtn = screen.getByRole('button', {
      name: /onboarding\.save_and_continue/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/auth/google/toggle-app',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            accountId: 'google_user_1',
            settings: {
              gmail: true,
              drive: false,
              calendar: 'none',
              tasks: 'separate',
              contacts: 'sync',
            },
          }),
        })
      );
    });

    // Check window event was dispatched
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'google-services-updated',
        detail: {
          accountId: 'google_user_1',
          settings: {
            gmail: true,
            drive: false,
            calendar: 'none',
            tasks: 'separate',
            contacts: 'sync',
          },
        },
      })
    );
  });
});
