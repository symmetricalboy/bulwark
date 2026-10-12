import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const membership = vi.hoisted(() => ({ enrolled: false }));
vi.mock('@/hooks/use-builders-membership', () => ({ useBuildersMembership: () => membership.enrolled }));

const configMock = vi.hoisted(() => ({
  calendarEnabled: true,
  contactsEnabled: true,
  filesEnabled: true,
  appsEnabled: true,
  appLogoLightUrl: '/branding/comail/cammie-mark.png',
  appLogoDarkUrl: '/branding/comail/cammie-mark.png',
}));
vi.mock('@/hooks/use-config', () => ({
  useConfig: () => configMock,
}));

vi.mock('@/stores/update-store', () => ({
  selectHasUpdate: () => false,
  useUpdateStore: (selector: (state: unknown) => unknown) => selector({
    status: null,
    startPolling: () => {},
    stopPolling: () => {},
  }),
}));

const mockPolicyState = vi.hoisted(() => ({
  policy: { defaultSidebarApps: [] },
  isFeatureEnabled: vi.fn((_feature: string) => true),
}));
vi.mock('@/stores/policy-store', () => ({
  usePolicyStore: Object.assign(
    (selector?: (state: typeof mockPolicyState) => unknown) =>
      typeof selector === 'function' ? selector(mockPolicyState) : mockPolicyState,
    { getState: () => mockPolicyState }
  ),
}));

const mockAuthState = vi.hoisted(() => ({
  client: null as { supportsContacts?: () => boolean; supportsFiles?: () => boolean; supportsCalendars?: () => boolean } | null,
  activeAccountId: 'acc-1',
  logout: vi.fn(),
  logoutAll: vi.fn(),
  switchAccount: vi.fn(),
}));
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector?: (state: typeof mockAuthState) => unknown) =>
      typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
    { getState: () => mockAuthState }
  ),
}));

const mockCalendarState = vi.hoisted(() => ({
  supportsCalendar: false,
}));
vi.mock('@/stores/calendar-store', () => ({
  useCalendarStore: Object.assign(
    (selector?: (state: typeof mockCalendarState) => unknown) =>
      typeof selector === 'function' ? selector(mockCalendarState) : mockCalendarState,
    { getState: () => mockCalendarState }
  ),
}));

vi.mock('../account-switcher', () => ({ AccountSwitcher: () => null }));
vi.mock('@/components/keyboard-shortcuts-modal', () => ({ KeyboardShortcutsModal: () => null }));
vi.mock('@/components/plugins/plugin-slot', () => ({ PluginSlot: () => null }));

import { NavigationRail } from '../navigation-rail';

describe('NavigationRail app visibility during load and capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.calendarEnabled = true;
    configMock.contactsEnabled = true;
    configMock.filesEnabled = true;
    mockPolicyState.policy = { defaultSidebarApps: [] };
    mockPolicyState.isFeatureEnabled.mockReturnValue(true);
    mockAuthState.client = null;
    mockCalendarState.supportsCalendar = false;
  });

  it('renders all enabled apps on cold load / refresh when client is not yet connected', () => {
    render(<NavigationRail collapsed={false} />);

    expect(screen.getByText('mail')).toBeInTheDocument();
    expect(screen.getByText('contacts')).toBeInTheDocument();
    expect(screen.getByText('calendar')).toBeInTheDocument();
    expect(screen.getByText('tasks')).toBeInTheDocument();
    expect(screen.getByText('files')).toBeInTheDocument();
  });

  it('hides contacts when connected client explicitly does not support contacts', () => {
    mockAuthState.client = {
      supportsContacts: () => false,
      supportsFiles: () => true,
      supportsCalendars: () => true,
    };
    mockCalendarState.supportsCalendar = true;

    render(<NavigationRail collapsed={false} />);

    expect(screen.getByText('mail')).toBeInTheDocument();
    expect(screen.queryByText('contacts')).not.toBeInTheDocument();
    expect(screen.getByText('calendar')).toBeInTheDocument();
    expect(screen.getByText('tasks')).toBeInTheDocument();
    expect(screen.getByText('files')).toBeInTheDocument();
  });

  it('hides calendar when calendar feature is disabled by policy even if client is not connected', () => {
    mockPolicyState.isFeatureEnabled.mockImplementation((feat: string) => feat !== 'calendarEnabled');

    render(<NavigationRail collapsed={false} />);

    expect(screen.getByText('mail')).toBeInTheDocument();
    expect(screen.getByText('contacts')).toBeInTheDocument();
    expect(screen.queryByText('calendar')).not.toBeInTheDocument();
    expect(screen.getByText('tasks')).toBeInTheDocument();
    expect(screen.getByText('files')).toBeInTheDocument();
  });
});
