"use client";

import { forwardRef, type ComponentType, type ReactNode } from "react";
import { NavigationRail } from "@/components/layout/navigation-rail";
import { InlineAppView } from "@/components/layout/inline-app-view";
import { cn } from "@/lib/utils";
import type { InlineAppState } from "@/hooks/use-sidebar-apps";

export interface AppSidebarHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standardized 56px (h-14) sidebar header for all groupware apps.
 * Centered icon + title with optical balance (-translate-x-3), with optional
 * right-aligned actions positioned absolutely so centering is preserved.
 */
export function AppSidebarHeader({
  icon: Icon,
  title,
  actions,
  className,
}: AppSidebarHeaderProps) {
  return (
    <div
      className={cn(
        "h-14 border-b border-border flex items-center justify-center px-3.5 flex-shrink-0 bg-secondary relative",
        className
      )}
    >
      <div className="flex items-center gap-2 select-none -translate-x-3 rtl:translate-x-3">
        <Icon className="w-6 h-6 text-foreground/90 flex-shrink-0" />
        <span className="text-xl font-bold tracking-tight text-foreground truncate max-w-[190px]">
          {title}
        </span>
      </div>
      {actions && (
        <div className="absolute end-3.5 flex items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
}

export interface AppNavRailProps {
  quota?: { used: number; total: number } | null;
  isPushConnected?: boolean;
  onLogout?: () => void;
  onShowShortcuts?: () => void;
  onManageApps?: () => void;
  onInlineApp?: (appId: string, url: string, name: string) => void;
  onCloseInlineApp?: () => void;
  activeAppId?: string | null;
  className?: string;
}

/**
 * Standardized desktop navigation rail column (w-16, full-height, border-e, bg-secondary).
 */
export function AppNavRail({
  quota,
  isPushConnected,
  onLogout,
  onShowShortcuts,
  onManageApps,
  onInlineApp,
  onCloseInlineApp,
  activeAppId = null,
  className,
}: AppNavRailProps) {
  return (
    <div
      className={cn(
        "w-16 flex flex-col flex-shrink-0 border-e border-border bg-secondary h-full",
        className
      )}
    >
      <NavigationRail
        collapsed
        size="spacious"
        hideAlphaBadge
        quota={quota}
        isPushConnected={isPushConnected}
        onLogout={onLogout}
        onShowShortcuts={onShowShortcuts}
        onManageApps={onManageApps}
        onInlineApp={onInlineApp}
        onCloseInlineApp={onCloseInlineApp}
        activeAppId={activeAppId}
      />
    </div>
  );
}

export interface AppSidebarProps {
  children?: ReactNode;
  header?: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Standardized desktop sidebar column (w-[300px], full-height, border-e, bg-secondary).
 */
export const AppSidebar = forwardRef<HTMLDivElement, AppSidebarProps>(
  function AppSidebar({ children, header, className, id }, ref) {
    return (
      <div
        id={id}
        ref={ref}
        className={cn(
          "w-[300px] flex flex-col flex-shrink-0 h-full bg-secondary border-e border-border",
          className
        )}
      >
        {header}
        <div className="flex-1 min-w-0 overflow-hidden h-full flex flex-col">
          {children}
        </div>
      </div>
    );
  }
);

export interface AppLayoutProps {
  /** App title shown in the sidebar header */
  title: string;
  /** App icon shown next to title in the sidebar header */
  icon: ComponentType<{ className?: string }>;
  /** Optional actions on the right of the sidebar header (e.g. "+" button) */
  headerActions?: ReactNode;
  /** Sidebar content */
  sidebar?: ReactNode;
  /** Custom sidebar header override */
  sidebarHeader?: ReactNode;
  /** Main app content */
  children: ReactNode;

  /** Navigation Rail props */
  quota?: { used: number; total: number } | null;
  isPushConnected?: boolean;
  onLogout?: () => void;
  onShowShortcuts?: () => void;
  onManageApps?: () => void;
  onInlineApp?: (appId: string, url: string, name: string) => void;
  onCloseInlineApp?: () => void;
  activeAppId?: string | null;

  /** Inline app state */
  inlineApp?: InlineAppState | null;
  loadedApps?: InlineAppState[];

  /** Layout options */
  isMobile?: boolean;
  isEmbedded?: boolean;
  mvShell?: boolean;
  hideSidebar?: boolean;
  className?: string;
  sidebarClassName?: string;
}

/**
 * Reusable full-app desktop layout with Navigation Rail (w-16) and Sidebar (w-[300px])
 * matching the Mail application specification.
 */
export function AppLayout({
  title,
  icon,
  headerActions,
  sidebar,
  sidebarHeader,
  children,
  quota,
  isPushConnected,
  onLogout,
  onShowShortcuts,
  onManageApps,
  onInlineApp,
  onCloseInlineApp,
  activeAppId,
  inlineApp,
  loadedApps = [],
  isMobile = false,
  isEmbedded = false,
  mvShell = false,
  hideSidebar = false,
  className,
  sidebarClassName,
}: AppLayoutProps) {
  const showDesktopRail = !isMobile && !isEmbedded && !mvShell;

  return (
    <div className={cn("flex flex-1 min-h-0 overflow-hidden", isMobile && "flex-col", className)}>
      {/* Desktop Navigation Rail */}
      {showDesktopRail && (
        <AppNavRail
          quota={quota}
          isPushConnected={isPushConnected}
          onLogout={onLogout}
          onShowShortcuts={onShowShortcuts}
          onManageApps={onManageApps}
          onInlineApp={onInlineApp}
          onCloseInlineApp={onCloseInlineApp}
          activeAppId={inlineApp?.id ?? activeAppId ?? null}
        />
      )}

      {/* When inline app is open, show inline view full width/height */}
      {inlineApp ? (
        <InlineAppView
          apps={loadedApps}
          activeAppId={inlineApp.id}
          onClose={onCloseInlineApp || (() => {})}
          className="flex-1"
        />
      ) : (
        <>
          {/* Desktop App Sidebar (w-[300px]) */}
          {!hideSidebar && sidebar && (
            <AppSidebar
              className={sidebarClassName}
              header={
                sidebarHeader ?? (
                  <AppSidebarHeader
                    icon={icon}
                    title={title}
                    actions={headerActions}
                  />
                )
              }
            >
              {sidebar}
            </AppSidebar>
          )}

          {/* Main App Content Area */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

