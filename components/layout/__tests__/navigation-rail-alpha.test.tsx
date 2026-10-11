import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationRail } from '../navigation-rail';

const membership = vi.hoisted(() => ({ enrolled: false }));
vi.mock('@/hooks/use-builders-membership', () => ({ useBuildersMembership: () => membership.enrolled }));

vi.mock('@/hooks/use-config', () => ({
  useConfig: () => ({
    appLogoLightUrl: '/branding/comail/cammie-mark.png',
    appLogoDarkUrl: '/branding/comail/cammie-mark.png',
    calendarEnabled: false,
    contactsEnabled: false,
    filesEnabled: false,
    appsEnabled: false,
    buildersEnabled: false,
  }),
}));
vi.mock('@/stores/update-store', () => ({
  selectHasUpdate: () => false,
  useUpdateStore: (selector: (state: unknown) => unknown) => selector({
    status: null,
    startPolling: () => {},
    stopPolling: () => {},
  }),
}));
vi.mock('../account-switcher', () => ({ AccountSwitcher: () => null }));
vi.mock('@/components/keyboard-shortcuts-modal', () => ({ KeyboardShortcutsModal: () => null }));
vi.mock('@/components/plugins/plugin-slot', () => ({ PluginSlot: () => null }));

describe('NavigationRail ALPHA badge and refresh action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bright orange ALPHA badge just above the Comail avatar', () => {
    render(<NavigationRail />);

    const badge = screen.getByTestId('comail-alpha-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('ALPHA');
    expect(badge).toHaveClass('bg-orange-500');

    const avatarButton = screen.getByTestId('comail-avatar-button');
    expect(avatarButton).toBeInTheDocument();

    // Verify DOM structure: badge precedes the avatar button in the container
    expect(badge.compareDocumentPosition(avatarButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('triggers window.location.reload when Comail avatar is clicked', () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    try {
      render(<NavigationRail />);

      const avatarButton = screen.getByTestId('comail-avatar-button');
      fireEvent.click(avatarButton);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });
});
