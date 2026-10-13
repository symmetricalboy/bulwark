import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Identity } from '@/lib/jmap/types';

// Constants for sub-addressing limits
const MAX_RECENT_TAGS = 10;
const MAX_DOMAIN_SUGGESTIONS = 5;

interface SubAddressState {
  recentTags: string[];
  tagSuggestions: Record<string, string[]>;
}

interface IdentityStore {
  // Identity state (unified for UI)
  identities: Identity[];
  customIdentities: Identity[];
  googleDefaultIdentities: Identity[];
  selectedIdentityId: string | null;
  preferredPrimaryId: string | null;
  isLoading: boolean;
  error: string | null;

  // Sub-addressing state (persisted locally)
  subAddress: SubAddressState;

  // Actions - Identity CRUD
  setIdentities: (identities: Identity[]) => void;
  setCustomIdentities: (identities: Identity[]) => void;
  addCustomIdentity: (identity: Identity) => void;
  updateCustomIdentity: (identityId: string, updates: Partial<Identity>) => void;
  removeCustomIdentity: (identityId: string) => void;
  setGoogleDefaultIdentities: (identities: Identity[]) => void;
  addIdentity: (identity: Identity) => void;
  updateIdentityLocal: (identityId: string, updates: Partial<Identity>) => void;
  removeIdentity: (identityId: string) => void;
  selectIdentity: (identityId: string | null) => void;
  setPreferredPrimary: (identityId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearIdentities: () => void;

  // Sub-addressing actions
  addRecentTag: (tag: string) => void;
  addTagSuggestion: (domain: string, tag: string) => void;
  getTagSuggestionsForDomain: (domain: string) => string[];
  clearRecentTags: () => void;
}

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set, get) => ({
      identities: [],
      customIdentities: [],
      googleDefaultIdentities: [],
      selectedIdentityId: null,
      preferredPrimaryId: null,
      isLoading: false,
      error: null,
      subAddress: {
        recentTags: [],
        tagSuggestions: {},
      },

      setIdentities: (serverIdentities) => set((state) => {
        // Enforce mayDelete: false on the primary Comail account identity
        const normalizedServer = serverIdentities.map((id, index) => {
          if (index === 0 || id.id === state.preferredPrimaryId) {
            return { ...id, mayDelete: false };
          }
          return id;
        });

        // Merge in Google default identities and custom identities
        const combined = [...normalizedServer];
        for (const g of state.googleDefaultIdentities) {
          if (!combined.some(i => i.id === g.id || i.email.toLowerCase() === g.email.toLowerCase())) {
            combined.push(g);
          }
        }
        for (const c of state.customIdentities) {
          if (!combined.some(i => i.id === c.id)) {
            combined.push(c);
          }
        }
        return { identities: combined };
      }),

      setCustomIdentities: (customIdentities) => set({ customIdentities }),

      addCustomIdentity: (identity) => set((state) => {
        const nextCustom = [...state.customIdentities, identity];
        const existsInAll = state.identities.some(i => i.id === identity.id);
        return {
          customIdentities: nextCustom,
          identities: existsInAll ? state.identities : [...state.identities, identity],
        };
      }),

      updateCustomIdentity: (identityId, updates) => set((state) => ({
        customIdentities: state.customIdentities.map(id =>
          id.id === identityId ? { ...id, ...updates } : id
        ),
        identities: state.identities.map(id =>
          id.id === identityId ? { ...id, ...updates } : id
        ),
      })),

      removeCustomIdentity: (identityId) => set((state) => ({
        customIdentities: state.customIdentities.filter(id => id.id !== identityId),
        identities: state.identities.filter(id => id.id !== identityId),
        selectedIdentityId: state.selectedIdentityId === identityId
          ? null
          : state.selectedIdentityId,
      })),

      setGoogleDefaultIdentities: (googleDefaultIdentities) => set((state) => {
        const nonGoogle = state.identities.filter(
          i => !i.id.startsWith('google') && !googleDefaultIdentities.some(g => g.email.toLowerCase() === i.email.toLowerCase())
        );
        return {
          googleDefaultIdentities,
          identities: [...nonGoogle, ...googleDefaultIdentities],
        };
      }),

      addIdentity: (identity) => set((state) => ({
        identities: [...state.identities, identity]
      })),

      updateIdentityLocal: (identityId, updates) => set((state) => ({
        identities: state.identities.map(id =>
          id.id === identityId ? { ...id, ...updates } : id
        ),
        customIdentities: state.customIdentities.map(id =>
          id.id === identityId ? { ...id, ...updates } : id
        ),
        googleDefaultIdentities: state.googleDefaultIdentities.map(id =>
          id.id === identityId ? { ...id, ...updates } : id
        ),
      })),

      removeIdentity: (identityId) => set((state) => ({
        identities: state.identities.filter(id => id.id !== identityId),
        customIdentities: state.customIdentities.filter(id => id.id !== identityId),
        googleDefaultIdentities: state.googleDefaultIdentities.filter(id => id.id !== identityId),
        selectedIdentityId: state.selectedIdentityId === identityId
          ? null
          : state.selectedIdentityId
      })),

      selectIdentity: (identityId) => set({ selectedIdentityId: identityId }),

      setPreferredPrimary: (identityId) => set({ preferredPrimaryId: identityId }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearIdentities: () => set({
        identities: [],
        selectedIdentityId: null,
        error: null,
      }),

      addRecentTag: (tag) => set((state) => {
        const recent = [tag, ...state.subAddress.recentTags.filter(t => t !== tag)];
        return {
          subAddress: {
            ...state.subAddress,
            recentTags: recent.slice(0, MAX_RECENT_TAGS),
          }
        };
      }),

      addTagSuggestion: (domain, tag) => set((state) => {
        const suggestions = { ...state.subAddress.tagSuggestions };
        const existing = suggestions[domain] || [];
        if (!existing.includes(tag)) {
          suggestions[domain] = [...existing, tag].slice(0, MAX_DOMAIN_SUGGESTIONS);
        }
        return {
          subAddress: {
            ...state.subAddress,
            tagSuggestions: suggestions,
          }
        };
      }),

      getTagSuggestionsForDomain: (domain) => {
        return get().subAddress.tagSuggestions[domain] || [];
      },

      clearRecentTags: () => set((state) => ({
        subAddress: {
          ...state.subAddress,
          recentTags: [],
        }
      })),
    }),
    {
      name: 'identity-storage',
      // Persist sub-addressing data, preferred primary sender identity, and custom/Google identities
      partialize: (state) => ({
        subAddress: state.subAddress,
        preferredPrimaryId: state.preferredPrimaryId,
        customIdentities: state.customIdentities,
        googleDefaultIdentities: state.googleDefaultIdentities,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const combined = [...state.identities];
          for (const g of (state.googleDefaultIdentities || [])) {
            if (!combined.some(i => i.id === g.id || i.email.toLowerCase() === g.email.toLowerCase())) {
              combined.push(g);
            }
          }
          for (const c of (state.customIdentities || [])) {
            if (!combined.some(i => i.id === c.id)) {
              combined.push(c);
            }
          }
          state.setIdentities(combined);
        }
      },
    }
  )
);

