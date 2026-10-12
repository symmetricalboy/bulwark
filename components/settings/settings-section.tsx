'use client';

import { ReactNode, createContext, useContext, useId } from 'react';
import { ChevronDown, Lock } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Lets the controls inside a SettingItem borrow the row's visible label as
 * their accessible name. Without it a bare toggle announces as an unnamed
 * switch, since the row label is a <label> with nothing to point at (#722).
 */
const SettingLabelContext = createContext<string | undefined>(undefined);

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section data-search-label={title} className="space-y-2.5">
      <header className="px-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{description}</p>
        )}
      </header>
      <div className="rounded-xl border border-border/70 bg-card/50 px-4 py-1 shadow-2xs">{children}</div>
    </section>
  );
}

interface SettingItemProps {
  label: string;
  description?: string;
  children: ReactNode;
  locked?: boolean;
}

export function SettingItem({ label, description, children, locked }: SettingItemProps) {
  const labelId = useId();
  return (
    <div
      data-search-label={label}
      className={cn("flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 py-3.5 border-b border-border/60 last:border-0", locked && "opacity-60")}
    >
      <div className="flex-1 min-w-0 sm:pe-4">
        <div className="flex items-center gap-1.5">
          <label id={labelId} className="text-sm font-medium text-foreground">{label}</label>
          {locked && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Managed by administrator" />}
        </div>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <SettingLabelContext.Provider value={labelId}>
        <div className={cn("flex-shrink-0", locked && "pointer-events-none")}>{children}</div>
      </SettingLabelContext.Provider>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Overrides the enclosing SettingItem label as the accessible name. */
  ariaLabel?: string;
  /** Test hook (data-testid) for integration tests. */
  testId?: string;
}

export function ToggleSwitch({ checked, onChange, disabled, ariaLabel, testId }: ToggleSwitchProps) {
  const labelledBy = useContext(SettingLabelContext);
  return (
    <button
      type="button"
      role="switch"
      data-testid={testId}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-muted-foreground/25',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          checked ? 'ltr:translate-x-[22px] rtl:-translate-x-[22px]' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'
        )}
      />
    </button>
  );
}

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function RadioGroup({ value, onChange, options }: RadioGroupProps) {
  const labelledBy = useContext(SettingLabelContext);
  return (
    <div
      className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-muted/70 p-0.5 ring-1 ring-inset ring-border/50"
      role="group"
      aria-labelledby={labelledBy}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-xs rounded-md transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option.value
              ? 'bg-background text-foreground font-semibold shadow-sm ring-1 ring-border/60'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Select({ value, onChange, options, disabled, className, ariaLabel }: SelectProps) {
  const labelledBy = useContext(SettingLabelContext);
  return (
    <span className={cn("relative inline-flex max-w-full", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelledBy}
        dir="auto"
        className={cn(
          "h-9 w-full min-w-0 ps-3 pe-8 text-sm rounded-lg bg-background border border-border text-foreground appearance-none shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-muted-foreground/60",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
    </span>
  );
}
