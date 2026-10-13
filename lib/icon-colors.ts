export type IconColorPalette = 'monochrome' | 'theme-accent' | 'rainbow';

export const RAINBOW_VARIABLES = [
  'var(--icon-rainbow-blue)',
  'var(--icon-rainbow-emerald)',
  'var(--icon-rainbow-amber)',
  'var(--icon-rainbow-purple)',
  'var(--icon-rainbow-pink)',
  'var(--icon-rainbow-cyan)',
  'var(--icon-rainbow-orange)',
  'var(--icon-rainbow-indigo)',
  'var(--icon-rainbow-teal)',
  'var(--icon-rainbow-red)',
  'var(--icon-rainbow-lime)',
  'var(--icon-rainbow-fuchsia)',
] as const;

export const ACCENT_SHADE_VARIABLES = [
  'var(--icon-accent-shade-1)',
  'var(--icon-accent-shade-2)',
  'var(--icon-accent-shade-3)',
  'var(--icon-accent-shade-4)',
  'var(--icon-accent-shade-5)',
  'var(--icon-accent-shade-6)',
  'var(--icon-accent-shade-7)',
  'var(--icon-accent-shade-8)',
] as const;

/**
 * Semantic mappings for the rainbow palette to make key application concepts
 * instantly recognizable (e.g. Mail = Blue, Calendar = Orange, People = Green).
 */
