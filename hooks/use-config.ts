"use client";

import { useState, useEffect } from 'react';
import { usePolicyStore } from '@/stores/policy-store';
import { useAccountStore } from '@/stores/account-store';
import { apiFetch } from '@/lib/browser-navigation';
import type { PublicJmapServerEntry } from '@/lib/admin/jmap-servers';
import { IS_LITE, IS_LITE_STALWART, LITE_CONFIG_PATH, withLiteBuildId } from '@/lib/lite';
import { applyLiteConfig, liteStalwartDefaults } from '@/lib/lite-config';
import { isConfigData } from '@/lib/config-validation';

export interface ConfigData {
  appName: string;
  jmapServerUrl: string;
  oauthEnabled: boolean;
  oauthOnly: boolean;
  oauthClientId: string;
  oauthIssuerUrl: string;
  oauthScopes: string;
  rememberMeEnabled: boolean;
  settingsSyncEnabled: boolean;
  stalwartFeaturesEnabled: boolean;
  identityManagementEnabled: boolean;
  stalwartJmapPassthroughEnabled: boolean;
  devMode: boolean;
  faviconUrl: string;
  appLogoLightUrl: string;
  appLogoDarkUrl: string;
  loginLogoLightUrl: string;
  loginLogoDarkUrl: string;
  loginCompanyName: string;
  loginImprintUrl: string;
  loginPrivacyPolicyUrl: string;
  loginWebsiteUrl: string;
  loginLogoMaxHeight: string;
  loginLogoMaxWidth: string;
  loginShowHeading: boolean;
  loginShowSubtitle: boolean;
  loginShowTotp: boolean;
  loginShowTokenLogin: boolean;
  loginShowVersion: boolean;
  demoMode: boolean;
  calendarEnabled: boolean;
  contactsEnabled: boolean;
  filesEnabled: boolean;
  appsEnabled: boolean;
  // atproto-SSO surface gates. Default ON for vanilla
  // deployments; Comail sets both to false to hide the password-change /
  // S/MIME certificate settings surfaces for atproto-SSO members.
  passwordSecurityEnabled: boolean;
  smimeEnabled: boolean;
  autoSsoEnabled: boolean;
  atprotoLoginUrl: string;
  allowCustomJmapEndpoint: boolean;
  jmapServers: PublicJmapServerEntry[];
  jmapServerAutoPickByDomain: boolean;
  embeddedMode: boolean;
  parentOrigin: string;
  byomcEnabled: boolean;
  byomcImapHost: string;
  byomcSmtpHost: string;
  byomcAppPasswordApiUrl: string;
  buildersEnabled: boolean;
  sourceCodeUrl: string;
}

interface AppConfig extends ConfigData {
  isLoading: boolean;
  error: string | null;
}

let configCache: ConfigData | null = null;
let configSlot: number | null = null;
let configAccountId: string | null = null;

function activeConfigSlot(): number {
  return useAccountStore.getState().getActiveAccount()?.cookieSlot ?? 0;
}

function activeConfigAccountId(): string | null {
  return useAccountStore.getState().activeAccountId ?? null;
}
let configPromise: Promise<ConfigData> | null = null;

/**
 * Static Lite build: the deployer-edited config.json next to index.html
 * replaces /api/config. A missing or broken file falls back to the defaults
 * (custom endpoint allowed) so an unedited download still lets people sign in.
 */
async function fetchLiteConfig(): Promise<ConfigData> {
  // On Stalwart the bundle is read-only and served from the JMAP origin:
  // config.json ships inside the zip (build-id URL, immutable cache) and an
  // empty server URL means "this origin".
  const defaults = IS_LITE_STALWART ? liteStalwartDefaults() : undefined;
  try {
    const res = await apiFetch(withLiteBuildId(LITE_CONFIG_PATH), IS_LITE_STALWART ? undefined : { cache: 'no-store' });
    if (!res.ok) throw new Error(`config.json answered ${res.status}`);
    return applyLiteConfig(await res.json(), defaults);
  } catch (err) {
    console.warn('[lite] config.json missing or invalid, using defaults:', err);
    return applyLiteConfig({}, defaults);
  }
}

