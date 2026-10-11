import { useAccountStore } from '@/stores/account-store';

export function getComailAccountHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const { activeAccountId, accounts } = useAccountStore.getState();
    const active = accounts.find((a) => a.id === activeAccountId) || accounts[0];
    if (active) {
      return {
        'x-comail-account-id': active.id,
        'x-comail-account-email': active.email || active.username || '',
      };
    }
  } catch {
    // fail-open
  }
  return {};
}
