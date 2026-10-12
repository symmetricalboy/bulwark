"use client";

import { useTranslations } from 'next-intl';
import { ToggleSwitch } from '@/components/settings/settings-section';
import {
  GmailIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
  GoogleTasksIcon,
  GoogleContactsIcon,
} from '@/components/icons';
import { Ban, Split, RefreshCw } from 'lucide-react';
import {
  type GoogleAccountAppToggles,
  type GoogleAppMode,
  normalizeAppMode,
} from '@/lib/google/types';
import { cn } from '@/lib/utils';

export interface GoogleAccountServicesConfigProps {
  accountEmail: string;
  values: GoogleAccountAppToggles;
  disabled?: boolean;
  onChange: (updates: Partial<GoogleAccountAppToggles>) => void;
}

export function GoogleAccountServicesConfig({
  accountEmail,
  values,
  disabled = false,
  onChange,
}: GoogleAccountServicesConfigProps) {
  const t = useTranslations('settings.account.linked_accounts');

  const calendarMode = normalizeAppMode(values.calendar);
  const tasksMode = normalizeAppMode(values.tasks);
  const contactsMode = normalizeAppMode(values.contacts);

  const renderSegmentedMode = (
    appKey: 'calendar' | 'tasks' | 'contacts',
    currentMode: GoogleAppMode,
    ariaLabelPrefix: string
  ) => {
    const modes: Array<{
      key: GoogleAppMode;
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
        activeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs font-semibold',
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
                <Icon className={cn('w-3.5 h-3.5', isSelected && key === 'sync' && 'animate-spin-reverse')} />
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
      {/* 1. Gmail - Simple toggle */}
      <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <GmailIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.gmail')}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.gmail_desc')}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={Boolean(values.gmail)}
          disabled={disabled}
          onChange={(checked) => onChange({ gmail: checked })}
          ariaLabel={`${t('apps.gmail')} for ${accountEmail}`}
        />
      </div>

      {/* 2. Drive - Simple toggle */}
      <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <GoogleDriveIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.drive')}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.drive_desc')}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={Boolean(values.drive)}
          disabled={disabled}
          onChange={(checked) => onChange({ drive: checked })}
          ariaLabel={`${t('apps.drive')} for ${accountEmail}`}
        />
      </div>

      {/* 3. Calendar - 3 options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <GoogleCalendarIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.calendar')}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.calendar_desc')}
            </p>
          </div>
        </div>
        {renderSegmentedMode('calendar', calendarMode, t('apps.calendar'))}
      </div>

      {/* 4. Tasks - 3 options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <GoogleTasksIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.tasks')}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.tasks_desc')}
            </p>
          </div>
        </div>
        {renderSegmentedMode('tasks', tasksMode, t('apps.tasks'))}
      </div>

      {/* 5. Contacts - 3 options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl border border-border/70 bg-card/40 hover:bg-muted/30 transition-all shadow-2xs gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center flex-shrink-0 shadow-xs">
            <GoogleContactsIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('apps.contacts')}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t('apps.contacts_desc')}
            </p>
          </div>
        </div>
        {renderSegmentedMode('contacts', contactsMode, t('apps.contacts'))}
      </div>
    </div>
  );
}
