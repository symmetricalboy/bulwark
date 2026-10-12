"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useMessages } from 'next-intl';
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  Settings as SettingsIcon,
  Palette,
  Search,
  User,
  Shield,
  UserPen,
  PalmtreeIcon,
  Calendar,
  Filter,
  FileText,
  FolderOpen,
  Tags,
  HardDrive,
  BookUser,
  Plug,
  PanelLeftClose,
  Bell,
  Puzzle,
  LayoutGrid,
  Link as LinkIcon,
  BookOpen,
  PenLine,
  EyeOff,
  Languages,
  Info,
  Bug,
  SwatchBook,
  Download,
  ExternalLink,
  Mail,
  X,
  type AppIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { AppTopBannerSlot } from '@/components/plugins/app-top-banner-slot';
import { LayoutSettings } from '@/components/settings/layout-settings';
import { LanguageSettings } from '@/components/settings/language-settings';
import { ReadingSettings } from '@/components/settings/reading-settings';
import { ComposingSettings } from '@/components/settings/composing-settings';
import { ContentSendersSettings } from '@/components/settings/content-senders-settings';
import { AccountSettings } from '@/components/settings/account-settings';
import { IdentitySettings } from '@/components/settings/identity-settings';
import { VacationSettings } from '@/components/settings/vacation-settings';
import { CalendarSettings } from '@/components/settings/calendar-settings';
import { CalendarManagementSettings } from '@/components/settings/calendar-management-settings';
import { AddressBookManagementSettings } from '@/components/settings/address-book-management-settings';
import { FilterSettings } from '@/components/settings/filter-settings';
import { TemplateSettings } from '@/components/settings/template-settings';
import { AboutDataSettings } from '@/components/settings/about-data-settings';
import { DebugSettings } from '@/components/settings/debug-settings';
import { FolderSettings } from '@/components/settings/folder-settings';
import { KeywordSettings } from '@/components/settings/keyword-settings';
import { AccountSecuritySettings } from '@/components/settings/account-security-settings';
import { FilesSettingsComponent } from '@/components/settings/files-settings';
import { DownloadsSettings } from '@/components/settings/downloads-settings';
import { ContactsSettings } from '@/components/settings/contacts-settings';
import { SidebarAppsSettings } from '@/components/settings/sidebar-apps-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { ThemesSettings } from '@/components/settings/themes-settings';
import { PluginsSettings } from '@/components/settings/plugins-settings';
import { PluginIframeSlot } from '@/components/plugins/plugin-iframe-slot';
import { offersForSlot as pluginOffersForSlot, subscribe as pluginRegistrySubscribe, get as getActivePlugin } from '@/lib/plugin-sandbox/registry';
import { ProtocolHandlerSettings } from '@/components/settings/protocol-handler-settings';
import { ByomcSettings } from '@/components/settings/byomc-settings';
import { appPath, buildSettingsPath, parseSettingsPath } from '@/lib/deep-links';
import { consumePendingDeepLink, subscribePendingDeepLink } from '@/lib/deep-link-handoff';
import { useDeepLinkUrl } from '@/hooks/use-deep-link-url';
import { useProInterfaceActive } from '@/components/pro/pro-interface-redirect';
import { useAuthStore, redirectToLogin, saveRedirectAfterLogin } from '@/stores/auth-store';
import { useEmailStore } from '@/stores/email-store';
import { usePluginStore } from '@/stores/plugin-store';
import { useThemeStore } from '@/stores/theme-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useManagedAccountStore } from '@/stores/managed-account-store';
import { useIsDesktop } from '@/hooks/use-media-query';
import { NavigationRail } from '@/components/layout/navigation-rail';
import { SidebarAppsModal } from '@/components/layout/sidebar-apps-modal';
import { InlineAppView } from '@/components/layout/inline-app-view';
import { useSidebarApps } from '@/hooks/use-sidebar-apps';
import { useResolvedSidebarApps } from '@/hooks/use-resolved-sidebar-apps';
import { useIsEmbedded } from '@/hooks/use-is-embedded';
import { useIsFocusedProTab } from '@/hooks/use-pane-context';
import { ResizeHandle } from '@/components/layout/resize-handle';
import { useConfig } from '@/hooks/use-config';
import { IS_LITE } from '@/lib/lite';
import { usePolicyStore } from '@/stores/policy-store';
import { cn } from '@/lib/utils';
import {
  type SettingsSearchTab,
  type SubResult,
  collectSubResults,
  flattenStrings,
  getByPath,
  tabKeywords,
  tabSearchPaths,
} from '@/lib/settings-search';
import { useLiteLinkSegments } from '@/hooks/use-lite-link-segments';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { MvTopBar } from "@/components/layout/mv-top-bar";
import { useMountainViewShell } from "@/hooks/use-mountain-view-shell";

type Tab = SettingsSearchTab;

export type SettingsHubId =
  | 'account'
  | 'appearance'
  | 'mail'
  | 'organization'
  | 'apps'
  | 'notifications'
  | 'advanced';

// A plugin that exposes a `settings-section` slot gets its own first-class
// Settings entry, keyed `plugin:<id>`, so its UI (e.g. S/MIME key import) is
// discoverable as a menu point rather than buried inside another panel.
type PluginTabId = `plugin:${string}`;
type SettingsTabId = Tab | PluginTabId;

export interface SubTabDef {
  id: SettingsTabId;
  label: string;
  icon: AppIcon;
}

export interface HubDef {
  id: SettingsHubId;
  label: string;
  subtitle: string;
  icon: AppIcon;
  subTabs: SubTabDef[];
}

const tabIcons: Record<Tab, AppIcon> = {
  account: User,
  language: Languages,
  notifications: Bell,
  appearance: Palette,
  layout: LayoutGrid,
  reading: BookOpen,
  composing: PenLine,
  downloads: Download,
  identities: UserPen,
  vacation: PalmtreeIcon,
  filters: Filter,
  templates: FileText,
  folders: FolderOpen,
  keywords: Tags,
  byomc: Plug,
  security: Shield,
  content_senders: EyeOff,
  calendar: Calendar,
  contacts: BookUser,
  files: HardDrive,
  protocol_handlers: LinkIcon,
  sidebar_apps: PanelLeftClose,
  about_data: Info,
  themes: SwatchBook,
  plugins: Puzzle,
  debug: Bug,
};

