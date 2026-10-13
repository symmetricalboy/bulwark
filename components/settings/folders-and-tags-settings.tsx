"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Folder, Tag } from '@/components/icons';
import { FolderSettings } from '@/components/settings/folder-settings';
import { KeywordSettings } from '@/components/settings/keyword-settings';
import { usePolicyStore } from '@/stores/policy-store';
import { cn } from '@/lib/utils';

export interface FoldersAndTagsSettingsProps {
  initialSubTab?: 'folders' | 'tags';
}

export function FoldersAndTagsSettings({ initialSubTab = 'folders' }: FoldersAndTagsSettingsProps) {
  const [subTab, setSubTab] = useState<'folders' | 'tags'>(initialSubTab);
  const t = useTranslations('settings');
  const { isFeatureEnabled } = usePolicyStore();
  const customKeywordsEnabled = isFeatureEnabled('customKeywordsEnabled');

  return (
    <div className="space-y-6">
      {customKeywordsEnabled && (
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg w-fit border border-border/50">
          <button
            type="button"
            data-testid="subtab-folders"
            onClick={() => setSubTab('folders')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              subTab === 'folders'
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{t('tabs.folders')}</span>
          </button>
          <button
            type="button"
            data-testid="subtab-tags"
            onClick={() => setSubTab('tags')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              subTab === 'tags'
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{t('tabs.keywords')}</span>
          </button>
        </div>
      )}

      {subTab === 'folders' ? (
        <FolderSettings />
      ) : (
        <KeywordSettings />
      )}
    </div>
  );
}
