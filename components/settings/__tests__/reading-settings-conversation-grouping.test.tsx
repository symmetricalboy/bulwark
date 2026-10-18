import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingSettings } from '../reading-settings';
import { ThreadListItem } from '@/components/email/thread-list-item';
import { useEmailStore } from '@/stores/email-store';
import { useUIStore } from '@/stores/ui-store';
import { groupEmailsByThread } from '@/lib/thread-utils';
import type { Email } from '@/lib/jmap/types';

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const translations: Record<string, string> = {
      'settings.email_behavior.title': 'Reading Settings',
      'settings.email_behavior.description': 'Configure how emails are displayed and read',
    };
    return translations[fullKey] || key;
  },
  useLocale: () => 'en',
}));

vi.mock('@/hooks/use-email-drag', () => ({
  useEmailDrag: () => ({ dragHandlers: {}, isDragging: false }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ identities: [], username: null }),
}));

vi.mock('@/stores/account-store', () => {
  const accountState = {
    getActiveAccount: () => undefined,
    getAccountById: () => undefined,
  };
  return {
    useAccountStore: Object.assign(
      (selector?: (s: typeof accountState) => unknown) => (selector ? selector(accountState) : accountState),
      { getState: () => accountState }
    ),
  };
});

const makeEmail = (overrides: Partial<Email> = {}): Email => ({
  id: 'email-1',
  threadId: 'thread-1',
  mailboxIds: { inbox: true },
  keywords: { $seen: true },
  size: 1000,
  receivedAt: '2024-01-15T10:00:00Z',
  from: [{ name: 'Alice', email: 'alice@example.com' }],
  subject: 'Test Subject',
  hasAttachment: false,
  ...overrides,
});

describe('Combined Conversation View Default', () => {
  beforeEach(() => {
    useEmailStore.setState({
      selectedEmailKeys: new Set<string>(),
      selectedMailbox: 'inbox',
      emails: [],
    });
    useUIStore.setState({ isMobile: false, isTablet: false, isDesktop: true });
  });

  it('does not render Separate or Nested conversation grouping options in ReadingSettings', () => {
    render(<ReadingSettings />);

    expect(screen.queryByRole('button', { name: 'Separate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nested' })).not.toBeInTheDocument();
    expect(screen.queryByText('Conversation Grouping')).not.toBeInTheDocument();
  });

  it('renders ThreadListItem in combined mode without inline expand toggles and selects the latest email on click', () => {
    const e1 = makeEmail({ id: 'e1', threadId: 't1', receivedAt: '2024-01-15T10:00:00Z' });
    const e2 = makeEmail({ id: 'e2', threadId: 't1', receivedAt: '2024-01-15T11:00:00Z' });
    useEmailStore.setState({ emails: [e1, e2] });
    const [thread] = groupEmailsByThread([e1, e2]);

    const onOpenConversation = vi.fn();
    const onEmailSelect = vi.fn();

    const { container } = render(
      <ThreadListItem
        thread={thread}
        onOpenConversation={onOpenConversation}
        onEmailSelect={onEmailSelect}
      />
    );

    expect(container.querySelector('[data-expand-toggle]')).toBeNull();

    fireEvent.click(screen.getByText('Test Subject'));

    expect(onEmailSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }));
  });
});
