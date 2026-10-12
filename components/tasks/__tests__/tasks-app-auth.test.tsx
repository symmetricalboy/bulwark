import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkAuthMock = vi.fn().mockResolvedValue(undefined);
const mockAuthState = vi.hoisted(() => ({
  isAuthenticated: false,
  client: null as Record<string, unknown> | null,
  activeAccountId: null as string | null,
  logout: vi.fn(),
  checkAuth: vi.fn(),
  isLoading: false,
}));
mockAuthState.checkAuth = checkAuthMock;

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector?: (state: typeof mockAuthState) => unknown) =>
      typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
    { getState: () => mockAuthState }
  ),
  redirectToLogin: vi.fn(),
  saveRedirectAfterLogin: vi.fn(),
}));

const mockAccountState = vi.hoisted(() => ({
  activeAccountId: null,
  getActiveAccount: () => null,
  getAccountById: () => undefined,
  accounts: [],
}));

vi.mock('@/stores/account-store', () => ({
  useAccountStore: Object.assign(
    (selector?: (state: typeof mockAccountState) => unknown) =>
      typeof selector === 'function' ? selector(mockAccountState) : mockAccountState,
    { getState: () => mockAccountState }
  ),
}));

vi.mock('@/stores/tasks-app-store', () => ({
  useTasksAppStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        lists: [{ id: 'default', title: 'My Tasks' }],
        activeListId: 'default',
        tasks: [],
        selectedTaskId: null,
        filter: 'all',
        sortBy: 'myOrder',
        isSyncing: false,
        connectedGoogleAccounts: [],
        isGoogleConnected: false,
        initialize: vi.fn().mockResolvedValue(undefined),
        setActiveListId: vi.fn(),
        setSelectedTaskId: vi.fn(),
        setSortBy: vi.fn(),
        createTask: vi.fn(),
        clearCompleted: vi.fn(),
        syncGoogle: vi.fn(),
      };
      return typeof selector === 'function' ? selector(state) : state;
    },
    { getState: () => ({ initialize: vi.fn() }) }
  ),
}));

vi.mock('@/stores/email-store', () => ({
  useEmailStore: () => ({
    quota: null,
    isPushConnected: false,
  }),
}));

vi.mock('@/hooks/use-sidebar-apps', () => ({
  useSidebarApps: () => ({
    showAppsModal: false,
    inlineApp: null,
    loadedApps: [],
    handleManageApps: vi.fn(),
    handleInlineApp: vi.fn(),
    closeInlineApp: vi.fn(),
    closeAppsModal: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-media-query', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/use-is-embedded', () => ({
  useIsEmbedded: () => false,
}));

vi.mock('@/hooks/use-document-title', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/layout/navigation-rail', () => ({
  NavigationRail: () => <nav data-testid="navigation-rail" />,
}));

vi.mock('@/components/plugins/app-top-banner-slot', () => ({
  AppTopBannerSlot: () => null,
}));

import { TasksApp } from '../tasks-app';

describe('TasksApp auth lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = false;
    mockAuthState.client = null;
    mockAuthState.isLoading = false;
  });

  it('triggers checkAuth on mount when unauthenticated', () => {
    render(<TasksApp />);
    expect(checkAuthMock).toHaveBeenCalledTimes(1);
  });

  it('skips checkAuth on mount when already authenticated with client', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.client = {} as Record<string, unknown>;

    render(<TasksApp />);
    expect(checkAuthMock).not.toHaveBeenCalled();
  });
});