const CONFIG_ATTEMPT_DELAYS_MS = [0, 500, 1500] as const;
const CONFIG_TIMEOUT_MS = 10000;

async function fetchServerConfig(slot: number): Promise<ConfigData> {
  let lastError: unknown;
  for (const delay of CONFIG_ATTEMPT_DELAYS_MS) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    const controller = new AbortController();
    // Keep the timeout active while reading the body, not only the headers.
    const timeout = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
    try {
      const response = await apiFetch('/api/config', {
        cache: 'no-store',
        headers: { 'X-JMAP-Cookie-Slot': String(slot) },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Failed to fetch config (${response.status})`);
      const data: unknown = await response.json();
      if (!isConfigData(data)) {
        throw new Error('Invalid application configuration');
      }
      return data;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

/** Test hook: forget the cached config so the next fetch hits the network again. */
export function resetConfigCache(): void {
  configCache = null;
  configPromise = null;
  configSlot = null;
  configAccountId = null;
}

export async function fetchConfig(): Promise<ConfigData> {
  const slot = activeConfigSlot();
  const accountId = activeConfigAccountId();
  if (configSlot !== slot || configAccountId !== accountId) {
    resetConfigCache();
    configSlot = slot;
    configAccountId = accountId;
  }
  // Return cached config if available
  if (configCache) {
    return configCache;
  }

  // If a fetch is already in progress, wait for it
  if (configPromise) {
    return configPromise;
  }

  // Start a new fetch
  configPromise = (IS_LITE ? fetchLiteConfig() : fetchServerConfig(slot))
    .then((data) => {
      if (configSlot === slot && configAccountId === accountId) configCache = data;
      // Fetch admin policy alongside config (non-blocking)
      usePolicyStore.getState().fetchPolicy();
      return data;
    })
    .finally(() => {
      if (configSlot === slot && configAccountId === accountId) configPromise = null;
    });

  return configPromise;
}

/**
 * Hook to fetch runtime configuration
 *
 * Fetches app configuration from /api/config endpoint, which reads
 * environment variables at runtime (not build time).
 *
 * The config is cached after first fetch to avoid unnecessary requests.
 */
export function useConfig(): AppConfig {
  const slot = useAccountStore(state => state.getActiveAccount()?.cookieSlot ?? 0);
  const accountId = useAccountStore(state => state.activeAccountId);
  const isCacheValid = Boolean(configCache && configSlot === slot && configAccountId === (accountId ?? null));
  const activeCache = isCacheValid ? configCache : null;
  const [config, setConfig] = useState<AppConfig>({
    appName: activeCache?.appName || 'Webmail',
    jmapServerUrl: activeCache?.jmapServerUrl || '',
    oauthEnabled: activeCache?.oauthEnabled || false,
    oauthOnly: activeCache?.oauthOnly || false,
    oauthClientId: activeCache?.oauthClientId || '',
    oauthIssuerUrl: activeCache?.oauthIssuerUrl || '',
    oauthScopes: activeCache?.oauthScopes || '',
    rememberMeEnabled: activeCache?.rememberMeEnabled || false,
    settingsSyncEnabled: activeCache?.settingsSyncEnabled || false,
    stalwartFeaturesEnabled: activeCache?.stalwartFeaturesEnabled ?? true,
    identityManagementEnabled: activeCache?.identityManagementEnabled ?? true,
    stalwartJmapPassthroughEnabled: activeCache?.stalwartJmapPassthroughEnabled ?? true,
    devMode: activeCache?.devMode || false,
    faviconUrl: activeCache?.faviconUrl || '/branding/comail/comail-favicon.png',
    appLogoLightUrl: activeCache?.appLogoLightUrl || '/branding/comail/cammie-mark.png',
    appLogoDarkUrl: activeCache?.appLogoDarkUrl || '/branding/comail/cammie-mark.png',
    loginLogoLightUrl: activeCache?.loginLogoLightUrl || '/branding/comail/cammie-mark.png',
    loginLogoDarkUrl: activeCache?.loginLogoDarkUrl || '/branding/comail/cammie-mark.png',
    loginCompanyName: activeCache?.loginCompanyName || '',
    loginImprintUrl: activeCache?.loginImprintUrl || '',
    loginPrivacyPolicyUrl: activeCache?.loginPrivacyPolicyUrl || '',
    loginWebsiteUrl: activeCache?.loginWebsiteUrl || '',
    loginLogoMaxHeight: activeCache?.loginLogoMaxHeight || '',
    loginLogoMaxWidth: activeCache?.loginLogoMaxWidth || '',
    loginShowHeading: activeCache?.loginShowHeading ?? true,
    loginShowSubtitle: activeCache?.loginShowSubtitle ?? true,
    loginShowTotp: activeCache?.loginShowTotp ?? true,
    loginShowTokenLogin: activeCache?.loginShowTokenLogin ?? false,
    loginShowVersion: activeCache?.loginShowVersion ?? true,
    demoMode: activeCache?.demoMode || false,
    calendarEnabled: activeCache?.calendarEnabled || false,
    contactsEnabled: activeCache?.contactsEnabled || false,
    filesEnabled: activeCache?.filesEnabled || false,
    appsEnabled: activeCache?.appsEnabled || false,
    passwordSecurityEnabled: activeCache?.passwordSecurityEnabled ?? true,
    smimeEnabled: activeCache?.smimeEnabled ?? true,
    autoSsoEnabled: activeCache?.autoSsoEnabled || false,
    atprotoLoginUrl: activeCache?.atprotoLoginUrl || '',
    allowCustomJmapEndpoint: activeCache?.allowCustomJmapEndpoint || false,
    jmapServers: activeCache?.jmapServers || [],
    jmapServerAutoPickByDomain: activeCache?.jmapServerAutoPickByDomain || false,
    embeddedMode: activeCache?.embeddedMode || false,
    parentOrigin: activeCache?.parentOrigin || '',
    byomcEnabled: activeCache?.byomcEnabled || false,
    byomcImapHost: activeCache?.byomcImapHost || '',
    byomcSmtpHost: activeCache?.byomcSmtpHost || '',
    byomcAppPasswordApiUrl: activeCache?.byomcAppPasswordApiUrl || '',
    buildersEnabled: activeCache?.buildersEnabled || false,
    sourceCodeUrl: activeCache?.sourceCodeUrl || '',
    isLoading: !activeCache,
    error: null,
  });

  useEffect(() => {
    // If already cached, no need to fetch
    if (configCache && configSlot === slot && configAccountId === (accountId ?? null)) {
      setConfig({
        appName: configCache.appName,
        jmapServerUrl: configCache.jmapServerUrl,
        oauthEnabled: configCache.oauthEnabled,
        oauthOnly: configCache.oauthOnly,
        oauthClientId: configCache.oauthClientId,
        oauthIssuerUrl: configCache.oauthIssuerUrl,
        oauthScopes: configCache.oauthScopes,
        rememberMeEnabled: configCache.rememberMeEnabled,
        settingsSyncEnabled: configCache.settingsSyncEnabled,
        stalwartFeaturesEnabled: configCache.stalwartFeaturesEnabled,
        identityManagementEnabled: configCache.identityManagementEnabled ?? true,
        stalwartJmapPassthroughEnabled: configCache.stalwartJmapPassthroughEnabled,
        devMode: configCache.devMode,
        faviconUrl: configCache.faviconUrl,
        appLogoLightUrl: configCache.appLogoLightUrl,
        appLogoDarkUrl: configCache.appLogoDarkUrl,
        loginLogoLightUrl: configCache.loginLogoLightUrl,
        loginLogoDarkUrl: configCache.loginLogoDarkUrl,
        loginCompanyName: configCache.loginCompanyName,
        loginImprintUrl: configCache.loginImprintUrl,
        loginPrivacyPolicyUrl: configCache.loginPrivacyPolicyUrl,
        loginWebsiteUrl: configCache.loginWebsiteUrl,
        loginLogoMaxHeight: configCache.loginLogoMaxHeight,
        loginLogoMaxWidth: configCache.loginLogoMaxWidth,
        loginShowHeading: configCache.loginShowHeading,
        loginShowSubtitle: configCache.loginShowSubtitle,
        loginShowTotp: configCache.loginShowTotp,
        loginShowTokenLogin: configCache.loginShowTokenLogin,
        loginShowVersion: configCache.loginShowVersion,
        demoMode: configCache.demoMode,
        calendarEnabled: configCache.calendarEnabled,
        contactsEnabled: configCache.contactsEnabled,
        filesEnabled: configCache.filesEnabled,
        appsEnabled: configCache.appsEnabled,
        passwordSecurityEnabled: configCache.passwordSecurityEnabled,
        smimeEnabled: configCache.smimeEnabled,
        autoSsoEnabled: configCache.autoSsoEnabled,
        atprotoLoginUrl: configCache.atprotoLoginUrl,
        allowCustomJmapEndpoint: configCache.allowCustomJmapEndpoint,
        jmapServers: configCache.jmapServers || [],
        jmapServerAutoPickByDomain: configCache.jmapServerAutoPickByDomain || false,
        embeddedMode: configCache.embeddedMode,
        parentOrigin: configCache.parentOrigin,
        byomcEnabled: configCache.byomcEnabled,
        byomcImapHost: configCache.byomcImapHost,
        byomcSmtpHost: configCache.byomcSmtpHost,
        byomcAppPasswordApiUrl: configCache.byomcAppPasswordApiUrl,
        buildersEnabled: configCache.buildersEnabled,
        sourceCodeUrl: configCache.sourceCodeUrl,
        isLoading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    fetchConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig({
          appName: data.appName,
          jmapServerUrl: data.jmapServerUrl,
          oauthEnabled: data.oauthEnabled,
          oauthOnly: data.oauthOnly,
          oauthClientId: data.oauthClientId,
          oauthIssuerUrl: data.oauthIssuerUrl,
          oauthScopes: data.oauthScopes,
          rememberMeEnabled: data.rememberMeEnabled,
          settingsSyncEnabled: data.settingsSyncEnabled,
          stalwartFeaturesEnabled: data.stalwartFeaturesEnabled,
          identityManagementEnabled: data.identityManagementEnabled ?? true,
          stalwartJmapPassthroughEnabled: data.stalwartJmapPassthroughEnabled,
          devMode: data.devMode,
          faviconUrl: data.faviconUrl,
          appLogoLightUrl: data.appLogoLightUrl,
          appLogoDarkUrl: data.appLogoDarkUrl,
          loginLogoLightUrl: data.loginLogoLightUrl,
          loginLogoDarkUrl: data.loginLogoDarkUrl,
          loginCompanyName: data.loginCompanyName,
          loginImprintUrl: data.loginImprintUrl,
          loginPrivacyPolicyUrl: data.loginPrivacyPolicyUrl,
          loginWebsiteUrl: data.loginWebsiteUrl,
          loginLogoMaxHeight: data.loginLogoMaxHeight,
          loginLogoMaxWidth: data.loginLogoMaxWidth,
          loginShowHeading: data.loginShowHeading,
          loginShowSubtitle: data.loginShowSubtitle,
          loginShowTotp: data.loginShowTotp,
          loginShowTokenLogin: data.loginShowTokenLogin,
          loginShowVersion: data.loginShowVersion,
          demoMode: data.demoMode,
          calendarEnabled: data.calendarEnabled,
          contactsEnabled: data.contactsEnabled,
          filesEnabled: data.filesEnabled,
          appsEnabled: data.appsEnabled,
          passwordSecurityEnabled: data.passwordSecurityEnabled,
          smimeEnabled: data.smimeEnabled,
          autoSsoEnabled: data.autoSsoEnabled,
          atprotoLoginUrl: data.atprotoLoginUrl,
          allowCustomJmapEndpoint: data.allowCustomJmapEndpoint,
          jmapServers: data.jmapServers || [],
          jmapServerAutoPickByDomain: data.jmapServerAutoPickByDomain || false,
          embeddedMode: data.embeddedMode,
          parentOrigin: data.parentOrigin,
          byomcEnabled: data.byomcEnabled,
          byomcImapHost: data.byomcImapHost,
          byomcSmtpHost: data.byomcSmtpHost,
          byomcAppPasswordApiUrl: data.byomcAppPasswordApiUrl,
          buildersEnabled: data.buildersEnabled,
          sourceCodeUrl: data.sourceCodeUrl,
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setConfig((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      });
    return () => { cancelled = true; };
  }, [slot, accountId]);

  return config;
}
