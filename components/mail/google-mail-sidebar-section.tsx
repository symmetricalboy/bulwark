"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Inbox,
  Send,
  File,
  Trash2,
  ShieldAlert,
  Star,
  Tag,
  ChevronDown,
  ChevronRight,
  GoogleIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Mailbox } from '@/lib/jmap/types';
import type { GoogleMailAccountData } from '@/hooks/use-google-mail';

interface GoogleMailSidebarSectionProps {
  accountsData: GoogleMailAccountData[];
  selectedMailbox: string;
  onMailboxSelect: (mailboxId: string) => void;
  isCollapsed?: boolean;
}

export function GoogleMailSidebarSection({
  accountsData,
  selectedMailbox,
  onMailboxSelect,
  isCollapsed = false,
}: GoogleMailSidebarSectionProps) {
  const tCommon = useTranslations('common');
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});

  if (accountsData.length === 0) return null;

  const toggleAccount = (email: string) => {
    setCollapsedAccounts((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  const getMailboxIcon = (mb: Mailbox) => {
    switch (mb.role) {
      case 'inbox':
        return <Inbox className="w-4 h-4 flex-shrink-0 text-blue-500" />;
      case 'sent':
        return <Send className="w-4 h-4 flex-shrink-0 text-green-500" />;
      case 'drafts':
        return <File className="w-4 h-4 flex-shrink-0 text-amber-500" />;
      case 'trash':
        return <Trash2 className="w-4 h-4 flex-shrink-0 text-red-500" />;
      case 'junk':
        return <ShieldAlert className="w-4 h-4 flex-shrink-0 text-orange-500" />;
      case 'starred':
        return <Star className="w-4 h-4 flex-shrink-0 text-yellow-500" />;
      default:
        return <Tag className="w-4 h-4 flex-shrink-0 text-muted-foreground" />;
    }
  };

  return (
    <div className="pt-2 pb-1 border-t border-border/40">
      {accountsData.map(({ account, mailboxes, unreadTotal }) => {
        const isAccCollapsed = Boolean(collapsedAccounts[account.email]);

        return (
          <div key={account.id || account.email} className="mb-2 last:mb-0">
            {/* Account Header */}
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccount(account.email)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-md transition-colors group"
                title={account.email}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-muted-foreground/70 group-hover:text-foreground transition-transform">
                    {isAccCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate text-foreground/90 font-medium">{account.email}</span>
                </div>
                {unreadTotal > 0 && isAccCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {unreadTotal}
                  </span>
                )}
              </button>
            ) : (
              <div className="flex justify-center py-1">
                <GoogleIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            )}

            {/* Account Mailboxes */}
            {!isAccCollapsed && (
              <div className="mt-0.5 space-y-0.5">
                {mailboxes.length === 0 ? (
                  <div className="px-6 py-1 text-xs text-muted-foreground italic">
                    {!isCollapsed && tCommon('loading')}
                  </div>
                ) : (
                  mailboxes.map((mb) => {
                    const isSelected = selectedMailbox === mb.id;
                    const unread = mb.unreadEmails || 0;

                    return (
                      <button
                        key={mb.id}
                        type="button"
                        onClick={() => onMailboxSelect(mb.id)}
                        className={cn(
                          "w-full flex items-center justify-between py-1.5 rounded-md text-sm transition-colors",
                          isCollapsed ? "justify-center px-2" : "px-3 pl-6",
                          isSelected
                            ? "bg-accent font-medium text-accent-foreground"
                            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                        )}
                        title={mb.name}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getMailboxIcon(mb)}
                          {!isCollapsed && <span className="truncate">{mb.name}</span>}
                        </div>
                        {!isCollapsed && unread > 0 && (
                          <span
                            className={cn(
                              "text-xs px-1.5 py-0.2 rounded-full font-semibold",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