export async function syncGoogleIdentities(): Promise<Identity[]> {
  try {
    const { getGoogleStatus } = await import('@/lib/google/google-calendar-client');
    const status = await getGoogleStatus().catch(() => ({ connected: false, accounts: [] }));
    if (!status?.accounts?.length) {
      return [];
    }
    const store = useIdentityStore.getState();
    const existingGoogle = store.googleDefaultIdentities || [];
    const nextGoogle: Identity[] = [];

    for (const acc of status.accounts) {
      if (!acc.email) continue;
      const id = `google-default:${acc.id || acc.email}`;
      const existing = existingGoogle.find(g => g.id === id || g.email.toLowerCase() === acc.email.toLowerCase());
      nextGoogle.push({
        id,
        name: existing?.name || acc.name || acc.email,
        email: acc.email,
        replyTo: existing?.replyTo || undefined,
        bcc: existing?.bcc || undefined,
        textSignature: existing?.textSignature || '',
        htmlSignature: existing?.htmlSignature || '',
        mayDelete: false,
        localAccountId: `google:${acc.id || acc.email}`,
        accountName: acc.name ? `${acc.name} (Google)` : `Google (${acc.email})`,
      });
    }

    store.setGoogleDefaultIdentities(nextGoogle);
    return nextGoogle;
  } catch {
    return [];
  }
}
