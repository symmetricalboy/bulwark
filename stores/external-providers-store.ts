import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ExternalProviderId = 'microsoft' | 'apple' | 'nextcloud';

export interface ExternalServiceToggles {
  mail?: boolean;
  calendar?: boolean;
  tasks?: boolean;
  contacts?: boolean;
  drive?: boolean;
}

export interface ExternalConnectedAccount {
  id: string;
  provider: ExternalProviderId;
  email: string;
  name?: string;
  serverUrl?: string;
  connectedAt: number;
  services: ExternalServiceToggles;
  comailAccountId?: string;
}

interface ExternalProvidersState {
  accounts: ExternalConnectedAccount[];
  addAccount: (account: Omit<ExternalConnectedAccount, 'id' | 'connectedAt'> & { id?: string }) => void;
  removeAccount: (id: string) => void;
  updateAccountServices: (id: string, services: Partial<ExternalServiceToggles>) => void;
  getAccountsByProvider: (provider: ExternalProviderId) => ExternalConnectedAccount[];
}

export const useExternalProvidersStore = create<ExternalProvidersState>()(
  persist(
    (set, get) => ({
      accounts: [],
      addAccount: (entry) => {
        const id = entry.id || `${entry.provider}-${entry.email}`;
        const newAccount: ExternalConnectedAccount = {
          ...entry,
          id,
          connectedAt: Date.now(),
        };
        set((state) => ({
          accounts: [...state.accounts.filter((a) => a.id !== id), newAccount],
        }));
      },
      removeAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        }));
      },
      updateAccountServices: (id, services) => {
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, services: { ...a.services, ...services } } : a
          ),
        }));
      },
      getAccountsByProvider: (provider) => {
        return get().accounts.filter((a) => a.provider === provider);
      },
    }),
    {
      name: 'comail-external-providers',
    }
  )
);
