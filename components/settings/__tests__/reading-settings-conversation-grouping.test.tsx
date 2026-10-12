import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingSettings } from '../reading-settings';
import { ThreadListItem } from '@/components/email/thread-list-item';
import { useSettingsStore } from '@/stores/settings-store';
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
      'settings.email_behavior.conversation_grouping.label': 'Conversation Grouping',
      'settings.email_behavior.conversation_grouping.description': 'Control how message threads are displayed in your inbox',
      'settings.email_behavior.conversation_grouping.separate': 'Separate',
      'settings.email_behavior.conversation_grouping.separate_desc': 'Show individual emails separately without threading',
      'settings.email_behavior.conversation_grouping.nested': 'Nested',
      'settings.email_behavior.conversation_grouping.nested_desc': 'Show collapsible thread hierarchies in the message list',
      'settings.email_behavior.conversation_grouping.combined': 'Combined',
      'settings.email_behavior.conversation_grouping.combined_desc': 'Single conversation entry in the list, opens as a scrolling flow of messages',
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

describe('Conversation Grouping Settings and Integration', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      conversationGrouping: 'nested',
      disableThreading: false,
    });
    useEmailStore.setState({
      selectedEmailKeys: new Set<string>(),
      selectedMailbox: 'inbox',
      emails: [],
    });
    useUIStore.setState({ isMobile: false, isTablet: false, isDesktop: true });
  });

  describe('Settings Store State Synchronization', () => {
    it('synchronizes conversationGrouping to separate when disableThreading is set to true', () => {
      useSettingsStore.getState().updateSetting('disableThreading', true);
      expect(useSettingsStore.getState().conversationGrouping).toBe('separate');
      expect(useSettingsStore.getState().disableThreading).toBe(true);
    });

    it('synchronizes conversationGrouping to nested when disableThreading is toggled back to false', () => {
      useSettingsStore.getState().updateSetting('disableThreading', true);
      useSettingsStore.getState().updateSetting('disableThreading', false);
      expect(useSettingsStore.getState().conversationGrouping).toBe('nested');
      expect(useSettingsStore.getState().disableThreading).toBe(false);
    });

    it('sets disableThreading true when conversationGrouping is separate', () => {
      useSettingsStore.getState().updateSetting('conversationGrouping', 'separate');
      expect(useSettingsStore.getState().conversationGrouping).toBe('separate');
      expect(useSettingsStore.getState().disableThreading).toBe(true);
    });

    it('sets disableThreading false when conversationGrouping is combined', () => {
      useSettingsStore.getState().updateSetting('conversationGrouping', 'separate');
      expect(useSettingsStore.getState().disableThreading).toBe(true);

      useSettingsStore.getState().updateSetting('conversationGrouping', 'combined');
      expect(useSettingsStore.getState().conversationGrouping).toBe('combined');
      expect(useSettingsStore.getState().disableThreading).toBe(false);
    });

    it('sets disableThreading false when conversationGrouping is nested', () => {
      useSettingsStore.getState().updateSetting('conversationGrouping', 'separate');
      useSettingsStore.getState().updateSetting('conversationGrouping', 'nested');
      expect(useSettingsStore.getState().conversationGrouping).toBe('nested');
      expect(useSettingsStore.getState().disableThreading).toBe(false);
    });
  });

  describe('ReadingSettings UI', () => {
    it('renders 3 options: Separate, Nested, Combined with appropriate descriptions', () => {
      render(<ReadingSettings />);

      const separateBtn = screen.getByRole('button', { name: 'Separate' });
      const nestedBtn = screen.getByRole('button', { name: 'Nested' });
      const combinedBtn = screen.getByRole('button', { name: 'Combined' });

      expect(separateBtn).toBeInTheDocument();
      expect(nestedBtn).toBeInTheDocument();
      expect(combinedBtn).toBeInTheDocument();

      // Nested is active initially
      expect(nestedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(separateBtn).toHaveAttribute('aria-pressed', 'false');
      expect(combinedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Show collapsible thread hierarchies in the message list')).toBeInTheDocument();

      // Click Separate
      fireEvent.click(separateBtn);
      expect(useSettingsStore.getState().conversationGrouping).toBe('separate');
      expect(useSettingsStore.getState().disableThreading).toBe(true);

      // Click Combined
      fireEvent.click(combinedBtn);
      expect(useSettingsStore.getState().conversationGrouping).toBe('combined');
      expect(useSettingsStore.getState().disableThreading).toBe(false);
    });
  });

  describe('ThreadListItem in Combined vs Nested mode', () => {
    it('hides expand toggle and selects email on row click in combined mode', () => {
      useSettingsStore.setState({ conversationGrouping: 'combined' });

      const e1 = makeEmail({ id: 'e1', threadId: 't1', receivedAt: '2024-01-15T10:00:00Z' });
      const e2 = makeEmail({ id: 'e2', threadId: 't1', receivedAt: '2024-01-15T11:00:00Z' });
      useEmailStore.setState({ emails: [e1, e2] });
      const [thread] = groupEmailsByThread([e1, e2]);

      const onToggleExpand = vi.fn();
      const onOpenConversation = vi.fn();
      const onEmailSelect = vi.fn();

      const { container } = render(
        <ThreadListItem
          thread={thread}
          isExpanded={false}
          onToggleExpand={onToggleExpand}
          onOpenConversation={onOpenConversation}
          onEmailSelect={onEmailSelect}
        />
      );

      // In combined mode, chevron toggle button is hidden
      expect(container.querySelector('[data-expand-toggle="true"]')).toBeNull();

      // Clicking email row triggers onEmailSelect with latest email to open conversation in viewer
      fireEvent.click(screen.getByText('Test Subject'));

      expect(onEmailSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }));
    });

    it('shows expand toggle and handles expansion in nested mode', () => {
      useSettingsStore.setState({ conversationGrouping: 'nested' });

      const e1 = makeEmail({ id: 'e1', threadId: 't1', receivedAt: '2024-01-15T10:00:00Z' });
      const e2 = makeEmail({ id: 'e2', threadId: 't1', receivedAt: '2024-01-15T11:00:00Z' });
      useEmailStore.setState({ emails: [e1, e2] });
      const [thread] = groupEmailsByThread([e1, e2]);

      const onToggleExpand = vi.fn();
      const onOpenConversation = vi.fn();
      const onEmailSelect = vi.fn();

      const { container } = render(
        <ThreadListItem
          thread={thread}
          isExpanded={false}
          onToggleExpand={onToggleExpand}
          onOpenConversation={onOpenConversation}
          onEmailSelect={onEmailSelect}
        />
      );

      const expandToggle = container.querySelector('[data-expand-toggle="true"]');
      expect(expandToggle).not.toBeNull();

      fireEvent.click(expandToggle!);
      expect(onToggleExpand).toHaveBeenCalled();
    });
  });
});
