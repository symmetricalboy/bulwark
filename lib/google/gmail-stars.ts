import type { Email, Mailbox } from '@/lib/jmap/types';

export type GmailStarId =
  | 'yellow-star'
  | 'blue-star'
  | 'orange-star'
  | 'red-star'
  | 'purple-star'
  | 'green-star'
  | 'red-bang'
  | 'orange-guillemet'
  | 'yellow-bang'
  | 'green-check'
  | 'blue-info'
  | 'purple-question';

export interface GmailStarDefinition {
  id: GmailStarId;
  name: string;
  rawLabelName: string;
  iconPath: string;
  isCircle: boolean;
  aliases: string[];
}

export const GMAIL_STARS: Record<GmailStarId, GmailStarDefinition> = {
  'yellow-star': {
    id: 'yellow-star',
    name: 'Yellow Star',
    rawLabelName: 'Yellow star',
    iconPath: '/gmail-stars/star_googyellow500_20dp.png',
    isCircle: false,
    aliases: ['yellow star', 'yellow-star', 'yellow_star', 'yellowstar', '^ss_sy', 'ss_sy'],
  },
  'blue-star': {
    id: 'blue-star',
    name: 'Blue Star',
    rawLabelName: 'Blue star',
    iconPath: '/gmail-stars/star_fill_baseline_p600_20dp.png',
    isCircle: false,
    aliases: ['blue star', 'blue-star', 'blue_star', 'bluestar', '^ss_sb', 'ss_sb'],
  },
  'orange-star': {
    id: 'orange-star',
    name: 'Orange Star',
    rawLabelName: 'Orange star',
    iconPath: '/gmail-stars/star_fill_orange700_20dp.png',
    isCircle: false,
    aliases: ['orange star', 'orange-star', 'orange_star', 'orangestar', '^ss_so', 'ss_so'],
  },
  'red-star': {
    id: 'red-star',
    name: 'Red Star',
    rawLabelName: 'Red star',
    iconPath: '/gmail-stars/star_fill_googred500_20dp.png',
    isCircle: false,
    aliases: ['red star', 'red-star', 'red_star', 'redstar', '^ss_sr', 'ss_sr'],
  },
  'purple-star': {
    id: 'purple-star',
    name: 'Purple Star',
    rawLabelName: 'Purple star',
    iconPath: '/gmail-stars/star_fill_purple500_20dp.png',
    isCircle: false,
    aliases: ['purple star', 'purple-star', 'purple_star', 'purplestar', '^ss_sp', 'ss_sp'],
  },
  'green-star': {
    id: 'green-star',
    name: 'Green Star',
    rawLabelName: 'Green star',
    iconPath: '/gmail-stars/star_fill_googgreen500_20dp.png',
    isCircle: false,
    aliases: ['green star', 'green-star', 'green_star', 'greenstar', '^ss_sg', 'ss_sg'],
  },
  'red-bang': {
    id: 'red-bang',
    name: 'Red Bang',
    rawLabelName: 'Red circle',
    iconPath: '/gmail-stars/star_lit_red_bang3.png',
    isCircle: true,
    aliases: [
      'red circle',
      'red-circle',
      'red_circle',
      'redcircle',
      'red bang',
      'red-bang',
      'red_bang',
      'redbang',
      '^ss_cr',
      'ss_cr',
    ],
  },
  'orange-guillemet': {
    id: 'orange-guillemet',
    name: 'Orange Guillemet',
    rawLabelName: 'Orange circle',
    iconPath: '/gmail-stars/star_lit_orange_chevron3.png',
    isCircle: true,
    aliases: [
      'orange circle',
      'orange-circle',
      'orange_circle',
      'orangecircle',
      'orange guillemet',
      'orange-guillemet',
      'orange_guillemet',
      'orangeguillemet',
      'orange chevron',
      'orange-chevron',
      '^ss_co',
      'ss_co',
    ],
  },
  'yellow-bang': {
    id: 'yellow-bang',
    name: 'Yellow Bang',
    rawLabelName: 'Yellow circle',
    iconPath: '/gmail-stars/star_lit_yellow_bang3.png',
    isCircle: true,
    aliases: [
      'yellow circle',
      'yellow-circle',
      'yellow_circle',
      'yellowcircle',
      'yellow bang',
      'yellow-bang',
      'yellow_bang',
      'yellowbang',
      '^ss_cy',
      'ss_cy',
    ],
  },
  'green-check': {
    id: 'green-check',
    name: 'Green Check',
    rawLabelName: 'Green circle',
    iconPath: '/gmail-stars/star_lit_green_check3.png',
    isCircle: true,
    aliases: [
      'green circle',
      'green-circle',
      'green_circle',
      'greencircle',
      'green check',
      'green-check',
      'green_check',
      'greencheck',
      '^ss_cg',
      'ss_cg',
    ],
  },
  'blue-info': {
    id: 'blue-info',
    name: 'Blue Info',
    rawLabelName: 'Blue circle',
    iconPath: '/gmail-stars/star_lit_blue_i3.png',
    isCircle: true,
    aliases: [
      'blue circle',
      'blue-circle',
      'blue_circle',
      'bluecircle',
      'blue info',
      'blue-info',
      'blue_info',
      'blueinfo',
      '^ss_cb',
      'ss_cb',
    ],
  },
  'purple-question': {
    id: 'purple-question',
    name: 'Purple Question',
    rawLabelName: 'Purple circle',
    iconPath: '/gmail-stars/star_lit_purple_question3.png',
    isCircle: true,
    aliases: [
      'purple circle',
      'purple-circle',
      'purple_circle',
      'purplecircle',
      'purple question',
      'purple-question',
      'purple_question',
      'purplequestion',
      '^ss_cp',
      'ss_cp',
    ],
  },
};