const TAB_TO_HUB: Record<Tab, SettingsHubId> = {
  account: 'account',
  security: 'account',
  byomc: 'account',
  language: 'account',

  appearance: 'appearance',
  layout: 'appearance',
  themes: 'appearance',

  reading: 'mail',
  composing: 'mail',
  identities: 'mail',
  vacation: 'mail',
  downloads: 'mail',

  keywords: 'organization',
  folders: 'organization',
  filters: 'organization',
  templates: 'organization',

  calendar: 'apps',
  contacts: 'apps',
  files: 'apps',
  sidebar_apps: 'apps',

  notifications: 'notifications',

  about_data: 'advanced',
  content_senders: 'advanced',
  protocol_handlers: 'advanced',
  plugins: 'advanced',
  debug: 'advanced',
};

export function getHubForTab(tabId: SettingsTabId): SettingsHubId {
  if (tabId.startsWith('plugin:')) return 'apps';
  return TAB_TO_HUB[tabId as Tab] ?? 'appearance';
}

// Map legacy tab IDs to current ones; runs once on read of localStorage.
const LEGACY_TAB_MAP: Record<string, Tab> = {
  email: 'reading',
  advanced: 'about_data',
  mail: 'reading',
  organization: 'keywords',
  apps: 'calendar',
};

function readPersistedTab(): SettingsTabId {
  try {
    // One-shot deep link from the sidebar section gears (Folders / Tags).
    // Used only as the initial tab and intentionally NOT written to
    // 'settings-active-tab', so a gear click never becomes the persisted
    // default that the regular Settings button lands on. Cleared on mount.
    const deepLink = sessionStorage.getItem('settings-deep-link-tab');
    if (deepLink) {
      return (deepLink in LEGACY_TAB_MAP ? LEGACY_TAB_MAP[deepLink] : deepLink) as SettingsTabId;
    }
    const saved = localStorage.getItem('settings-active-tab');
    if (!saved) return 'appearance';
    if (saved in LEGACY_TAB_MAP) {
      const migrated = LEGACY_TAB_MAP[saved];
      try { localStorage.setItem('settings-active-tab', migrated); } catch { /* ignore */ }
      return migrated;
    }
    return saved as SettingsTabId;
  } catch {
    return 'appearance';
  }
}

/**
 * The tab a `/settings/<tab>` deep link names (#733), or null when the URL
 * names nothing we recognise - an old link to a tab that has since been
 * renamed falls back to the persisted tab rather than rendering an empty pane.
 * Legacy ids are migrated the same way the stored value is.
 */
function tabFromDeepLink(segments: string[] | null | undefined): SettingsTabId | null {
  const raw = parseSettingsPath(segments ?? []);
  if (!raw) return null;
  const migrated = raw in LEGACY_TAB_MAP ? LEGACY_TAB_MAP[raw] : raw;
  if (migrated in tabIcons) return migrated as SettingsTabId;
  if (migrated.startsWith('plugin:')) return migrated as SettingsTabId;
  return null;
}

// Toggling the Pro interface remounts the whole settings surface (enabling
// replaces the route with /pro, which hosts its own SettingsApp; disabling
// leaves /pro through a full page load back to /settings). The active tab
// survives via localStorage, but the content pane's scroll offset would not -
// and the toggle itself sits at the bottom of a long tab, so the user would
// land back at the top of the page they were just on. Module scope covers the
// client-side navigation; sessionStorage carries the offset across the full
// page load, with a TTL so a stray unconsumed entry can't scroll a visit
// minutes later.
let parkedContentScroll: { tab: SettingsTabId; top: number; ts: number } | null = null;
const SCROLL_RESTORE_KEY = 'settings-scroll-restore';

export interface SettingsAppProps {
  /** Path segments after `/settings` - `['<tabId>']`. */
  linkSegments?: string[];
}

