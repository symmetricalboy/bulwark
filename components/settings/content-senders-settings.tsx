"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsSection, SettingItem, Select, ToggleSwitch } from './settings-section';
import { TrustedSendersModal } from '@/components/trusted-senders-modal';
import { ChevronRight } from '@/components/icons';
import { usePolicyStore } from '@/stores/policy-store';
import { useContactStore } from '@/stores/contact-store';
import { useAuthStore } from '@/stores/auth-store';

export function ContentSendersSettings() {
  const t = useTranslations('settings.email_behavior');
  const [showTrustedModal, setShowTrustedModal] = useState(false);
  const { isSettingLocked, isSettingHidden, isFeatureEnabled } = usePolicyStore();

  const {
    externalContentPolicy,
    emailAlwaysLightMode,
    trustedSenders,
    trustedSendersAddressBook,
    trackerBlockerEnabled,
    updateSetting,
  } = useSettingsStore();
  const { trustedSenderEmails, trustedSendersLoaded, loadTrustedSendersBook } = useContactStore();
  const client = useAuthStore((state) => state.client);

  // Load the address book so the count reflects the synced senders, not 0.
  useEffect(() => {
    if (trustedSendersAddressBook && client && !trustedSendersLoaded) {
      loadTrustedSendersBook(client);
    }
  }, [trustedSendersAddressBook, client, trustedSendersLoaded, loadTrustedSendersBook]);

  const getTrustedSendersCount = () => {
    const count = trustedSendersAddressBook ? trustedSenderEmails.length : trustedSenders.length;
    if (count === 0) return t('trusted_senders.count_zero');
    if (count === 1) return t('trusted_senders.count_one');
    return t('trusted_senders.count_other', { count });
  };

  return (
    <div className="space-y-8">
      <SettingsSection title={t('groups.images_tracking')} description={t('groups.images_tracking_desc')}>
        {isFeatureEnabled('externalContentEnabled') && !isSettingHidden('externalContentPolicy') && (
        <SettingItem label={t('external_content.label')} description={t('external_content.description')} locked={isSettingLocked('externalContentPolicy')}>
          <Select
            value={externalContentPolicy}
            onChange={(value) =>
              updateSetting('externalContentPolicy', value as 'ask' | 'block' | 'allow')
            }
            options={[
              { value: 'ask', label: t('external_content.ask') },
              { value: 'block', label: t('external_content.block') },
              { value: 'allow', label: t('external_content.allow') },
            ]}
          />
        </SettingItem>
        )}

        <SettingItem label={t('tracker_blocker.label')} description={t('tracker_blocker.description')}>
          <ToggleSwitch
            checked={trackerBlockerEnabled}
            onChange={(checked) => updateSetting('trackerBlockerEnabled', checked)}
          />
        </SettingItem>

        <SettingItem label={t('always_light_mode.label')} description={t('always_light_mode.description')}>
          <ToggleSwitch
            checked={emailAlwaysLightMode}
            onChange={(checked) => updateSetting('emailAlwaysLightMode', checked)}
          />
        </SettingItem>
      </SettingsSection>

      <SettingsSection title={t('groups.trusted')} description={t('groups.trusted_desc')}>
        <SettingItem label={t('trusted_senders.label')} description={t('trusted_senders.description')}>
          <button
            type="button"
            onClick={() => setShowTrustedModal(true)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted shadow-2xs transition-colors"
          >
            <span className="text-sm text-foreground">{getTrustedSendersCount()}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
          </button>
        </SettingItem>

        <SettingItem label={t('trusted_senders.use_address_book_label')} description={t('trusted_senders.use_address_book_description')}>
          <ToggleSwitch
            checked={!!trustedSendersAddressBook}
            onChange={(checked) => updateSetting('trustedSendersAddressBook', checked)}
          />
        </SettingItem>
      </SettingsSection>

      <TrustedSendersModal
        isOpen={showTrustedModal}
        onClose={() => setShowTrustedModal(false)}
      />
    </div>
  );
}
