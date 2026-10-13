import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ALL_GMAIL_STARS,
  GMAIL_STARS,
  matchGmailStar,
  isGmailStarLabel,
  cleanGmailStarDisplayName,
  getStarForEmail,
  isStarredMailbox,
} from '../gmail-stars';
import type { Email, Mailbox } from '@/lib/jmap/types';

describe('Gmail 12 Stars', () => {
  it('has all 12 star definitions', () => {
    expect(ALL_GMAIL_STARS).toHaveLength(12);
    expect(Object.keys(GMAIL_STARS)).toEqual([
      'yellow-star',
      'blue-star',
      'orange-star',
      'red-star',
      'purple-star',
      'green-star',
      'red-bang',
      'orange-guillemet',
      'yellow-bang',
      'green-check',
      'blue-info',
      'purple-question',
    ]);
  });

  it('all 12 star icon files exist in public/gmail-stars', () => {
    const publicDir = path.resolve(__dirname, '../../..', 'public');
    for (const star of ALL_GMAIL_STARS) {
      const diskPath = path.join(publicDir, star.iconPath.replace(/^\//, ''));
      expect(fs.existsSync(diskPath), `File does not exist: ${diskPath}`).toBe(true);
    }
  });

  it('matches all 6 star colors by various alias formats', () => {
    expect(matchGmailStar('Yellow star')?.id).toBe('yellow-star');
    expect(matchGmailStar('blue-star')?.id).toBe('blue-star');
    expect(matchGmailStar('Orange Star')?.id).toBe('orange-star');
    expect(matchGmailStar('red_star')?.id).toBe('red-star');
    expect(matchGmailStar('purple star')?.id).toBe('purple-star');
    expect(matchGmailStar('Green star')?.id).toBe('green-star');
  });

  it('matches all 6 circles to their proper star names', () => {
    expect(matchGmailStar('Red circle')?.id).toBe('red-bang');
    expect(matchGmailStar('Orange circle')?.id).toBe('orange-guillemet');
    expect(matchGmailStar('Yellow circle')?.id).toBe('yellow-bang');
    expect(matchGmailStar('Green circle')?.id).toBe('green-check');
    expect(matchGmailStar('Blue circle')?.id).toBe('blue-info');
    expect(matchGmailStar('Purple circle')?.id).toBe('purple-question');
  });

  it('matches internal Gmail search / API shorthand identifiers', () => {
    expect(matchGmailStar('^ss_cr')?.id).toBe('red-bang');
    expect(matchGmailStar('^ss_co')?.id).toBe('orange-guillemet');
    expect(matchGmailStar('^ss_cy')?.id).toBe('yellow-bang');
    expect(matchGmailStar('^ss_cg')?.id).toBe('green-check');
    expect(matchGmailStar('^ss_cb')?.id).toBe('blue-info');
    expect(matchGmailStar('^ss_cp')?.id).toBe('purple-question');
    expect(matchGmailStar('^ss_sy')?.id).toBe('yellow-star');
    expect(matchGmailStar('^ss_sb')?.id).toBe('blue-star');
  });

  it('cleans up display name for circle labels', () => {
    expect(cleanGmailStarDisplayName('Red circle')).toBe('Red Bang');
    expect(cleanGmailStarDisplayName('Orange circle')).toBe('Orange Guillemet');
    expect(cleanGmailStarDisplayName('Yellow circle')).toBe('Yellow Bang');
    expect(cleanGmailStarDisplayName('Green circle')).toBe('Green Check');
    expect(cleanGmailStarDisplayName('Blue circle')).toBe('Blue Info');
    expect(cleanGmailStarDisplayName('Purple circle')).toBe('Purple Question');
    expect(cleanGmailStarDisplayName('Work Projects')).toBe('Work Projects');
  });

  it('identifies star labels for hiding from Comail folder lists', () => {
    expect(isGmailStarLabel({ name: 'Red circle' })).toBe(true);
    expect(isGmailStarLabel({ name: 'Blue star' })).toBe(true);
    expect(isGmailStarLabel({ id: 'google:me@example.com::^ss_cr' })).toBe(true);
    expect(isGmailStarLabel({ name: 'Inbox' })).toBe(false);
    expect(isGmailStarLabel({ name: 'Work' })).toBe(false);
  });

  it('identifies stars on emails via mailboxIds and known mailboxes', () => {
    const mailboxes: Mailbox[] = [
      {
        id: 'google:user@example.com::Label_99',
        name: 'Red circle',
        role: undefined,
        sortOrder: 10,
        totalEmails: 1,
        unreadEmails: 0,
        totalThreads: 1,
        unreadThreads: 0,
        isSubscribed: true,
      },
    ] as unknown as Mailbox[];

    const email: Email = {
      id: 'msg-1',
      threadId: 't-1',
      mailboxIds: {
        'google:user@example.com::STARRED': true,
        'google:user@example.com::Label_99': true,
      },
      keywords: { $flagged: true },
      hasAttachment: false,
      size: 100,
      receivedAt: '2026-10-13T00:00:00Z',
    };

    const star = getStarForEmail(email, mailboxes);
    expect(star).not.toBeNull();
    expect(star?.id).toBe('red-bang');
    expect(star?.name).toBe('Red Bang');
    expect(star?.iconPath).toBe('/gmail-stars/star_lit_red_bang3.png');
  });

  it('defaults to yellow star when email is flagged with no specific star label', () => {
    const email: Email = {
      id: 'msg-2',
      threadId: 't-2',
      mailboxIds: { 'google:user@example.com::STARRED': true },
      keywords: { $flagged: true },
      hasAttachment: false,
      size: 100,
      receivedAt: '2026-10-13T00:00:00Z',
    };

    const star = getStarForEmail(email, []);
    expect(star).not.toBeNull();
    expect(star?.id).toBe('yellow-star');
    expect(star?.iconPath).toBe('/gmail-stars/star_googyellow500_20dp.png');
  });

  it('returns null for unstarred email', () => {
    const email: Email = {
      id: 'msg-3',
      threadId: 't-3',
      mailboxIds: { 'google:user@example.com::INBOX': true },
      keywords: { $seen: true },
      hasAttachment: false,
      size: 100,
      receivedAt: '2026-10-13T00:00:00Z',
    };

    expect(getStarForEmail(email, [])).toBeNull();
  });

  it('matches star labels with [Gmail]/ prefix', () => {
    expect(matchGmailStar('[Gmail]/Red circle')?.id).toBe('red-bang');
    expect(matchGmailStar('[Gmail]/Blue star')?.id).toBe('blue-star');
    expect(matchGmailStar('[Google Mail]/Purple circle')?.id).toBe('purple-question');
  });

  it('detects starred mailboxes across Google, JMAP, unified, and cross-account views', () => {
    expect(isStarredMailbox('google:user@example.com::STARRED')).toBe(true);
    expect(isStarredMailbox('STARRED')).toBe(true);
    expect(isStarredMailbox('mb-starred')).toBe(true);
    expect(isStarredMailbox('__cross_starred__')).toBe(true);
    expect(isStarredMailbox('unified-starred')).toBe(true);
    expect(isStarredMailbox(null, [], true, 'starred')).toBe(true);

    expect(isStarredMailbox('google:user@example.com::INBOX')).toBe(false);
    expect(isStarredMailbox('mb-inbox')).toBe(false);
    expect(isStarredMailbox(null)).toBe(false);
  });
});