export const SEMANTIC_RAINBOW_MAP: Record<string, string> = {
  // Mail & Communication: Blue
  Mail: 'var(--icon-rainbow-blue)',
  Inbox: 'var(--icon-rainbow-blue)',
  Send: 'var(--icon-rainbow-blue)',
  SendHorizontal: 'var(--icon-rainbow-blue)',
  MailOpen: 'var(--icon-rainbow-blue)',
  Mailbox: 'var(--icon-rainbow-blue)',
  Reply: 'var(--icon-rainbow-blue)',
  ReplyAll: 'var(--icon-rainbow-blue)',
  Forward: 'var(--icon-rainbow-blue)',
  MessageSquare: 'var(--icon-rainbow-blue)',
  MessagesSquare: 'var(--icon-rainbow-blue)',

  // Contacts & People: Emerald
  User: 'var(--icon-rainbow-emerald)',
  Users: 'var(--icon-rainbow-emerald)',
  UserPlus: 'var(--icon-rainbow-emerald)',
  UserCheck: 'var(--icon-rainbow-emerald)',
  UserMinus: 'var(--icon-rainbow-emerald)',
  UserX: 'var(--icon-rainbow-emerald)',
  UsersRound: 'var(--icon-rainbow-emerald)',
  BookUser: 'var(--icon-rainbow-emerald)',
  Contact: 'var(--icon-rainbow-emerald)',
  BookPlus: 'var(--icon-rainbow-emerald)',

  // Favorites & Stars: Amber
  Star: 'var(--icon-rainbow-amber)',
  Bookmark: 'var(--icon-rainbow-amber)',
  BookmarkPlus: 'var(--icon-rainbow-amber)',
  Award: 'var(--icon-rainbow-amber)',

  // Calendar & Time: Orange
  Calendar: 'var(--icon-rainbow-orange)',
  CalendarDays: 'var(--icon-rainbow-orange)',
  CalendarClock: 'var(--icon-rainbow-orange)',
  CalendarCheck: 'var(--icon-rainbow-orange)',
  CalendarX: 'var(--icon-rainbow-orange)',
  CalendarArrowUp: 'var(--icon-rainbow-orange)',
  Clock: 'var(--icon-rainbow-orange)',
  Clock3: 'var(--icon-rainbow-orange)',

  // Settings, Customization & Tools: Purple
  Settings: 'var(--icon-rainbow-purple)',
  Sliders: 'var(--icon-rainbow-purple)',
  SlidersHorizontal: 'var(--icon-rainbow-purple)',
  Wrench: 'var(--icon-rainbow-purple)',
  Palette: 'var(--icon-rainbow-purple)',

  // Success, Validation & Approvals: Emerald
  Check: 'var(--icon-rainbow-emerald)',
  CheckCheck: 'var(--icon-rainbow-emerald)',
  CheckCircle: 'var(--icon-rainbow-emerald)',
  CheckCircle2: 'var(--icon-rainbow-emerald)',
  CheckSquare: 'var(--icon-rainbow-emerald)',

  // Tags & Labels: Pink
  Tag: 'var(--icon-rainbow-pink)',
  Tags: 'var(--icon-rainbow-pink)',

  // Folders & Organization: Indigo
  Folder: 'var(--icon-rainbow-indigo)',
  FolderOpen: 'var(--icon-rainbow-indigo)',
  FolderPlus: 'var(--icon-rainbow-indigo)',
  FolderArchive: 'var(--icon-rainbow-indigo)',
  FolderDown: 'var(--icon-rainbow-indigo)',
  FolderInput: 'var(--icon-rainbow-indigo)',
  FolderSync: 'var(--icon-rainbow-indigo)',
  FolderUp: 'var(--icon-rainbow-indigo)',
  Archive: 'var(--icon-rainbow-indigo)',
  ArchiveRestore: 'var(--icon-rainbow-indigo)',

  // Search, Exploration & Filters: Cyan
  Search: 'var(--icon-rainbow-cyan)',
  Filter: 'var(--icon-rainbow-cyan)',
  Compass: 'var(--icon-rainbow-cyan)',

  // Files, Documents & Transfers: Teal
  File: 'var(--icon-rainbow-teal)',
  FileText: 'var(--icon-rainbow-teal)',
  FileCode: 'var(--icon-rainbow-teal)',
  FileImage: 'var(--icon-rainbow-teal)',
  FileAudio: 'var(--icon-rainbow-teal)',
  FileVideo: 'var(--icon-rainbow-teal)',
  FileArchive: 'var(--icon-rainbow-teal)',
  Files: 'var(--icon-rainbow-teal)',
  Paperclip: 'var(--icon-rainbow-teal)',
  Upload: 'var(--icon-rainbow-teal)',
  Download: 'var(--icon-rainbow-teal)',

  // Destructive & Alerts: Red
  Ban: 'var(--icon-rainbow-red)',
  AlertCircle: 'var(--icon-rainbow-red)',
  AlertTriangle: 'var(--icon-rainbow-amber)',
  DoubleExclamation: 'var(--icon-rainbow-pink)',

  // Notifications: Amber / Yellow
  Bell: 'var(--icon-rainbow-amber)',
  BellOff: 'var(--icon-rainbow-amber)',

  // AI & Magic: Fuchsia
  Sparkles: 'var(--icon-rainbow-fuchsia)',
  Wand2: 'var(--icon-rainbow-fuchsia)',
  Brain: 'var(--icon-rainbow-fuchsia)',

  // Security: Amber
  Lock: 'var(--icon-rainbow-amber)',
  Unlock: 'var(--icon-rainbow-amber)',
  Key: 'var(--icon-rainbow-amber)',
  Shield: 'var(--icon-rainbow-teal)',
  ShieldCheck: 'var(--icon-rainbow-emerald)',
  ShieldAlert: 'var(--icon-rainbow-red)',
};

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const EXPLICIT_COLOR_PATTERN =
  /\btext-(destructive|destructive-foreground|success|warning|error|primary|primary-foreground|accent-foreground|secondary-foreground|muted-foreground|foreground|current|inherit|white|black|red-|orange-|amber-|yellow-|lime-|green-|emerald-|teal-|cyan-|sky-|blue-|indigo-|violet-|purple-|fuchsia-|pink-|rose-|slate-|gray-|zinc-|neutral-|stone-)\b/;

/**
 * Determines whether the icon has an explicit caller-specified color or semantic class
 * that should not be overridden by the color palette.
 */
export function shouldPreserveColor(color?: string, className?: string): boolean {
  if (color && color !== 'currentColor') return true;
  if (className && EXPLICIT_COLOR_PATTERN.test(className)) return true;
  return false;
}

/**
 * Returns the effective icon color based on the selected palette.
 */
export function getIconColor(
  displayName: string,
  palette: IconColorPalette,
  color?: string,
  className?: string
): string | undefined {
  if (shouldPreserveColor(color, className)) {
    return color;
  }

  // Trash icons must always remain gray across all themes and palettes
  if (displayName === 'Trash' || displayName === 'Trash2') {
    return 'var(--color-muted-foreground)';
  }

  if (palette === 'monochrome') {
    return color;
  }

  if (palette === 'rainbow') {
    return (
      SEMANTIC_RAINBOW_MAP[displayName] ??
      RAINBOW_VARIABLES[hashString(displayName) % RAINBOW_VARIABLES.length]
    );
  }

  if (palette === 'theme-accent') {
    return ACCENT_SHADE_VARIABLES[hashString(displayName) % ACCENT_SHADE_VARIABLES.length];
  }

  return color;
}
