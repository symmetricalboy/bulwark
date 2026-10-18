'use client';

import { useTranslations } from 'next-intl';
import { ToggleSwitch } from '@/components/settings/settings-section';
import {
  OutlookIcon,
  OneDriveIcon,
  MicrosoftCalendarIcon,
  MicrosoftToDoIcon,
  MicrosoftPeopleIcon,
} from '@/components/icons';
import { Ban, Split, RefreshCw } from 'lucide-react';
import {
  type MicrosoftAccountAppToggles,
  type MicrosoftAppMode,
  resolveMicrosoftAppMode,
} from '@/lib/microsoft/types';
import { cn } from '@/lib/utils';

export interface MicrosoftAccountConfigItem {
  id: string;
  email: string;
  name?: string;
  expiresAt?: number;
  apps: MicrosoftAccountAppToggles;
}

export interface MicrosoftAccountServicesConfigProps {
  accountEmail: string;
  values: MicrosoftAccountAppToggles;
  disabled?: boolean;
  onChange: (updates: Partial<MicrosoftAccountAppToggles>) => void;
}

export function MicrosoftAccountServicesConfig({
  accountEmail,
  values,
  disabled = false,
  onChange,
}: MicrosoftAccountServicesConfigProps) {
  const t = useTranslations('settings.account.linked_accounts');

  const calendarMode = resolveMicrosoftAppMode(values.calendar);
  const tasksMode = resolveMicrosoftAppMode(values.tasks);
  const contactsMode = resolveMicrosoftAppMode(values.contacts);

  const renderSegmentedMode = (
    appKey: 'calendar' | 'tasks' | 'contacts',
    currentMode: MicrosoftAppMode,
    ariaLabelPrefix: string
  ) => {
    const modes: Array<{
      key: MicrosoftAppMode;
      label: string;
      icon: typeof Ban;
      activeClass: string;
      desc: string;
    }> = [
      {
        key: 'none',
        label: t('mode.dont_use'),
        icon: Ban,
        activeClass: 'bg-background text-muted-foreground shadow-xs font-medium',
        desc: t('mode.dont_use_desc'),
      },
      {
        key: 'separate',
        label: t('mode.show_separately'),
        icon: Split,
        activeClass: 'bg-primary/10 text-primary border border-primary/20 shadow-xs font-semibold',
        desc: t('mode.show_separately_desc'),
      },
      {
        key: 'sync',
        label: t('mode.synchronize'),
        icon: RefreshCw,
        activeClass:
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs font-semibold',
        desc: t('mode.synchronize_desc'),
      },
    ];

    const activeItem = modes.find((m) => m.key === currentMode) || modes[0];

    return (
      <div className="flex flex-col gap-2 mt-2 sm:mt-0 items-start sm:items-end">
        <div
          role="radiogroup"
          aria-label={`${ariaLabelPrefix} mode for ${accountEmail}`}
          className="inline-flex items-center p-1 rounded-xl bg-muted/70 border border-border/60 text-xs gap-1"
        >
          {modes.map(({ key, label, icon: Icon, activeClass }) => {
            const isSelected = currentMode === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => onChange({ [appKey]: key })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  isSelected
                    ? activeClass
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                )}
              >
                <Icon
                  className={cn('w-3.5 h-3.5', isSelected && key === 'sync' && 'animate-spin-reverse')}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground italic sm:text-end max-w-sm">
          {activeItem.desc}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Outlook Mail - Simple toggle */}
      <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <OutlookIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.outlook', { defaultValue: 'Outlook Mail' })}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.outlook_desc', {
                defaultValue: 'Read, search, and send emails via your Outlook mailbox',
              })}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={Boolean(values.outlook)}
          disabled={disabled}
          onChange={(checked) => onChange({ outlook: checked })}
          ariaLabel={`${t('apps.outlook', { defaultValue: 'Outlook Mail' })} for ${accountEmail}`}
        />
      </div>

      {/* 2. OneDrive - Simple toggle */}
      <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <OneDriveIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.onedrive', { defaultValue: 'OneDrive' })}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.onedrive_desc', {
                defaultValue: 'Browse, upload, and manage your OneDrive files in Files',
              })}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={Boolean(values.onedrive)}
          disabled={disabled}
          onChange={(checked) => onChange({ onedrive: checked })}
          ariaLabel={`${t('apps.onedrive', { defaultValue: 'OneDrive' })} for ${accountEmail}`}
        />
      </div>

      {/* 3. Outlook Calendar - 3 options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <MicrosoftCalendarIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.microsoft_calendar', { defaultValue: 'Outlook Calendar' })}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.microsoft_calendar_desc', {
                defaultValue: 'View or synchronize your Microsoft calendars and events',
              })}
            </p>
          </div>
        </div>
        {renderSegmentedMode(
          'calendar',
          calendarMode,
          t('apps.microsoft_calendar', { defaultValue: 'Outlook Calendar' })
        )}
      </div>

      {/* 4. Microsoft To Do - 3 options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <MicrosoftToDoIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.microsoft_tasks', { defaultValue: 'Microsoft To Do' })}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.microsoft_tasks_desc', {
                defaultValue: 'View or synchronize your Microsoft To Do task lists',
              })}
            </p>
          </div>
        </div>
        {renderSegmentedMode(
          'tasks',
          tasksMode,
          t('apps.microsoft_tasks', { defaultValue: 'Microsoft To Do' })
        )}
      </div>

      {/* 5. Outlook Contacts - 3 options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <MicrosoftPeopleIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.microsoft_contacts', { defaultValue: 'Outlook Contacts' })}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.microsoft_contacts_desc', {
                defaultValue: 'View or synchronize your Microsoft People & Contacts',
              })}
            </p>
          </div>
        </div>
        {renderSegmentedMode(
          'contacts',
          contactsMode,
          t('apps.microsoft_contacts', { defaultValue: 'Outlook Contacts' })
        )}
      </div>
    </div>
  );
}
