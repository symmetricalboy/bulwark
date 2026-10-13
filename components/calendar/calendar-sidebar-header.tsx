"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon } from "@/components/icons";
import { AppSidebarHeader } from "@/components/layout/app-layout";

interface CalendarSidebarHeaderProps {
  onCreateEvent: () => void;
  /** Mark the button for the guided tour; off while the toolbar's own "+" is the visible one. */
  tourTarget?: boolean;
}

/**
 * Standardized 56px (h-14) title row at the top of the calendar sidebar,
 * using AppSidebarHeader to match Mail and Contacts.
 */
export function CalendarSidebarHeader({ onCreateEvent, tourTarget = true }: CalendarSidebarHeaderProps) {
  const t = useTranslations("calendar");

  return (
    <AppSidebarHeader
      icon={CalendarIcon}
      title={t("title")}
      actions={
        <Button
          size="icon"
          variant="ghost"
          onClick={onCreateEvent}
          className="h-8 w-8 flex-shrink-0"
          aria-label={t("events.create")}
          title={t("events.create")}
          data-tour={tourTarget ? "create-event-button" : undefined}
        >
          <Plus className="w-4 h-4" />
        </Button>
      }
    />
  );
}
