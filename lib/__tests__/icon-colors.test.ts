import { describe, expect, it } from 'vitest';
import {
  ACCENT_SHADE_VARIABLES,
  RAINBOW_VARIABLES,
  SEMANTIC_RAINBOW_MAP,
  getIconColor,
  hashString,
  shouldPreserveColor,
} from '@/lib/icon-colors';

describe('icon-colors', () => {
  it('preserves monochrome color as undefined or passed value', () => {
    expect(getIconColor('Mail', 'monochrome')).toBeUndefined();
    expect(getIconColor('Mail', 'monochrome', '#ff0000')).toBe('#ff0000');
  });

  it('preserves caller explicit colors even in rainbow or theme-accent mode', () => {
    expect(getIconColor('Mail', 'rainbow', '#123456')).toBe('#123456');
    expect(getIconColor('Calendar', 'theme-accent', '#abcdef')).toBe('#abcdef');
  });

  it('preserves semantic status classes such as text-destructive or text-success', () => {
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-destructive')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-success')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-warning')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-amber-500')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-primary-foreground')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-destructive-foreground')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-primary')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-current')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-inherit')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-orange-500')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-pink-500')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-muted-foreground')).toBe(true);
    expect(shouldPreserveColor(undefined, 'w-4 h-4 text-foreground')).toBe(false);
    expect(shouldPreserveColor(undefined, 'w-4 h-4')).toBe(false);

    expect(getIconColor('Trash2', 'theme-accent', undefined, 'w-4 h-4 text-destructive')).toBeUndefined();
    // Tags for pink and orange preserve their explicit color across palettes
    expect(getIconColor('Tag', 'theme-accent', undefined, 'w-4 h-4 flex-shrink-0 text-orange-500')).toBeUndefined();
    expect(getIconColor('Tag', 'rainbow', undefined, 'w-4 h-4 flex-shrink-0 text-orange-500')).toBeUndefined();
    expect(getIconColor('Tag', 'theme-accent', undefined, 'w-4 h-4 flex-shrink-0 text-pink-500')).toBeUndefined();
    expect(getIconColor('Tag', 'rainbow', undefined, 'w-4 h-4 flex-shrink-0 text-pink-500')).toBeUndefined();
    // Trash icons are always gray across all palettes
    expect(getIconColor('Trash', 'rainbow')).toBe('var(--color-muted-foreground)');
    expect(getIconColor('Trash2', 'rainbow')).toBe('var(--color-muted-foreground)');
    expect(getIconColor('Trash', 'theme-accent')).toBe('var(--color-muted-foreground)');
    expect(getIconColor('Trash2', 'theme-accent')).toBe('var(--color-muted-foreground)');
    expect(getIconColor('Trash2', 'monochrome')).toBe('var(--color-muted-foreground)');
    // Compose button icon contrast: text-primary-foreground avoids clashing palette shades
    expect(getIconColor('PenSquare', 'theme-accent', undefined, 'w-4 h-4 text-primary-foreground')).toBeUndefined();
    expect(getIconColor('PenSquare', 'rainbow', undefined, 'w-4 h-4 text-primary-foreground')).toBeUndefined();
  });

  it('resolves semantic rainbow colors for common icons', () => {
    expect(getIconColor('Mail', 'rainbow')).toBe('var(--icon-rainbow-blue)');
    expect(getIconColor('Inbox', 'rainbow')).toBe('var(--icon-rainbow-blue)');
    expect(getIconColor('Calendar', 'rainbow')).toBe('var(--icon-rainbow-orange)');
    expect(getIconColor('UserPlus', 'rainbow')).toBe('var(--icon-rainbow-emerald)');
    expect(getIconColor('Settings', 'rainbow')).toBe('var(--icon-rainbow-purple)');
    expect(getIconColor('Star', 'rainbow')).toBe('var(--icon-rainbow-amber)');
    expect(getIconColor('Tag', 'rainbow')).toBe('var(--icon-rainbow-pink)');
    expect(getIconColor('Folder', 'rainbow')).toBe('var(--icon-rainbow-indigo)');
    expect(getIconColor('File', 'rainbow')).toBe('var(--icon-rainbow-teal)');
  });

  it('resolves deterministic rainbow colors for icons without explicit semantic map', () => {
    const color = getIconColor('CustomIconName', 'rainbow');
    expect(RAINBOW_VARIABLES).toContain(color);
    expect(getIconColor('CustomIconName', 'rainbow')).toBe(color);
  });

  it('resolves deterministic theme accent shades for any icon', () => {
    const shade = getIconColor('Inbox', 'theme-accent');
    expect(ACCENT_SHADE_VARIABLES).toContain(shade);
    expect(getIconColor('Inbox', 'theme-accent')).toBe(shade);
  });
});