export function SettingsApp({ linkSegments: routeSegments }: SettingsAppProps = {}) {
  // Static Lite build: the route params are empty, read the link from the URL.
  const linkSegments = useLiteLinkSegments('settings', routeSegments);
  const router = useRouter();
  const t = useTranslations('settings');
  const tSidebar = useTranslations('sidebar');
  useDocumentTitle(tSidebar('settings'));
  const { client, isAuthenticated, logout, checkAuth, isLoading: authLoading } = useAuthStore();
  const { showAppsModal, inlineApp, loadedApps, handleManageApps, handleInlineApp, closeInlineApp, closeAppsModal } = useSidebarApps();
  const isEmbedded = useIsEmbedded();
  // Mountain View's desktop chrome: its top bar in place of the left rail.
  const mvShell = useMountainViewShell(isEmbedded);
  const [initialCheckDone, setInitialCheckDone] = useState(() => useAuthStore.getState().isAuthenticated && !!useAuthStore.getState().client);
  const { quota, isPushConnected } = useEmailStore();
  const {
    stalwartFeaturesEnabled,
    calendarEnabled: calendarConfigEnabled,
    contactsEnabled: contactsConfigEnabled,
    filesEnabled: filesConfigEnabled,
    appsEnabled: appsConfigEnabled,
    byomcEnabled,
    passwordSecurityEnabled,
    smimeEnabled: smimeConfigEnabled,
  } = useConfig();
  const { isFeatureEnabled } = usePolicyStore();
  // A tab in the URL wins over the persisted one; without it, nothing changes.
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    () => tabFromDeepLink(linkSegments) ?? readPersistedTab(),
  );
  // Active plugins that expose a `settings-section` slot — each becomes its own
  // Settings menu entry. Referentially stable per registry mutation, so it is
  // safe to feed useSyncExternalStore directly.
  const allPluginSettingsOffers = useSyncExternalStore(
    pluginRegistrySubscribe,
    () => pluginOffersForSlot('settings-section'),
    () => pluginOffersForSlot('settings-section'),
  );
  const pluginSettingsOffers = useMemo(
    () => allPluginSettingsOffers.filter((offer) => {
      if (smimeConfigEnabled) return true;
      return !getActivePlugin(offer.pluginId)?.plugin.permissions.some((permission) =>
        permission.startsWith('smime:'),
      );
    }),
    [allPluginSettingsOffers, smimeConfigEnabled],
  );
  // Consume the one-shot deep-link key so a section gear only steers this one
  // open, never the persisted default for future Settings-button clicks.
  useEffect(() => {
    try { sessionStorage.removeItem('settings-deep-link-tab'); } catch { /* ignore */ }
  }, []);
  // Inside the Pro shell there is no route to read the tab from, so it arrives
  // through the handoff the redirect parked (#733).
  useEffect(() => {
    if (linkSegments) return;
    const tab = tabFromDeepLink(consumePendingDeepLink('settings'));
    if (tab) setActiveTab(tab);
  }, [linkSegments]);
  // Pro shell only: this surface stays mounted for the whole session, so links
  // arriving later (e.g. the sidebar's folder-settings gear) are delivered
  // live instead of being parked for a mount that already happened.
  useEffect(() => {
    if (!isEmbedded) return;
    return subscribePendingDeepLink('settings', (segments) => {
      const tab = tabFromDeepLink(segments);
      if (tab) setActiveTab(tab);
    });
  }, [isEmbedded]);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingHighlight, setPendingHighlight] = useState<{ tab: SettingsTabId; label: string; pluginId?: string } | null>(null);
  const isDesktop = useIsDesktop();

  const messages = useMessages() as Record<string, unknown>;
  const installedPlugins = usePluginStore((s) => s.plugins);
  const installedThemes = useThemeStore((s) => s.installedThemes);
  // Admin-pinned apps are searchable too - users can't add them, but they're listed.
  const sidebarAppsList = useResolvedSidebarApps();
  const proInterface = useSettingsStore((s) => s.proInterface);

  // When set, the settings panel is scoped to a shared/group account: a reduced
  // tab list and a "Managing: <name>" header. null = the user's own account.
  const managedAccountId = useManagedAccountStore((s) => s.managedAccountId);
  const managedAccount = useManagedAccountStore((s) => s.managedAccount);
  const clearManagedAccount = useManagedAccountStore((s) => s.clear);

  // Build a per-tab haystack for fulltext search and a list of sub-results
  // (individual settings) per tab. Sub-results come from translation entries
  // that have a `label`/`title` field, plus dynamic content (installed
  // plugins/themes/sidebar apps).
  const { tabSearchHaystacks, tabSubResults } = useMemo(() => {
    const haystacks: Partial<Record<Tab, string>> = {};
    const subs: Partial<Record<Tab, SubResult[]>> = {};
    const tabIds = Object.keys(tabSearchPaths) as Tab[];
    for (const tabId of tabIds) {
      const strings: string[] = [tabId.replace(/_/g, ' '), tabKeywords[tabId] ?? ''];
      const list: SubResult[] = [];
      for (const path of tabSearchPaths[tabId]) {
        const node = getByPath(messages, path);
        flattenStrings(node, strings);
        collectSubResults(node, list);
      }
      // Dedupe sub-results by label
      const seen = new Set<string>();
      subs[tabId] = list.filter((r) => {
        if (seen.has(r.label)) return false;
        seen.add(r.label);
        return true;
      });
      haystacks[tabId] = strings.join(' ').toLowerCase();
    }
    if (installedPlugins.length) {
      const haystackText = installedPlugins.map((p) => {
        const fieldText = p.settingsSchema
          ? Object.values(p.settingsSchema)
              .map((s) => `${s.label} ${s.description ?? ''}`)
              .join(' ')
          : '';
        return `${p.name} ${p.description} ${p.author} ${fieldText}`;
      }).join(' ');
      haystacks.plugins = `${haystacks.plugins ?? ''} ${haystackText}`.toLowerCase();
      const pluginSubs: SubResult[] = installedPlugins.flatMap((p) => {
        const items: SubResult[] = [{ label: p.name, description: p.description }];
        if (p.settingsSchema) {
          for (const schema of Object.values(p.settingsSchema)) {
            items.push({
              label: schema.label,
              description: schema.description,
              pluginId: p.id,
            });
          }
        }
        return items;
      });
      subs.plugins = [...(subs.plugins ?? []), ...pluginSubs];
    }
    if (installedThemes.length) {
      const text = installedThemes.map((th) => `${th.name} ${th.description} ${th.author}`).join(' ');
      haystacks.themes = `${haystacks.themes ?? ''} ${text}`.toLowerCase();
      subs.themes = [
        ...(subs.themes ?? []),
        ...installedThemes.map((th) => ({ label: th.name, description: th.description })),
      ];
    }
    if (sidebarAppsList.length) {
      const text = sidebarAppsList.map((a) => `${a.name} ${a.url}`).join(' ');
      haystacks.sidebar_apps = `${haystacks.sidebar_apps ?? ''} ${text}`.toLowerCase();
      subs.sidebar_apps = [
        ...(subs.sidebar_apps ?? []),
        ...sidebarAppsList.map((a) => ({ label: a.name, description: a.url })),
      ];
    }
    return { tabSearchHaystacks: haystacks, tabSubResults: subs };
  }, [messages, installedPlugins, installedThemes, sidebarAppsList]);

  // Sidebar resize state
  const [settingsSidebarWidth, setSettingsSidebarWidth] = useState(() => {
    try { const v = localStorage.getItem('settings-sidebar-width'); return v ? Number(v) : 256; } catch { return 256; }
  });
  const [isResizing, setIsResizing] = useState(false);
  const dragStartWidth = useRef(256);

  // Check auth on mount – skip when already authenticated so that navigating
  // between routes doesn't retrigger checkAuth's transient `{ client: null,
  // isLoading: true }` reset, which was flashing the spinner on every nav.
  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated && state.client) {
      setInitialCheckDone(true);
      return;
    }
    checkAuth().finally(() => {
      setInitialCheckDone(true);
    });
  }, [checkAuth]);

  // Listen for tab change events from child components (with legacy migration)
  useEffect(() => {
    const handler = (e: Event) => {
      const raw = (e as CustomEvent).detail as string;
      if (!raw) return;
      const tab = (LEGACY_TAB_MAP[raw] ?? raw) as Tab;
      setActiveTab(tab);
      try { localStorage.setItem('settings-active-tab', tab); } catch { /* ignore */ }
    };
    window.addEventListener('settings-tab-change', handler);
    return () => window.removeEventListener('settings-tab-change', handler);
  }, []);

  // Leaving the settings panel drops any shared-account scope so it never
  // leaks into the next visit or another session.
  useEffect(() => () => clearManagedAccount(), [clearManagedAccount]);

  useEffect(() => {
    if (initialCheckDone && !isAuthenticated && !authLoading) {
      saveRedirectAfterLogin();
      redirectToLogin();
    }
  }, [initialCheckDone, isAuthenticated, authLoading]);

  // Sync the mobile submenu view with browser history so the system back
  // button (or gesture) returns to the settings list before exiting /settings.
  useEffect(() => {
    if (isDesktop) return;
    if (typeof window === 'undefined') return;
    if (!mobileShowContent) return;

    window.history.pushState({ __settingsSubmenu: true }, '');

    const handlePop = () => {
      setMobileShowContent(false);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isDesktop, mobileShowContent]);

  // After clicking a search sub-result, scroll the matching setting into view
  // and add a temporary highlight class. Some tabs fetch data and render
  // their SettingItems only after a loading state, so retry until the element
  // shows up (or we give up after ~2s).
  useEffect(() => {
    if (!pendingHighlight) return;
    if (pendingHighlight.tab !== activeTab) return;
    if (typeof window === 'undefined') return;

    // For plugin-setting sub-results, ask the plugins tab to expand the
    // matching card so the field becomes part of the DOM. Dispatched here
    // (not in the click handler) because PluginsSettings only mounts after
    // the tab switches, and its listener registers in its own useEffect -
    // child effects run before parent effects, so by the time we get here
    // the listener is guaranteed to be in place.
    if (pendingHighlight.pluginId) {
      window.dispatchEvent(
        new CustomEvent('settings-plugin-expand', { detail: { pluginId: pendingHighlight.pluginId } })
      );
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let highlightedEl: HTMLElement | null = null;

    const escaped = pendingHighlight.label.replace(/"/g, '\\"');
    const selector = `[data-search-label="${escaped}"]`;
    const deadline = Date.now() + 2000;

    const tryHighlight = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) {
        if (Date.now() < deadline) {
          retryTimer = setTimeout(tryHighlight, 80);
        }
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Remove + reflow + add restarts the CSS animation if the class was
      // already present (re-clicking the same sub-result).
      el.classList.remove('settings-search-highlight');
      void el.offsetWidth;
      el.classList.add('settings-search-highlight');
      highlightedEl = el;
      cleanupTimer = setTimeout(() => {
        el.classList.remove('settings-search-highlight');
        highlightedEl = null;
      }, 1800);
    };

    // First attempt next frame so the freshly-mounted tab content is in DOM.
    const raf = window.requestAnimationFrame(tryHighlight);

    // Do NOT reset pendingHighlight here - that would retrigger this effect
    // and the cleanup below would strip the class right after we added it.
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (highlightedEl) highlightedEl.classList.remove('settings-search-highlight');
    };
  }, [pendingHighlight, activeTab]);

  // The permalink for the open tab (#733). Suppressed inside the Pro shell,
  // where /pro owns the address bar. On mobile the tab list is its own screen,
  // so the tab is only in the URL once the user is looking at its content.
  // Must sit above the early return below - it is a hook.
  const proInterfaceActive = useProInterfaceActive();
  const isFocusedProTab = useIsFocusedProTab();
  const settingsLinkPath = appPath(buildSettingsPath(!isDesktop && !mobileShowContent ? null : activeTab));
  useDeepLinkUrl(
    !isAuthenticated
      ? null
      : isEmbedded
        ? (isFocusedProTab ? settingsLinkPath : null)
        : proInterfaceActive ? null : settingsLinkPath,
  );

  // Park the content-pane scroll offset when the Pro toggle flips (the flip
  // remounts this component - see parkedContentScroll above). The ref only
  // exists in the desktop layout, which is also the only place the remount
  // can happen - on mobile `el` stays null and nothing is parked.
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const prevProInterface = useRef(proInterface);
  useEffect(() => {
    if (prevProInterface.current === proInterface) return;
    prevProInterface.current = proInterface;
    const el = contentScrollRef.current;
    if (!el) return;
    parkedContentScroll = { tab: activeTab, top: el.scrollTop, ts: Date.now() };
    try { sessionStorage.setItem(SCROLL_RESTORE_KEY, JSON.stringify(parkedContentScroll)); } catch { /* ignore */ }
  }, [proInterface, activeTab]);
  // Restore when the container mounts. A callback ref rather than a mount
  // effect: after the Pro-off reload this component first renders without the
  // container (auth check pending), so a mount-time effect would consume the
  // parked offset before there is anything to scroll.
  const attachContentScroll = useCallback((el: HTMLDivElement | null) => {
    contentScrollRef.current = el;
    if (!el) return;
    let parked = parkedContentScroll;
    parkedContentScroll = null;
    try {
      const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
      if (raw) {
        sessionStorage.removeItem(SCROLL_RESTORE_KEY);
        parked = parked ?? (JSON.parse(raw) as NonNullable<typeof parkedContentScroll>);
      }
    } catch { /* ignore */ }
    if (parked && parked.tab === activeTab && Date.now() - parked.ts < 60_000) {
      el.scrollTop = parked.top;
    }
  }, [activeTab]);

  const supportsVacation = client?.supportsVacationResponse() ?? false;
  const supportsCalendar = client?.supportsCalendars() ?? false;
  const supportsSieve = client?.supportsSieve() ?? false;
  const supportsFiles = client?.supportsFiles() ?? false;
  const supportsContacts = client?.supportsContacts() ?? false;

  const hubs: HubDef[] = useMemo(() => [
    {
      id: 'account',
      label: t('hubs.account'),
      subtitle: t('hubs.account_subtitle'),
      icon: User,
      subTabs: [
        { id: 'account', label: t('tabs.account'), icon: tabIcons.account },
        ...(stalwartFeaturesEnabled && passwordSecurityEnabled
          ? [{ id: 'security' as Tab, label: t('tabs.security'), icon: tabIcons.security }]
          : []),
        ...(byomcEnabled ? [{ id: 'byomc' as Tab, label: t('tabs.byomc'), icon: tabIcons.byomc }] : []),
        { id: 'language', label: t('tabs.language'), icon: tabIcons.language },
      ],
    },
    {
      id: 'appearance',
      label: t('hubs.appearance'),
      subtitle: t('hubs.appearance_subtitle'),
      icon: Palette,
      subTabs: [
        { id: 'appearance', label: t('tabs.appearance'), icon: tabIcons.appearance },
        { id: 'layout', label: t('tabs.layout'), icon: tabIcons.layout },
        ...(isFeatureEnabled('themesEnabled')
          ? [{ id: 'themes' as Tab, label: t('tabs.themes'), icon: tabIcons.themes }]
          : []),
      ],
    },
    {
      id: 'mail',
      label: t('hubs.mail'),
      subtitle: t('hubs.mail_subtitle'),
      icon: Mail,
      subTabs: [
        { id: 'reading', label: t('tabs.reading'), icon: tabIcons.reading },
        { id: 'composing', label: t('tabs.composing'), icon: tabIcons.composing },
        { id: 'identities', label: t('tabs.identities'), icon: tabIcons.identities },
        ...(supportsVacation
          ? [{ id: 'vacation' as Tab, label: t('tabs.vacation'), icon: tabIcons.vacation }]
          : []),
        { id: 'downloads', label: t('tabs.downloads'), icon: tabIcons.downloads },
      ],
    },
    {
      id: 'organization',
      label: t('hubs.organization'),
      subtitle: t('hubs.organization_subtitle'),
      icon: Tags,
      subTabs: [
        ...(isFeatureEnabled('customKeywordsEnabled')
          ? [{ id: 'keywords' as Tab, label: t('tabs.keywords'), icon: tabIcons.keywords }]
          : []),
        { id: 'folders', label: t('tabs.folders'), icon: tabIcons.folders },
        ...(supportsSieve
          ? [{ id: 'filters' as Tab, label: t('tabs.filters'), icon: tabIcons.filters }]
          : []),
        ...(isFeatureEnabled('templatesEnabled')
          ? [{ id: 'templates' as Tab, label: t('tabs.templates'), icon: tabIcons.templates }]
          : []),
      ],
    },
    {
      id: 'apps',
      label: t('hubs.apps'),
      subtitle: t('hubs.apps_subtitle'),
      icon: LayoutGrid,
      subTabs: [
        ...(calendarConfigEnabled && supportsCalendar && isFeatureEnabled('calendarEnabled')
          ? [{ id: 'calendar' as Tab, label: t('tabs.calendar'), icon: tabIcons.calendar }]
          : []),
        ...(contactsConfigEnabled && supportsContacts && isFeatureEnabled('contactsEnabled')
          ? [{ id: 'contacts' as Tab, label: t('tabs.contacts'), icon: tabIcons.contacts }]
          : []),
        ...(filesConfigEnabled && supportsFiles && isFeatureEnabled('filesEnabled')
          ? [{ id: 'files' as Tab, label: t('tabs.files'), icon: tabIcons.files }]
          : []),
        ...(appsConfigEnabled && isFeatureEnabled('sidebarAppsEnabled')
          ? [{ id: 'sidebar_apps' as Tab, label: t('tabs.sidebar_apps'), icon: tabIcons.sidebar_apps }]
          : []),
        ...pluginSettingsOffers.map((offer): SubTabDef => ({
          id: `plugin:${offer.pluginId}` as PluginTabId,
          label: getActivePlugin(offer.pluginId)?.plugin.name ?? offer.pluginId,
          icon: Puzzle,
        })),
      ],
    },
    {
      id: 'notifications',
      label: t('hubs.notifications'),
      subtitle: t('hubs.notifications_subtitle'),
      icon: Bell,
      subTabs: [
        { id: 'notifications', label: t('tabs.notifications'), icon: tabIcons.notifications },
      ],
    },
    {
      id: 'advanced',
      label: t('hubs.advanced'),
      subtitle: t('hubs.advanced_subtitle'),
      icon: SettingsIcon,
      subTabs: [
        { id: 'about_data', label: t('tabs.about_data'), icon: tabIcons.about_data },
        { id: 'content_senders', label: t('tabs.content_senders'), icon: tabIcons.content_senders },
        ...(IS_LITE
          ? []
          : [{ id: 'protocol_handlers' as Tab, label: t('tabs.protocol_handlers'), icon: tabIcons.protocol_handlers }]),
        ...(isFeatureEnabled('pluginsEnabled')
          ? [{ id: 'plugins' as Tab, label: 'Plugins', icon: tabIcons.plugins }]
          : []),
        ...(isFeatureEnabled('debugModeEnabled')
          ? [{ id: 'debug' as Tab, label: t('tabs.debug'), icon: tabIcons.debug }]
          : []),
      ],
    },
  ], [
    t,
    stalwartFeaturesEnabled,
    passwordSecurityEnabled,
    byomcEnabled,
    isFeatureEnabled,
    supportsVacation,
    supportsSieve,
    calendarConfigEnabled,
    supportsCalendar,
    contactsConfigEnabled,
    supportsContacts,
    filesConfigEnabled,
    supportsFiles,
    appsConfigEnabled,
    pluginSettingsOffers,
  ]);

  // In scoped (shared-account) mode, restrict to the account-relevant tabs the
  // account actually advertises. Folders is intentionally excluded (mailbox CRUD
  // is hardwired to the active account). Gated on both the per-account
  // capability and the session-level support/feature flags.
  const scopedTabIds: Tab[] = useMemo(() => {
    if (!managedAccount) return [];
    return [
      managedAccount.capabilities.sieve && supportsSieve ? 'filters' : null,
      managedAccount.capabilities.mail && supportsVacation ? 'vacation' : null,
      managedAccount.capabilities.calendars && calendarConfigEnabled && supportsCalendar && isFeatureEnabled('calendarEnabled') ? 'calendar' : null,
      managedAccount.capabilities.contacts && contactsConfigEnabled && supportsContacts && isFeatureEnabled('contactsEnabled') ? 'contacts' : null,
    ].filter(Boolean) as Tab[];
  }, [
    managedAccount,
    supportsSieve,
    supportsVacation,
    calendarConfigEnabled,
    supportsCalendar,
    isFeatureEnabled,
    contactsConfigEnabled,
    supportsContacts,
  ]);

  const visibleHubs = useMemo(() => {
    return hubs
      .map((hub) => ({
        ...hub,
        subTabs: managedAccountId
          ? hub.subTabs.filter((sub) => scopedTabIds.includes(sub.id as Tab))
          : hub.subTabs,
      }))
      .filter((hub) => hub.subTabs.length > 0);
  }, [hubs, managedAccountId, scopedTabIds]);

  const allVisibleSubTabs = useMemo(() => {
    return visibleHubs.flatMap((h) => h.subTabs);
  }, [visibleHubs]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const searchMatchingSubTabs = useMemo(() => {
    if (!trimmedQuery) return [];
    return allVisibleSubTabs.filter((sub) => {
      if (sub.label.toLowerCase().includes(trimmedQuery)) return true;
      return tabSearchHaystacks[sub.id as Tab]?.includes(trimmedQuery) ?? false;
    });
  }, [trimmedQuery, allVisibleSubTabs, tabSearchHaystacks]);

  const subResultsForTab = (tabId: SettingsTabId): SubResult[] => {
    if (!trimmedQuery) return [];
    const list = tabSubResults[tabId as Tab] ?? [];
    return list
      .filter((r) =>
        r.label.toLowerCase().includes(trimmedQuery) ||
        (r.description?.toLowerCase().includes(trimmedQuery) ?? false)
      )
      .slice(0, 6);
  };

  const isTabVisible = allVisibleSubTabs.some((sub) => sub.id === activeTab);
  const effectiveActiveTab: SettingsTabId = isTabVisible
    ? activeTab
    : (allVisibleSubTabs[0]?.id ?? 'appearance');

  const activeHubId = getHubForTab(effectiveActiveTab);
  const currentHub = visibleHubs.find((h) => h.id === activeHubId) ?? visibleHubs[0];

  const handleTabSelect = (tabId: SettingsTabId) => {
    setActiveTab(tabId);
    try { localStorage.setItem('settings-active-tab', tabId); } catch { /* ignore */ }
    if (!isDesktop) {
      setMobileShowContent(true);
    }
  };

  const handleHubSelect = (hub: HubDef) => {
    const isCurrentInHub = hub.subTabs.some((s) => s.id === effectiveActiveTab);
    const targetTabId = isCurrentInHub ? effectiveActiveTab : (hub.subTabs[0]?.id ?? 'appearance');
    handleTabSelect(targetTabId);
  };

  const handleSubResultSelect = (tabId: SettingsTabId, sub: SubResult) => {
    handleTabSelect(tabId);
    setPendingHighlight({ tab: tabId, label: sub.label, pluginId: sub.pluginId });
  };

  const activeTabLabel = allVisibleSubTabs.find((tab) => tab.id === effectiveActiveTab)?.label ?? '';

  if (!isAuthenticated) {
    return null;
  }

  const renderTabContent = () => {
    const CurrentHubIcon = currentHub?.icon ?? SettingsIcon;

    return (
      <>
        {managedAccountId && managedAccount && (
          <button
            type="button"
            onClick={() => {
              clearManagedAccount();
              handleTabSelect('account');
            }}
            className="flex items-center gap-2 w-full mb-4 px-3 py-2 rounded-md border border-border bg-muted/40 hover:bg-muted text-start transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{t('scoped.back')}</span>
            <span className="ms-auto text-sm font-medium truncate">
              {t('scoped.managing', { name: managedAccount.name })}
            </span>
          </button>
        )}

        {/* Hub Header */}
        <div className="mb-5 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm border border-primary/15">
              <CurrentHubIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{currentHub?.label}</h1>
              <p className="text-xs text-muted-foreground">{currentHub?.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Sub-tabs horizontal segmented bar */}
        {currentHub && currentHub.subTabs.length > 1 && (
          <div className="mb-6 pb-2 border-b border-border/50">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {currentHub.subTabs.map((subTab) => {
                const SubIcon = subTab.icon;
                const isActive = effectiveActiveTab === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    data-testid={`settings-tab-${subTab.id}`}
                    type="button"
                    onClick={() => handleTabSelect(subTab.id)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    )}
                  >
                    <SubIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{subTab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Container */}
        <div className="transition-opacity duration-200 animate-in fade-in-50">
          {(effectiveActiveTab === 'about_data' || effectiveActiveTab === 'debug') && (
            <div className="mb-6 p-4 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-foreground">{t('comail_build.banner_title')}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-wider">
                    {t('comail_build.badge')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  {t('comail_build.banner_description')}
                </p>
              </div>
              <a
                href="https://build.comail.at"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 shrink-0 shadow-sm"
              >
                <span>{t('comail_build.button')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {effectiveActiveTab === 'account' && <AccountSettings />}
          {effectiveActiveTab === 'language' && <LanguageSettings />}
          {effectiveActiveTab === 'notifications' && <NotificationSettings />}
          {effectiveActiveTab === 'appearance' && <AppearanceSettings />}
          {effectiveActiveTab === 'layout' && <LayoutSettings />}
          {effectiveActiveTab === 'reading' && <ReadingSettings />}
          {effectiveActiveTab === 'composing' && <ComposingSettings />}
          {effectiveActiveTab === 'downloads' && <DownloadsSettings />}
          {effectiveActiveTab === 'identities' && <IdentitySettings />}
          {effectiveActiveTab === 'vacation' && <VacationSettings />}
          {effectiveActiveTab === 'filters' && <FilterSettings />}
          {effectiveActiveTab === 'templates' && <TemplateSettings />}
          {effectiveActiveTab === 'folders' && <FolderSettings />}
          {effectiveActiveTab === 'keywords' && <KeywordSettings />}
          {effectiveActiveTab === 'byomc' && <ByomcSettings />}
          {effectiveActiveTab === 'security' && <AccountSecuritySettings />}
          {effectiveActiveTab === 'content_senders' && <ContentSendersSettings />}
          {effectiveActiveTab === 'calendar' && (
            managedAccountId
              ? <CalendarManagementSettings />
              : <><CalendarSettings /><div className="mt-8"><CalendarManagementSettings /></div></>
          )}
          {effectiveActiveTab === 'contacts' && (
            managedAccountId
              ? <AddressBookManagementSettings />
              : <><ContactsSettings /><div className="mt-8"><AddressBookManagementSettings /></div></>
          )}
          {effectiveActiveTab === 'files' && <FilesSettingsComponent />}
          {effectiveActiveTab === 'protocol_handlers' && <ProtocolHandlerSettings supportsCalendar={supportsCalendar} />}
          {effectiveActiveTab === 'sidebar_apps' && <SidebarAppsSettings />}
          {effectiveActiveTab === 'about_data' && <AboutDataSettings />}
          {effectiveActiveTab === 'themes' && <ThemesSettings />}
          {effectiveActiveTab === 'plugins' && <PluginsSettings />}
          {effectiveActiveTab === 'debug' && <DebugSettings />}
          {effectiveActiveTab.startsWith('plugin:') && (
            <PluginIframeSlot
              key={effectiveActiveTab}
              pluginId={effectiveActiveTab.slice('plugin:'.length)}
              slot="settings-section"
            />
          )}
        </div>
      </>
    );
  };

  // Mobile layout
  if (!isDesktop) {
    if (mobileShowContent) {
      return (
        <div className={cn("flex flex-col bg-background pt-[env(safe-area-inset-top)]", isEmbedded ? "h-full" : "h-dvh")}>
          <AppTopBannerSlot />
          <div className="flex items-center gap-2 px-4 h-14 border-b border-border bg-background shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="h-10 w-10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-lg truncate">{activeTabLabel}</h1>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div key={effectiveActiveTab} className="animate-spring-fade-in">
              {renderTabContent()}
            </div>
          </div>

          {!isEmbedded && (
            <NavigationRail
              orientation="horizontal"
              onManageApps={handleManageApps}
              onInlineApp={handleInlineApp}
              onCloseInlineApp={closeInlineApp}
              activeAppId={inlineApp?.id ?? null}
            />
          )}
          <SidebarAppsModal isOpen={showAppsModal} onClose={closeAppsModal} />
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col bg-background pt-[env(safe-area-inset-top)]", isEmbedded ? "h-full" : "h-dvh")}>
        <AppTopBannerSlot />
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="h-10 w-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            <h1 className="font-semibold text-lg">{t('title')}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_placeholder')}
                className="ps-9 pe-9 h-10"
                aria-label={t('search_placeholder')}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted"
                  aria-label={t('search_clear')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="py-2">
            {trimmedQuery ? (
              <div>
                {searchMatchingSubTabs.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-muted-foreground text-center">
                    {t('search_no_results')}
                  </div>
                ) : (
                  searchMatchingSubTabs.map((subTab) => {
                    const Icon = subTab.icon;
                    const subs = subResultsForTab(subTab.id);
                    return (
                      <div key={subTab.id}>
                        <button
                          data-testid={`settings-tab-${subTab.id}`}
                          onClick={() => handleTabSelect(subTab.id)}
                          className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-foreground hover:bg-muted transition-colors duration-150"
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            {subTab.label}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {subs.map((sub) => (
                          <button
                            key={`${subTab.id}:${sub.label}`}
                            onClick={() => handleSubResultSelect(subTab.id, sub)}
                            className="w-full flex items-center ps-12 pe-5 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 text-start"
                          >
                            <span className="truncate">{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-1.5 px-3">
                {visibleHubs.map((hub) => {
                  const HubIcon = hub.icon;
                  const isActive = activeHubId === hub.id;
                  return (
                    <button
                      key={hub.id}
                      data-testid={`settings-hub-${hub.id}`}
                      onClick={() => handleHubSelect(hub)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-150 text-start group",
                        isActive
                          ? "bg-primary/10 border border-primary/25 text-foreground shadow-xs"
                          : "hover:bg-muted text-foreground/90 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground"
                          )}
                        >
                          <HubIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{hub.label}</span>
                            {hub.subTabs.length > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                {hub.subTabs.length}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{hub.subtitle}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ms-2" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comail Build promotion card on mobile */}
          <div className="px-4 py-2">
            <a
              href="https://build.comail.at"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-muted/40 hover:border-primary/40 transition-all duration-150 group shadow-xs"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-foreground">{t('comail_build.title')}</span>
                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-primary/20 text-primary uppercase">
                    {t('comail_build.badge')}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t('comail_build.subtitle')}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
            </a>
          </div>

          <div className="border-t border-border px-5 py-3">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 py-2.5 text-sm text-destructive hover:bg-muted rounded-md px-2 transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              <span>{tSidebar('sign_out')}</span>
            </button>
          </div>
        </div>

        {!isEmbedded && (
          <NavigationRail
            orientation="horizontal"
            onManageApps={handleManageApps}
            onInlineApp={handleInlineApp}
            onCloseInlineApp={closeInlineApp}
            activeAppId={inlineApp?.id ?? null}
          />
        )}
        <SidebarAppsModal isOpen={showAppsModal} onClose={closeAppsModal} />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={cn("flex flex-col pt-[env(safe-area-inset-top)]", mvShell ? "bg-[var(--mv-canvas)]" : "bg-background", isEmbedded ? "h-full" : "h-dvh")}>
      <AppTopBannerSlot />
      {mvShell && (
        <MvTopBar
          showMenuButton={false}
          onManageApps={handleManageApps}
          onInlineApp={handleInlineApp}
          onCloseInlineApp={closeInlineApp}
          activeAppId={inlineApp?.id ?? null}
        />
      )}
      <div data-mv-card={mvShell ? "" : undefined} className={cn("flex flex-1 min-h-0", mvShell && "mb-4 mx-4")}>
      {!isEmbedded && !mvShell && (
        <div className="w-14 bg-secondary flex flex-col flex-shrink-0" style={{ borderRight: '1px solid rgba(128, 128, 128, 0.3)' }}>
          <NavigationRail
            collapsed
            quota={quota}
            isPushConnected={isPushConnected}
            onLogout={logout}
            onManageApps={handleManageApps}
            onInlineApp={handleInlineApp}
            onCloseInlineApp={closeInlineApp}
            activeAppId={inlineApp?.id ?? null}
          />
        </div>
      )}

      {inlineApp && (
        <InlineAppView apps={loadedApps} activeAppId={inlineApp!.id} onClose={closeInlineApp} className="flex-1" />
      )}
      {!inlineApp && (
      <>
      <div
        className={cn(
          "border-e border-border bg-secondary flex flex-col",
          !isResizing && "transition-[width] duration-300"
        )}
        style={{ width: `${settingsSidebarWidth}px` }}
      >
        {!proInterface && (
          <div className="p-4 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="w-full justify-start"
            >
              <ArrowLeft className="w-4 h-4 me-2" />
              {t('back_to_mail')}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2" data-tour="settings-tabs">
          <div className="px-3 pt-1 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_placeholder')}
                className="ps-8 pe-8 h-9 text-sm"
                aria-label={t('search_placeholder')}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-muted-foreground hover:bg-muted"
                  aria-label={t('search_clear')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="px-2 space-y-1">
            {trimmedQuery ? (
              <div className="space-y-0.5">
                {searchMatchingSubTabs.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                    {t('search_no_results')}
                  </div>
                ) : (
                  searchMatchingSubTabs.map((subTab) => {
                    const Icon = subTab.icon;
                    const subs = subResultsForTab(subTab.id);
                    return (
                      <div key={subTab.id}>
                        <button
                          data-testid={`settings-tab-${subTab.id}`}
                          onClick={() => handleTabSelect(subTab.id)}
                          className={cn(
                            'w-full text-start px-3 py-2 rounded-lg text-sm transition-colors duration-150 flex items-center gap-2.5',
                            effectiveActiveTab === subTab.id
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'hover:bg-muted text-foreground'
                          )}
                        >
                          <Icon className={cn(
                            'w-4 h-4 shrink-0',
                            effectiveActiveTab === subTab.id ? 'text-accent-foreground' : 'text-muted-foreground'
                          )} />
                          <span className="truncate">{subTab.label}</span>
                        </button>
                        {subs.map((sub) => (
                          <button
                            key={`${subTab.id}:${sub.label}`}
                            onClick={() => handleSubResultSelect(subTab.id, sub)}
                            className="w-full text-start ps-9 pe-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
                          >
                            <span className="truncate block">{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {visibleHubs.map((hub) => {
                  const HubIcon = hub.icon;
                  const isCurrentHub = activeHubId === hub.id;
                  return (
                    <div key={hub.id} className="space-y-0.5">
                      <button
                        data-testid={`settings-hub-${hub.id}`}
                        onClick={() => handleHubSelect(hub)}
                        className={cn(
                          "w-full text-start px-2.5 py-2 rounded-xl text-sm transition-all duration-150 flex items-center justify-between group",
                          isCurrentHub
                            ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                            : "hover:bg-muted/80 text-foreground/85 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                              isCurrentHub
                                ? "bg-primary text-primary-foreground shadow-2xs"
                                : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground"
                            )}
                          >
                            <HubIcon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-semibold tracking-tight truncate">{hub.label}</span>
                        </div>
                        {hub.subTabs.length > 1 && (
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                              isCurrentHub
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {hub.subTabs.length}
                          </span>
                        )}
                      </button>

                      {isCurrentHub && (
                        <div className="ms-4 ps-2.5 my-1 space-y-0.5 border-s border-border/70 animate-in fade-in-50 duration-150">
                          {hub.subTabs.map((subTab) => {
                            const SubIcon = subTab.icon;
                            const isSubActive = effectiveActiveTab === subTab.id;
                            return (
                              <button
                                key={subTab.id}
                                data-testid={`settings-tab-${subTab.id}`}
                                onClick={() => handleTabSelect(subTab.id)}
                                className={cn(
                                  "w-full text-start px-2 py-1.5 rounded-lg text-xs transition-colors duration-150 flex items-center gap-2",
                                  isSubActive
                                    ? "bg-accent text-accent-foreground font-semibold shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                              >
                                <SubIcon className={cn(
                                  "w-3.5 h-3.5 shrink-0",
                                  isSubActive ? "text-accent-foreground" : "text-muted-foreground"
                                )} />
                                <span className="truncate">{subTab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Comail Build card footer */}
        <div className="p-3 border-t border-border mt-auto shrink-0">
          <a
            href="https://build.comail.at"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-muted/40 hover:border-primary/40 transition-all duration-150 group shadow-2xs"
          >
            <div className="min-w-0 pr-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground truncate">{t('comail_build.title')}</span>
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-primary/20 text-primary uppercase">
                  {t('comail_build.badge')}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t('comail_build.subtitle')}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
          </a>
        </div>
      </div>

      <ResizeHandle
        onResizeStart={() => { dragStartWidth.current = settingsSidebarWidth; setIsResizing(true); }}
        onResize={(delta) => setSettingsSidebarWidth(Math.max(180, Math.min(400, dragStartWidth.current + delta)))}
        onResizeEnd={() => {
          setIsResizing(false);
          localStorage.setItem('settings-sidebar-width', String(settingsSidebarWidth));
        }}
        onDoubleClick={() => { setSettingsSidebarWidth(256); localStorage.setItem('settings-sidebar-width', '256'); }}
      />

      <div ref={attachContentScroll} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {currentHub && (
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                  <currentHub.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{currentHub.label}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{currentHub.subtitle}</p>
                </div>
              </div>

              {currentHub.subTabs.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
                  {currentHub.subTabs.map((subTab) => {
                    const SubIcon = subTab.icon;
                    const isSubActive = effectiveActiveTab === subTab.id;
                    return (
                      <button
                        key={subTab.id}
                        data-testid={`settings-pill-${subTab.id}`}
                        onClick={() => handleTabSelect(subTab.id)}
                        className={cn(
                          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all transition-spring whitespace-nowrap",
                          isSubActive
                            ? "bg-background text-foreground shadow-2xs font-semibold ring-1 ring-border/60"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                      >
                        <SubIcon className={cn("w-3.5 h-3.5 shrink-0", isSubActive ? "text-primary" : "text-muted-foreground")} />
                        <span>{subTab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div key={effectiveActiveTab} className="animate-spring-fade-in">
            {renderTabContent()}
          </div>
        </div>
      </div>
      </>
      )}
      <SidebarAppsModal isOpen={showAppsModal} onClose={closeAppsModal} />
      </div>
    </div>
  );
}
