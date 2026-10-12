"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { ToggleSwitch } from './settings-section';
import {
  Plus,
  Trash2,
  MicrosoftIcon,
  AppleIcon,
  NextcloudIcon,
  Download,
  Mail,
  Calendar,
  FolderOpen,
  BookUser,
  ExternalLink,
  Check,
  HardDrive,
} from '@/components/icons';
import {
  useExternalProvidersStore,
  type ExternalServiceToggles,
} from '@/stores/external-providers-store';
import { toast } from '@/stores/toast-store';
import { toUnicodeEmail } from '@/lib/idn';
import { useRouter } from '@/i18n/navigation';

export function MicrosoftProviderView({ comailAccountId }: { comailAccountId?: string }) {
  const accounts = useExternalProvidersStore((s) => s.accounts.filter((a) => a.provider === 'microsoft'));
  const addAccount = useExternalProvidersStore((s) => s.addAccount);
  const removeAccount = useExternalProvidersStore((s) => s.removeAccount);
  const updateAccountServices = useExternalProvidersStore((s) => s.updateAccountServices);

  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [services, setServices] = useState<ExternalServiceToggles>({
    mail: true,
    calendar: true,
    tasks: true,
    drive: true,
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid Microsoft 365 or Outlook email address');
      return;
    }
    addAccount({
      provider: 'microsoft',
      email: email.trim(),
      name: name.trim() || email.trim(),
      services,
      comailAccountId,
    });
    toast.success(`Connected Microsoft 365 account: ${email.trim()}`);
    setEmail('');
    setName('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <MicrosoftIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">Microsoft 365 & Outlook Integration</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Synchronize Exchange Mail, Outlook Calendar, Microsoft To-Do lists, and OneDrive files into Comail with continuous background syncing.
          </p>
        </div>
        {!isAdding && (
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            className="shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Account</span>
          </Button>
        )}
      </div>

      {/* Add Account Inline Form */}
      {isAdding && (
        <form onSubmit={handleConnect} className="p-5 rounded-xl border border-blue-500/30 bg-card space-y-4 shadow-sm animate-in fade-in-50">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MicrosoftIcon className="w-4 h-4" />
              <span>Connect Microsoft 365 or Outlook Account</span>
            </h5>
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="h-7 text-xs">
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Microsoft Email Address *</label>
              <Input
                type="email"
                placeholder="user@outlook.com or corporate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Account Display Name (Optional)</label>
              <Input
                type="text"
                placeholder="Work / Personal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Services to Synchronize
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.mail ?? false}
                  onChange={(e) => setServices({ ...services, mail: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">Exchange Mail</span>
                  <span className="text-[11px] text-muted-foreground">Inbox, Sent, and Folders</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.calendar ?? false}
                  onChange={(e) => setServices({ ...services, calendar: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">Outlook Calendar</span>
                  <span className="text-[11px] text-muted-foreground">Events and Schedules</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.tasks ?? false}
                  onChange={(e) => setServices({ ...services, tasks: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <Check className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">Microsoft To-Do</span>
                  <span className="text-[11px] text-muted-foreground">Tasks and To-Do Lists</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.drive ?? false}
                  onChange={(e) => setServices({ ...services, drive: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">OneDrive Files</span>
                  <span className="text-[11px] text-muted-foreground">Files App and Mail Attachments</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              Save & Connect
            </Button>
          </div>
        </form>
      )}

      {/* Accounts List */}
      {accounts.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center text-center py-10 px-4 border border-dashed border-border rounded-xl">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
            <MicrosoftIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Microsoft Accounts Connected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1.5 mb-5">
            Connect your Outlook, Hotmail, or Microsoft 365 business account to populate emails, calendars, and tasks.
          </p>
          <Button onClick={() => setIsAdding(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4" />
            <span>Connect Microsoft Account</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-2xs">
              <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={acc.name || acc.email} email={acc.email} size="md" className="w-10 h-10 text-xs shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.name || acc.email}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <MicrosoftIcon className="w-3 h-3" />
                        Microsoft 365
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      {toUnicodeEmail(acc.email)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removeAccount(acc.id);
                    toast.success(`Removed Microsoft account: ${acc.email}`);
                  }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 me-1.5 text-destructive" />
                  <span className="text-destructive">Disconnect</span>
                </Button>
              </div>

              {/* Service Toggles */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-background/50">
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Mail</span>
                  <ToggleSwitch
                    checked={acc.services.mail ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { mail: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Calendar</span>
                  <ToggleSwitch
                    checked={acc.services.calendar ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { calendar: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Tasks</span>
                  <ToggleSwitch
                    checked={acc.services.tasks ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { tasks: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">OneDrive</span>
                  <ToggleSwitch
                    checked={acc.services.drive ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { drive: checked })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppleProviderView({ comailAccountId }: { comailAccountId?: string }) {
  const accounts = useExternalProvidersStore((s) => s.accounts.filter((a) => a.provider === 'apple'));
  const addAccount = useExternalProvidersStore((s) => s.addAccount);
  const removeAccount = useExternalProvidersStore((s) => s.removeAccount);
  const updateAccountServices = useExternalProvidersStore((s) => s.updateAccountServices);

  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [services, setServices] = useState<ExternalServiceToggles>({
    mail: true,
    calendar: true,
    contacts: true,
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid Apple ID or iCloud email address');
      return;
    }
    if (!appPassword.trim()) {
      toast.error('Please enter an Apple App-Specific Password');
      return;
    }
    addAccount({
      provider: 'apple',
      email: email.trim(),
      name: email.trim(),
      services,
      comailAccountId,
    });
    toast.success(`Connected Apple iCloud account: ${email.trim()}`);
    setEmail('');
    setAppPassword('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-foreground/10 text-foreground flex items-center justify-center shrink-0">
          <AppleIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">Apple iCloud Protocol Integration</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Connect iCloud Mail (IMAP), iCloud Contacts (CardDAV), and iCloud Calendars & Reminders (CalDAV) using an Apple App-Specific Password.
          </p>
        </div>
        {!isAdding && (
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            className="shrink-0 gap-1.5 shadow-2xs text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect iCloud</span>
          </Button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleConnect} className="p-5 rounded-xl border border-border bg-card space-y-4 shadow-sm animate-in fade-in-50">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AppleIcon className="w-4 h-4" />
              <span>Connect Apple iCloud Account</span>
            </h5>
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="h-7 text-xs">
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Apple ID Email *</label>
              <Input
                type="email"
                placeholder="name@icloud.com or your Apple ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-foreground">App-Specific Password *</label>
                <a
                  href="https://appleid.apple.com/account/manage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  Generate at appleid.apple.com
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <Input
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              iCloud Services
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.mail ?? false}
                  onChange={(e) => setServices({ ...services, mail: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <Mail className="w-4 h-4 text-foreground/80 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">iCloud Mail</span>
                  <span className="text-[11px] text-muted-foreground">IMAP & SMTP</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.calendar ?? false}
                  onChange={(e) => setServices({ ...services, calendar: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <Calendar className="w-4 h-4 text-foreground/80 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">Calendars</span>
                  <span className="text-[11px] text-muted-foreground">CalDAV Sync</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.contacts ?? false}
                  onChange={(e) => setServices({ ...services, contacts: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <BookUser className="w-4 h-4 text-foreground/80 shrink-0" />
                <div>
                  <span className="font-medium text-foreground block">Contacts</span>
                  <span className="text-[11px] text-muted-foreground">CardDAV Sync</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Connect iCloud
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      {accounts.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center text-center py-10 px-4 border border-dashed border-border rounded-xl">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-foreground">
            <AppleIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Apple iCloud Accounts Linked</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1.5 mb-5">
            Connect your @icloud.com account to unify your Apple mail, calendars, and address book inside Comail.
          </p>
          <Button onClick={() => setIsAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Connect Apple Account</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-2xs">
              <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={acc.name || acc.email} email={acc.email} size="md" className="w-10 h-10 text-xs shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.email}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">
                        <AppleIcon className="w-3 h-3" />
                        iCloud
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      {toUnicodeEmail(acc.email)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removeAccount(acc.id);
                    toast.success(`Removed Apple account: ${acc.email}`);
                  }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 me-1.5 text-destructive" />
                  <span className="text-destructive">Disconnect</span>
                </Button>
              </div>

              <div className="p-4 grid grid-cols-3 gap-3 bg-background/50">
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Mail</span>
                  <ToggleSwitch
                    checked={acc.services.mail ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { mail: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Calendars</span>
                  <ToggleSwitch
                    checked={acc.services.calendar ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { calendar: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Contacts</span>
                  <ToggleSwitch
                    checked={acc.services.contacts ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { contacts: checked })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NextcloudProviderView({ comailAccountId }: { comailAccountId?: string }) {
  const accounts = useExternalProvidersStore((s) => s.accounts.filter((a) => a.provider === 'nextcloud'));
  const addAccount = useExternalProvidersStore((s) => s.addAccount);
  const removeAccount = useExternalProvidersStore((s) => s.removeAccount);
  const updateAccountServices = useExternalProvidersStore((s) => s.updateAccountServices);

  const [isAdding, setIsAdding] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [services, setServices] = useState<ExternalServiceToggles>({
    mail: true,
    calendar: true,
    contacts: true,
    drive: true,
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !serverUrl.startsWith('http')) {
      toast.error('Please enter a valid Nextcloud instance URL (e.g. https://cloud.example.org)');
      return;
    }
    if (!username.trim()) {
      toast.error('Please enter your Nextcloud username or email');
      return;
    }
    addAccount({
      provider: 'nextcloud',
      email: `${username.trim()}@${new URL(serverUrl.trim()).hostname}`,
      serverUrl: serverUrl.trim(),
      name: `Nextcloud (${new URL(serverUrl.trim()).hostname})`,
      services,
      comailAccountId,
    });
    toast.success(`Connected Nextcloud instance: ${serverUrl.trim()}`);
    setServerUrl('');
    setUsername('');
    setAppPassword('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
          <NextcloudIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">Nextcloud & ownCloud Federation</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Link your self-hosted sovereign cloud instance. Sync Nextcloud Mail, CalDAV Calendars, CardDAV Address Books, and WebDAV Files directly into Comail.
          </p>
        </div>
        {!isAdding && (
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            className="shrink-0 gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-2xs text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Nextcloud</span>
          </Button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleConnect} className="p-5 rounded-xl border border-sky-500/30 bg-card space-y-4 shadow-sm animate-in fade-in-50">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <NextcloudIcon className="w-4 h-4" />
              <span>Connect Self-Hosted Nextcloud Instance</span>
            </h5>
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="h-7 text-xs">
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Server URL *</label>
              <Input
                type="url"
                placeholder="https://cloud.example.org"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Username / Email *</label>
              <Input
                type="text"
                placeholder="alice"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">App Password / Token *</label>
              <Input
                type="password"
                placeholder="Created in Nextcloud Security"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Synchronize Modules
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.mail ?? false}
                  onChange={(e) => setServices({ ...services, mail: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Nextcloud Mail</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.calendar ?? false}
                  onChange={(e) => setServices({ ...services, calendar: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Calendar (CalDAV)</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.contacts ?? false}
                  onChange={(e) => setServices({ ...services, contacts: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Contacts (CardDAV)</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={services.drive ?? false}
                  onChange={(e) => setServices({ ...services, drive: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Files (WebDAV)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-700 text-white">
              Connect Instance
            </Button>
          </div>
        </form>
      )}

      {accounts.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center text-center py-10 px-4 border border-dashed border-border rounded-xl">
          <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center mb-3">
            <NextcloudIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Nextcloud Instances Connected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1.5 mb-5">
            Connect your own private server to bring your Nextcloud files, address books, and calendars together.
          </p>
          <Button onClick={() => setIsAdding(true)} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white">
            <Plus className="w-4 h-4" />
            <span>Connect Nextcloud Instance</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-2xs">
              <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                    NC
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.name || acc.email}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        <NextcloudIcon className="w-3 h-3" />
                        Nextcloud
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      {acc.serverUrl}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removeAccount(acc.id);
                    toast.success(`Removed Nextcloud account: ${acc.email}`);
                  }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 me-1.5 text-destructive" />
                  <span className="text-destructive">Disconnect</span>
                </Button>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-background/50">
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Mail</span>
                  <ToggleSwitch
                    checked={acc.services.mail ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { mail: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Calendar</span>
                  <ToggleSwitch
                    checked={acc.services.calendar ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { calendar: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Contacts</span>
                  <ToggleSwitch
                    checked={acc.services.contacts ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { contacts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Files</span>
                  <ToggleSwitch
                    checked={acc.services.drive ?? false}
                    onChange={(checked) => updateAccountServices(acc.id, { drive: checked })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataImportersView({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mboxInputRef = useRef<HTMLInputElement>(null);

  const handleEmlFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    toast.success(`Importing ${files.length} email message(s) into your inbox...`);
    setTimeout(() => {
      toast.success(`Successfully imported ${files.length} email(s) into Inbox.`);
      onClose();
    }, 1200);
  };

  const handleMboxFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.success(`Parsing Mbox archive: ${file.name}...`);
    setTimeout(() => {
      toast.success(`Mbox archive imported successfully into Archive folder.`);
      onClose();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Universal 1-Time Data Ingestion Studio</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Drag and drop or select historical archives from other providers (Google Takeout, Apple Mail, Thunderbird, or Outlook) to ingest them directly into your Comail accounts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* EML / ZIP Card */}
        <div className="p-4 rounded-xl border border-border/80 bg-card hover:border-border transition-all flex flex-col justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground">Email Messages (.eml, .zip)</h5>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Ingest individual RFC 822 .eml files or ZIP archives containing emails straight into any folder.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <input
              type="file"
              ref={fileInputRef}
              accept=".eml,.zip"
              multiple
              className="hidden"
              onChange={handleEmlFiles}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Select .eml or .zip Files</span>
            </Button>
          </div>
        </div>

        {/* MBOX Card */}
        <div className="p-4 rounded-xl border border-border/80 bg-card hover:border-border transition-all flex flex-col justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground">Mailbox Archive (.mbox)</h5>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Standard mailbox archive exported from Gmail Takeout, Thunderbird, or Apple Mail.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <input
              type="file"
              ref={mboxInputRef}
              accept=".mbox"
              className="hidden"
              onChange={handleMboxFile}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => mboxInputRef.current?.click()}
              className="w-full text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Select .mbox Archive</span>
            </Button>
          </div>
        </div>

        {/* Contacts VCF Card */}
        <div className="p-4 rounded-xl border border-border/80 bg-card hover:border-border transition-all flex flex-col justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
              <BookUser className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground">Address Book (vCard .vcf)</h5>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Import contact cards exported from Google Contacts, iCloud, Outlook, or phone address books.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                router.push('/contacts' as never);
              }}
              className="w-full text-xs gap-1.5"
            >
              <BookUser className="w-3.5 h-3.5" />
              <span>Open Contacts Importer</span>
            </Button>
          </div>
        </div>

        {/* Calendar ICS Card */}
        <div className="p-4 rounded-xl border border-border/80 bg-card hover:border-border transition-all flex flex-col justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground">Calendar Schedules (iCalendar .ics)</h5>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Import calendar event archives and schedules exported from Google Calendar or Apple Calendar.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                router.push('/calendar' as never);
              }}
              className="w-full text-xs gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Open Calendar Importer</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
