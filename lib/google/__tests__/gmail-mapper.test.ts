import { describe, it, expect } from 'vitest';
import {
  isGoogleMailboxId,
  parseGoogleMailboxId,
  isGoogleEmailId,
  parseGoogleEmailId,
  googleLabelToMailbox,
  googleMessageToEmail,
  parseEmailAddresses,
  ensureGoogleSystemMailboxes,
  isGoogleSystemFolder,
} from '../gmail-mapper';
import type { GmailLabel, GmailMessage } from '../types';

describe('gmail-mapper', () => {
  describe('mailbox ID utilities', () => {
    it('correctly identifies and parses namespaced google mailbox IDs', () => {
      expect(isGoogleMailboxId('google:user@gmail.com::INBOX')).toBe(true);
      expect(isGoogleMailboxId('regular-mailbox-id')).toBe(false);

      const parsed = parseGoogleMailboxId('google:user@gmail.com::INBOX');
      expect(parsed).toEqual({
        accountEmail: 'user@gmail.com',
        labelId: 'INBOX',
      });

      expect(parseGoogleMailboxId('invalid-id')).toBeNull();
    });

    it('correctly identifies and parses namespaced google email IDs', () => {
      expect(isGoogleEmailId('google:user@gmail.com::msg123')).toBe(true);
      expect(isGoogleEmailId('regular-msg-id')).toBe(false);

      const parsed = parseGoogleEmailId('google:user@gmail.com::msg123');
      expect(parsed).toEqual({
        accountEmail: 'user@gmail.com',
        messageId: 'msg123',
      });

      expect(parseGoogleEmailId('invalid-id')).toBeNull();
    });
  });

  describe('googleLabelToMailbox', () => {
    it('maps system INBOX label to JMAP mailbox', () => {
      const label: GmailLabel = {
        id: 'INBOX',
        name: 'INBOX',
        type: 'system',
        messagesTotal: 42,
        messagesUnread: 5,
        threadsTotal: 40,
        threadsUnread: 4,
      };

      const mailbox = googleLabelToMailbox(label, 'user@gmail.com');
      expect(mailbox.id).toBe('google:user@gmail.com::INBOX');
      expect(mailbox.originalId).toBe('INBOX');
      expect(mailbox.name).toBe('Inbox');
      expect(mailbox.role).toBe('inbox');
      expect(mailbox.totalEmails).toBe(42);
      expect(mailbox.unreadEmails).toBe(5);
      expect(mailbox.accountId).toBe('google:user@gmail.com');
      expect(mailbox.accountName).toBe('user@gmail.com');
    });

    it('maps custom user label to custom JMAP mailbox', () => {
      const label: GmailLabel = {
        id: 'Label_123',
        name: 'Receipts',
        type: 'user',
        messagesTotal: 10,
        messagesUnread: 0,
      };

      const mailbox = googleLabelToMailbox(label, 'user@gmail.com');
      expect(mailbox.id).toBe('google:user@gmail.com::Label_123');
      expect(mailbox.name).toBe('Receipts');
      expect(mailbox.role).toBeUndefined();
      expect(mailbox.totalEmails).toBe(10);
    });
  });

  describe('parseEmailAddresses', () => {
    it('parses formatted and bare email addresses', () => {
      const parsed = parseEmailAddresses('John Doe <john@example.com>, jane@example.com');
      expect(parsed).toEqual([
        { name: 'John Doe', email: 'john@example.com' },
        { email: 'jane@example.com' },
      ]);
    });

    it('handles empty input gracefully', () => {
      expect(parseEmailAddresses(undefined)).toEqual([]);
      expect(parseEmailAddresses('')).toEqual([]);
    });
  });

  describe('googleMessageToEmail', () => {
    it('maps a full GmailMessage to a JMAP Email object', () => {
      const msg: GmailMessage = {
        id: '18f1a2b3c4d5e6f7',
        threadId: '18f1a2b3c4d5e6f7',
        labelIds: ['INBOX', 'STARRED'],
        snippet: 'Here is your weekly update and summary.',
        internalDate: '1700000000000',
        sizeEstimate: 2048,
        payload: {
          mimeType: 'multipart/alternative',
          headers: [
            { name: 'Subject', value: 'Weekly Team Update' },
            { name: 'From', value: 'Alice Smith <alice@example.com>' },
            { name: 'To', value: 'Bob Jones <bob@example.com>' },
            { name: 'Date', value: 'Tue, 14 Nov 2023 22:13:20 +0000' },
            { name: 'Message-ID', value: '<msg-xyz@example.com>' },
          ],
          body: { size: 0 },
          parts: [
            {
              partId: '0',
              mimeType: 'text/plain',
              headers: [],
              body: {
                size: 25,
                // base64url encoded: "Here is your weekly update"
                data: Buffer.from('Here is your weekly update').toString('base64url'),
              },
            },
            {
              partId: '1',
              mimeType: 'text/html',
              headers: [],
              body: {
                size: 45,
                // base64url encoded: "<p>Here is your weekly update</p>"
                data: Buffer.from('<p>Here is your weekly update</p>').toString('base64url'),
              },
            },
            {
              partId: '2',
              mimeType: 'application/pdf',
              filename: 'report.pdf',
              headers: [],
              body: {
                attachmentId: 'att_123',
                size: 1024,
              },
            },
          ],
        },
      };

      const email = googleMessageToEmail(msg, 'bob@gmail.com');

      expect(email.id).toBe('google:bob@gmail.com::18f1a2b3c4d5e6f7');
      expect(email.threadId).toBe('google:bob@gmail.com::18f1a2b3c4d5e6f7');
      expect(email.subject).toBe('Weekly Team Update');
      expect(email.from).toEqual([{ name: 'Alice Smith', email: 'alice@example.com' }]);
      expect(email.to).toEqual([{ name: 'Bob Jones', email: 'bob@example.com' }]);
      expect(email.preview).toBe('Here is your weekly update and summary.');
      expect(email.keywords.$seen).toBe(true); // NOT in UNREAD, so seen is true
      expect(email.keywords.$flagged).toBe(true); // in STARRED
      expect(email.mailboxIds['google:bob@gmail.com::INBOX']).toBe(true);

      // Bodies
      expect(email.textBody?.[0].partId).toBe('0');
      expect(email.bodyValues?.['0'].value).toBe('Here is your weekly update');
      expect(email.htmlBody?.[0].partId).toBe('1');
      expect(email.bodyValues?.['1'].value).toBe('<p>Here is your weekly update</p>');

      // Attachments
      expect(email.hasAttachment).toBe(true);
      expect(email.attachments?.[0].name).toBe('report.pdf');
      expect(email.attachments?.[0].blobId).toBe('att_123');
      expect(email.attachments?.[0].size).toBe(1024);
    });

    it('marks unread emails correctly when UNREAD label is present', () => {
      const msg: GmailMessage = {
        id: 'msg-unread',
        threadId: 'th-unread',
        labelIds: ['INBOX', 'UNREAD'],
        internalDate: '1700000000000',
        snippet: 'Important unread message',
      };

      const email = googleMessageToEmail(msg, 'bob@gmail.com');
      expect(email.keywords.$seen).toBeUndefined();
    });
  });

  describe('ensureGoogleSystemMailboxes', () => {
    it('creates all 11 symmetrical system folders when starting from empty list', () => {
      const mailboxes = ensureGoogleSystemMailboxes([], 'user@gmail.com');
      expect(mailboxes).toHaveLength(11);
      const roles = mailboxes.map((m) => m.role);
      expect(roles).toEqual([
        'inbox',
        'starred',
        'unread',
        'important',
        'drafts',
        'scheduled',
        'sent',
        'archive',
        'junk',
        'trash',
        'all',
      ]);
      expect(mailboxes[0].name).toBe('Inbox');
      expect(mailboxes[1].name).toBe('Starred');
      expect(mailboxes[2].name).toBe('Unread');
      expect(mailboxes[3].name).toBe('Important');
      expect(mailboxes[4].name).toBe('Drafts');
      expect(mailboxes[5].name).toBe('Scheduled');
      expect(mailboxes[6].name).toBe('Sent');
      expect(mailboxes[7].name).toBe('Archive');
      expect(mailboxes[8].name).toBe('Spam');
      expect(mailboxes[9].name).toBe('Trash');
      expect(mailboxes[10].name).toBe('All Mail');
    });

    it('preserves existing discovered mailboxes and unread counts while injecting missing system folders', () => {
      const existing = [
        {
          id: 'google:user@gmail.com::INBOX',
          originalId: 'INBOX',
          name: 'Inbox',
          role: 'inbox',
          sortOrder: 1,
          unreadEmails: 5,
          totalEmails: 10,
        },
        {
          id: 'google:user@gmail.com::Label_custom',
          originalId: 'Label_custom',
          name: 'My Custom Label',
          sortOrder: 50,
          unreadEmails: 1,
          totalEmails: 2,
        },
      ];

      const mailboxes = ensureGoogleSystemMailboxes(existing as never, 'user@gmail.com');
      expect(mailboxes).toHaveLength(12); // 11 system + 1 custom
      const inbox = mailboxes.find((m) => m.role === 'inbox');
      expect(inbox?.unreadEmails).toBe(5);
      expect(inbox?.totalEmails).toBe(10);

      const custom = mailboxes.find((m) => m.id === 'google:user@gmail.com::Label_custom');
      expect(custom).toBeDefined();
      expect(custom?.name).toBe('My Custom Label');
    });
  });

  describe('isGoogleSystemFolder', () => {
    it('identifies all 11 system roles as google system folders', () => {
      const systemRoles = [
        'inbox', 'starred', 'unread', 'important', 'drafts', 'scheduled',
        'sent', 'archive', 'junk', 'trash', 'all', 'all_mail',
      ];
      for (const role of systemRoles) {
        expect(isGoogleSystemFolder({ id: 'mb-1', role } as never)).toBe(true);
      }
    });

    it('returns false for custom user folders', () => {
      expect(isGoogleSystemFolder({ id: 'google:user@gmail.com::Label_custom', name: 'Work' } as never)).toBe(false);
    });
  });
});
