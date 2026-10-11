import { describe, it, expect } from 'vitest';
import {
  googlePersonToContactCard,
  contactCardToGooglePerson,
  createGoogleAddressBook,
  type GooglePerson,
} from '../contact-mapper';
import type { ContactCard } from '@/lib/jmap/types';

describe('contact-mapper', () => {
  const accountEmail = 'dylan.g.singer@gmail.com';

  describe('createGoogleAddressBook', () => {
    it('creates a namespaced Google Address Book', () => {
      const book = createGoogleAddressBook(accountEmail);
      expect(book.id).toBe(`google:${accountEmail}::google-contacts`);
      expect(book.originalId).toBe('google-contacts');
      expect(book.name).toBe('Google Contacts');
      expect(book.localAccountId).toBe(`google:${accountEmail}`);
      expect(book.myRights?.mayRead).toBe(true);
      expect(book.myRights?.mayWrite).toBe(true);
    });
  });

  describe('googlePersonToContactCard', () => {
    it('maps a full GooglePerson to JSContact ContactCard', () => {
      const person: GooglePerson = {
        resourceName: 'people/c1234567890',
        etag: '%abcdef12345',
        names: [
          {
            displayName: 'Jane Doe',
            givenName: 'Jane',
            familyName: 'Doe',
            honorificPrefix: 'Dr.',
          },
        ],
        emailAddresses: [
          {
            value: 'jane.work@example.com',
            type: 'work',
            metadata: { primary: true },
          },
          {
            value: 'jane.home@example.com',
            type: 'home',
          },
        ],
        phoneNumbers: [
          {
            value: '+15551234567',
            type: 'mobile',
          },
        ],
        addresses: [
          {
            formattedValue: '123 Main St, Austin, TX 78701',
            streetAddress: '123 Main St',
            city: 'Austin',
            region: 'TX',
            postalCode: '78701',
            country: 'USA',
            type: 'work',
          },
        ],
        organizations: [
          {
            name: 'Acme Corp',
            title: 'Lead Architect',
            department: 'Engineering',
          },
        ],
        birthdays: [
          {
            date: {
              year: 1990,
              month: 5,
              day: 20,
            },
          },
        ],
        biographies: [
          {
            value: 'Collaborator on open source email protocol.',
          },
        ],
        photos: [
          {
            url: 'https://lh3.googleusercontent.com/photo123',
            default: false,
          },
        ],
        urls: [
          {
            value: 'https://example.com/jane',
          },
        ],
      };

      const card = googlePersonToContactCard(person, accountEmail);

      expect(card.id).toBe(`google:${accountEmail}::c1234567890`);
      expect(card.originalId).toBe('people/c1234567890');
      expect(card.localAccountId).toBe(`google:${accountEmail}`);
      expect(card.addressBookIds[`google:${accountEmail}::google-contacts`]).toBe(true);

      // Name
      expect(card.name?.full).toBe('Jane Doe');
      expect(card.name?.components).toContainEqual({ kind: 'given', value: 'Jane' });
      expect(card.name?.components).toContainEqual({ kind: 'surname', value: 'Doe' });

      // Emails
      expect(card.emails?.['email-0']?.address).toBe('jane.work@example.com');
      expect(card.emails?.['email-0']?.pref).toBe(1);
      expect(card.emails?.['email-1']?.address).toBe('jane.home@example.com');

      // Phones
      expect(card.phones?.['phone-0']?.number).toBe('+15551234567');

      // Address
      expect(card.addresses?.['addr-0']?.locality).toBe('Austin');
      expect(card.addresses?.['addr-0']?.region).toBe('TX');
      expect(card.addresses?.['addr-0']?.country).toBe('USA');

      // Org
      expect(card.organizations?.['org-0']?.name).toBe('Acme Corp');
      expect(card.organizations?.['org-0']?.units).toEqual([{ name: 'Engineering' }]);
      expect(card.titles?.['title-0']?.name).toBe('Lead Architect');

      // Birthday
      expect(card.anniversaries?.['birthday']?.date).toBe('1990-05-20');

      // Photo
      expect(card.media?.['photo']?.uri).toBe('https://lh3.googleusercontent.com/photo123');

      // Notes
      expect(card.notes?.['note-0']?.note).toBe('Collaborator on open source email protocol.');

      // Links
      expect(card.links?.['link-0']?.uri).toBe('https://example.com/jane');
    });
  });

  describe('contactCardToGooglePerson', () => {
    it('converts JSContact ContactCard to GooglePerson format for People API', () => {
      const card: Partial<ContactCard> = {
        name: {
          full: 'Bob Smith',
          components: [
            { kind: 'given', value: 'Bob' },
            { kind: 'surname', value: 'Smith' },
          ],
        },
        emails: {
          e1: { address: 'bob@example.com', contexts: { work: true } },
        },
        phones: {
          p1: { number: '555-9876', contexts: { private: true } },
        },
        organizations: {
          o1: { name: 'Globex' },
        },
        titles: {
          t1: { name: 'Director' },
        },
        notes: {
          n1: { note: 'Key contact at Globex' },
        },
      };

      const person = contactCardToGooglePerson(card, 'etag123');

      expect(person.etag).toBe('etag123');
      expect(person.names?.[0]?.displayName).toBe('Bob Smith');
      expect(person.names?.[0]?.givenName).toBe('Bob');
      expect(person.names?.[0]?.familyName).toBe('Smith');
      expect(person.emailAddresses?.[0]?.value).toBe('bob@example.com');
      expect(person.emailAddresses?.[0]?.type).toBe('work');
      expect(person.phoneNumbers?.[0]?.value).toBe('555-9876');
      expect(person.organizations?.[0]?.name).toBe('Globex');
      expect(person.organizations?.[0]?.title).toBe('Director');
      expect(person.biographies?.[0]?.value).toBe('Key contact at Globex');
    });
  });
});
