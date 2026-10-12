"use client";

import { useTranslations } from 'next-intl';
import { useSettingsStore, type Density, type IconSet, type IconColorPalette } from '@/stores/settings-store';
import { SettingsSection, SettingItem, RadioGroup, ToggleSwitch } from './settings-section';
import { cn } from '@/lib/utils';
import { Star } from '@/components/icons';
import { usePolicyStore } from '@/stores/policy-store';
import { IS_LITE } from '@/lib/lite';
import { MessageListOrderSettings } from './message-list-order-settings';

const DENSITY_PREVIEW: Record<Density, { py: string; gap: string; showAvatar: boolean; showPreview: boolean }> = {
  'extra-compact': { py: 'py-1',   gap: 'gap-2',   showAvatar: false, showPreview: false },
  compact:         { py: 'py-1.5', gap: 'gap-2.5', showAvatar: true,  showPreview: false },
  regular:         { py: 'py-2.5', gap: 'gap-3',   showAvatar: true,  showPreview: true },
  comfortable:     { py: 'py-3.5', gap: 'gap-3.5', showAvatar: true,  showPreview: true },
};

function DensityPreview({ density }: { density: Density }) {
  const cfg = DENSITY_PREVIEW[density];
  const rows = [
    { unread: true,  starred: true,  initials: 'AJ', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', sender: 'Alice Johnson',  subject: 'Project update - Q1 roadmap', preview: 'Here are the latest numbers from the team sync…' },
    { unread: false, starred: false, initials: 'BS', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', sender: 'Bob Smith',       subject: 'Re: Meeting notes',           preview: 'Thanks, will review and get back to you shortly.' },
    { unread: true,  starred: false, initials: 'CL', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', sender: 'Carol Lee',       subject: 'Invoice #4092',               preview: 'Please find attached the monthly invoice for review…' },
  ];

  return (
    <div className="mt-3 rounded-xl border border-border/80 overflow-hidden bg-background text-xs select-none shadow-2xs">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center px-3 border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors",
            cfg.py,
            cfg.gap
          )}
        >
          {row.unread && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          )}
          {cfg.showAvatar && (
            <div className={cn(
              "flex-shrink-0 rounded-full flex items-center justify-center font-bold text-[10px]",
              row.color,
              density === 'comfortable' ? "w-8 h-8 text-xs" : "w-6 h-6"
            )}>
              {row.initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("truncate", row.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {row.sender}
              </span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">12:00</span>
            </div>
            <div className={cn("truncate", row.unread ? "font-medium text-foreground" : "text-foreground/80")}>
              {row.subject}
            </div>
            {cfg.showPreview && (
              <div className="truncate text-muted-foreground/70">{row.preview}</div>
            )}
          </div>
          {row.starred && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export function AppearanceSettings() {
  const t = useTranslations('settings.appearance');
  const tAdvanced = useTranslations('settings.advanced');
  const { fontSize, density, iconSet, iconColorPalette, animationsEnabled, senderFavicons, showAvatarsInJunk, updateSetting } = useSettingsStore();
  const { isSettingLocked, isSettingHidden } = usePolicyStore();

  return (
    <div className="space-y-6">
      {/* 1. Typography & Scale */}
      <SettingsSection
        title={t('section_typography')}
        description={t('section_typography_desc')}
      >
        {!isSettingHidden('fontSize') && (
          <SettingItem label={t('font_size.label')} description={t('font_size.description')} locked={isSettingLocked('fontSize')}>
            <RadioGroup
              value={fontSize}
              onChange={(value) => updateSetting('fontSize', value as 'small' | 'medium' | 'large')}
              options={[
                { value: 'small', label: t('font_size.small') },
                { value: 'medium', label: t('font_size.medium') },
                { value: 'large', label: t('font_size.large') },
              ]}
            />
          </SettingItem>
        )}
      </SettingsSection>

      {/* 2. Density & List Layout */}
      <SettingsSection
        title={t('section_density')}
        description={t('section_density_desc')}
      >
        {!isSettingHidden('density') && (
          <SettingItem label={t('list_density.label')} description={t('list_density.description')} locked={isSettingLocked('density')}>
            <RadioGroup
              value={density}
              onChange={(value) =>
                updateSetting('density', value as Density)
              }
              options={[
                { value: 'extra-compact', label: t('list_density.extra_compact') },
                { value: 'compact', label: t('list_density.compact') },
                { value: 'regular', label: t('list_density.regular') },
                { value: 'comfortable', label: t('list_density.comfortable') },
              ]}
            />
            <DensityPreview density={density} />
          </SettingItem>
        )}

        <MessageListOrderSettings />
      </SettingsSection>

      {/* 3. Theme, Icons & Motion */}
      <SettingsSection
        title={t('section_theme_icons')}
        description={t('section_theme_icons_desc')}
      >
        {!isSettingHidden('iconSet') && (
          <SettingItem label={t('icon_set.label')} description={t('icon_set.description')} locked={isSettingLocked('iconSet')}>
            <RadioGroup
              value={iconSet}
              onChange={(value) => updateSetting('iconSet', value as IconSet)}
              options={[
                { value: 'tabler', label: t('icon_set.tabler') },
                { value: 'material-symbols', label: t('icon_set.material_symbols') },
                { value: 'lucide', label: t('icon_set.lucide') },
              ]}
            />
          </SettingItem>
        )}

        {!isSettingHidden('iconColorPalette') && (
          <SettingItem label={t('icon_color_palette.label')} description={t('icon_color_palette.description')} locked={isSettingLocked('iconColorPalette')}>
            <RadioGroup
              value={iconColorPalette}
              onChange={(value) => updateSetting('iconColorPalette', value as IconColorPalette)}
              options={[
                { value: 'monochrome', label: t('icon_color_palette.monochrome') },
                { value: 'theme-accent', label: t('icon_color_palette.theme_accent') },
                { value: 'rainbow', label: t('icon_color_palette.rainbow') },
              ]}
            />
          </SettingItem>
        )}

        {!isSettingHidden('animationsEnabled') && (
          <SettingItem label={t('animations.label')} description={t('animations.description')} locked={isSettingLocked('animationsEnabled')}>
            <ToggleSwitch
              checked={animationsEnabled}
              onChange={(checked) => updateSetting('animationsEnabled', checked)}
            />
          </SettingItem>
        )}
      </SettingsSection>

      {/* 4. Media & Avatars */}
      <SettingsSection
        title={t('section_media_avatars')}
        description={t('section_media_avatars_desc')}
      >
        {!IS_LITE && (
          <SettingItem label={tAdvanced('sender_favicons.label')} description={tAdvanced('sender_favicons.description')}>
            <ToggleSwitch checked={senderFavicons} onChange={(checked) => updateSetting('senderFavicons', checked)} />
          </SettingItem>
        )}

        <SettingItem label={tAdvanced('show_avatars_in_junk.label')} description={tAdvanced('show_avatars_in_junk.description')}>
          <ToggleSwitch checked={showAvatarsInJunk} onChange={(checked) => updateSetting('showAvatarsInJunk', checked)} />
        </SettingItem>
      </SettingsSection>
    </div>
  );
}