export const ALL_GMAIL_STARS = Object.values(GMAIL_STARS);

/**
 * Normalizes a string for star label comparison: lowercases, trims,
 * and collapses dashes, underscores, and extra whitespace.
 */
export function normalizeStarString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/^(\[gmail\]\/|\[google mail\]\/)/i, '')
    .replace(/^(\$star:|\$label:|\$color:|label:)/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Attempts to match a string or identifier to one of the 12 Gmail star definitions.
 */
export function matchGmailStar(nameOrId: string | null | undefined): GmailStarDefinition | null {
  if (!nameOrId || typeof nameOrId !== 'string') return null;

  // Strip prefixes like google:email::, [Gmail]/, [Google Mail]/, $star:, $label:, label:
  let candidate = nameOrId;
  if (candidate.includes('::')) {
    candidate = candidate.split('::').pop() || candidate;
  }
  candidate = candidate
    .replace(/^(\[gmail\]\/|\[google mail\]\/)/i, '')
    .replace(/^(\$star:|\$label:|\$color:|label:)/i, '')
    .trim();

  const lastSegment = candidate.includes('/') ? candidate.split('/').pop() || candidate : candidate;

  for (const toCheck of [candidate, lastSegment]) {
    const directLower = toCheck.toLowerCase().trim();
    const normalized = normalizeStarString(toCheck);
    const withoutSpaces = normalized.replace(/\s+/g, '');

    for (const star of ALL_GMAIL_STARS) {
      if (star.id === directLower || star.id === normalized) return star;
      for (const alias of star.aliases) {
        const aliasNorm = normalizeStarString(alias);
        const aliasNoSpaces = aliasNorm.replace(/\s+/g, '');
        if (
          directLower === alias.toLowerCase() ||
          normalized === aliasNorm ||
          withoutSpaces === aliasNoSpaces
        ) {
          return star;
        }
      }
    }
  }

  return null;
}

/**
 * Determines whether a given mailbox or label represents one of Gmail's 12 stars.
 */
export function isGmailStarLabel(
  labelOrMailboxOrName:
    | string
    | { id?: string; name?: string; originalId?: string }
    | null
    | undefined
): boolean {
  if (!labelOrMailboxOrName) return false;

  if (typeof labelOrMailboxOrName === 'string') {
    if (matchGmailStar(labelOrMailboxOrName) !== null) return true;
    const known = knownMailboxesMap.get(labelOrMailboxOrName);
    if (known?.name && matchGmailStar(known.name)) return true;
    const raw = labelOrMailboxOrName.includes('::') ? labelOrMailboxOrName.split('::').pop() : labelOrMailboxOrName;
    if (raw) {
      const knownRaw = knownMailboxesMap.get(raw);
      if (knownRaw?.name && matchGmailStar(knownRaw.name)) return true;
    }
    return false;
  }

  if (labelOrMailboxOrName.name && matchGmailStar(labelOrMailboxOrName.name)) {
    return true;
  }
  if (labelOrMailboxOrName.originalId && matchGmailStar(labelOrMailboxOrName.originalId)) {
    return true;
  }
  if (labelOrMailboxOrName.id && matchGmailStar(labelOrMailboxOrName.id)) {
    return true;
  }
  if (labelOrMailboxOrName.id) {
    const known = knownMailboxesMap.get(labelOrMailboxOrName.id);
    if (known?.name && matchGmailStar(known.name)) return true;
  }
  if (labelOrMailboxOrName.originalId) {
    const known = knownMailboxesMap.get(labelOrMailboxOrName.originalId);
    if (known?.name && matchGmailStar(known.name)) return true;
  }

  return false;
}

/**
 * Cleans up display name for star labels (e.g. "Red circle" -> "Red Bang").
 */
export function cleanGmailStarDisplayName(name: string): string {
  const matched = matchGmailStar(name);
  return matched ? matched.name : name;
}

let knownMailboxesMap = new Map<string, Mailbox>();

/**
 * Registers known mailboxes so that message star lookup can resolve opaque IDs
 * to mailbox names without requiring component-level plumbing.
 */
export function registerKnownMailboxes(mailboxes: Mailbox[]): void {
  for (const m of mailboxes) {
    if (m?.id) knownMailboxesMap.set(m.id, m);
    if (m?.originalId) knownMailboxesMap.set(m.originalId, m);
  }
}

export function getKnownMailboxes(): Mailbox[] {
  return Array.from(knownMailboxesMap.values());
}

/**
 * Checks whether the specified mailbox corresponds to the Starred role.
 */
export function isStarredMailbox(
  selectedMailboxId: string | null | undefined,
  mailboxes: Mailbox[] = [],
  isUnifiedView = false,
  unifiedRole?: string | null
): boolean {
  if (isUnifiedView && unifiedRole === 'starred') return true;
  if (!selectedMailboxId) return false;

  const upper = selectedMailboxId.toUpperCase();
  if (
    upper.endsWith('::STARRED') ||
    upper === 'STARRED' ||
    selectedMailboxId === 'mb-starred' ||
    selectedMailboxId === '__cross_starred__' ||
    selectedMailboxId === 'unified-starred'
  ) {
    return true;
  }

  const allMbs = [...mailboxes, ...getKnownMailboxes()];
  const found = allMbs.find((m) => m.id === selectedMailboxId);
  return found?.role === 'starred';
}

/**
 * Determines which of the 12 stars an email has.
 * In Gmail, messages carrying a specific colored star will have that label
 * in addition to the standard STARRED system label.
 */
export function getStarForEmail(
  email: Email,
  mailboxes?: Mailbox[]
): GmailStarDefinition | null {
  const allMbs = [...(mailboxes || []), ...getKnownMailboxes()];

  // 1. Check email.keywords first
  if (email.keywords) {
    for (const kw of Object.keys(email.keywords)) {
      if (!email.keywords[kw]) continue;
      const matched = matchGmailStar(kw);
      if (matched) return matched;
    }
  }

  // 2. Check email.mailboxIds
  if (email.mailboxIds) {
    for (const mbId of Object.keys(email.mailboxIds)) {
      if (!email.mailboxIds[mbId]) continue;

      const direct = matchGmailStar(mbId);
      if (direct) return direct;

      const rawLabelId = mbId.includes('::') ? mbId.split('::').pop() : mbId;
      if (rawLabelId) {
        const rawDirect = matchGmailStar(rawLabelId);
        if (rawDirect) return rawDirect;
      }

      // Lookup mailbox name in known mailboxes or allMbs
      const mb =
        knownMailboxesMap.get(mbId) ||
        (rawLabelId ? knownMailboxesMap.get(rawLabelId) : undefined) ||
        allMbs.find(
          (m) =>
            m.id === mbId ||
            (rawLabelId && m.originalId === rawLabelId) ||
            (rawLabelId && m.id.endsWith(`::${rawLabelId}`))
        );

      if (mb?.name) {
        const nameMatch = matchGmailStar(mb.name);
        if (nameMatch) return nameMatch;
      }
    }
  }

  // 3. Fallback: If marked as flagged or in STARRED mailbox, default to Yellow Star
  const isFlagged =
    email.keywords?.$flagged === true ||
    Boolean(
      email.mailboxIds &&
        (email.mailboxIds['mb-starred'] ||
          email.mailboxIds['__cross_starred__'] ||
          Object.keys(email.mailboxIds).some((id) => id.toUpperCase().endsWith('::STARRED')))
    );

  if (isFlagged) {
    return GMAIL_STARS['yellow-star'];
  }

  return null;
}
