import { describe, it, expect } from 'vitest';
import { getHubForTab, type SettingsHubId } from '../settings-app';
import enTranslations from '@/locales/en/common.json';

describe('Settings Hubs Architecture', () => {
  it('correctly maps tabs to their parent hubs', () => {
    // Mail Hub
    expect(getHubForTab('reading')).toBe('mail');
    expect(getHubForTab('composing')).toBe('mail');
    expect(getHubForTab('identities')).toBe('mail');
    expect(getHubForTab('vacation')).toBe('mail');
    expect(getHubForTab('downloads')).toBe('mail');

    // Account Hub
    expect(getHubForTab('account')).toBe('account');
    expect(getHubForTab('security')).toBe('account');
    expect(getHubForTab('byomc')).toBe('account');
    expect(getHubForTab('language')).toBe('account');

    // Appearance Hub
    expect(getHubForTab('appearance')).toBe('appearance');
    expect(getHubForTab('layout')).toBe('appearance');
    expect(getHubForTab('themes')).toBe('appearance');

    // Organization Hub
    expect(getHubForTab('keywords')).toBe('organization');
    expect(getHubForTab('folders')).toBe('organization');
    expect(getHubForTab('filters')).toBe('organization');
    expect(getHubForTab('templates')).toBe('organization');

    // Apps Hub
    expect(getHubForTab('calendar')).toBe('apps');
    expect(getHubForTab('contacts')).toBe('apps');
    expect(getHubForTab('files')).toBe('apps');
    expect(getHubForTab('sidebar_apps')).toBe('apps');
    expect(getHubForTab('plugin:smime-keys')).toBe('apps');

    // Notifications Hub
    expect(getHubForTab('notifications')).toBe('notifications');

    // Advanced Hub
    expect(getHubForTab('about_data')).toBe('advanced');
    expect(getHubForTab('content_senders')).toBe('advanced');
    expect(getHubForTab('protocol_handlers')).toBe('advanced');
    expect(getHubForTab('plugins')).toBe('advanced');
    expect(getHubForTab('debug')).toBe('advanced');
  });

  it('falls back safely to appearance hub for unknown tabs', () => {
    // @ts-expect-error testing invalid tab fallback
    expect(getHubForTab('unknown-tab-id')).toBe('appearance');
  });

  it('contains translations for all 7 hubs in common.json', () => {
    const hubs = enTranslations.settings.hubs;
    const requiredHubs: SettingsHubId[] = [
      'account',
      'appearance',
      'mail',
      'organization',
      'apps',
      'notifications',
      'advanced',
    ];

    for (const hub of requiredHubs) {
      expect(hubs).toHaveProperty(hub);
      expect(hubs).toHaveProperty(`${hub}_subtitle`);
      expect(typeof hubs[hub as keyof typeof hubs]).toBe('string');
      expect((hubs[hub as keyof typeof hubs] as string).length).toBeGreaterThan(0);
    }
  });

  it('contains Comail Build promotional copy in common.json', () => {
    const build = enTranslations.settings.comail_build;
    expect(build.title).toBe('Comail Build');
    expect(build.button).toBe('Open build.comail.at');
    expect(build.banner_title).toBeTruthy();
    expect(build.banner_description).toBeTruthy();
  });
});
