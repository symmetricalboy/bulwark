import type {
  ContactCard,
  ContactName,
  NameComponent,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  ContactOrganization,
  ContactTitle,
  ContactNote,
  ContactAnniversary,
  ContactLink,
  AddressBook,
} from '@/lib/jmap/types';
import type { MicrosoftGraphContact } from './types';

export function buildMicrosoftAddressBook(accountEmail: string, accountName?: string): AddressBook {
  const accountPrefix = `microsoft:${accountEmail}`;
  return {
    id: `${accountPrefix}::microsoft-contacts`,
    originalId: 'microsoft-contacts',
    name: accountName ? `Outlook Contacts (${accountEmail})` : `Outlook Contacts (${accountEmail})`,
    description: `Synced from Microsoft account ${accountEmail}`,
    sortOrder: 0,
    isSubscribed: true,
    isDefault: false,
    accountName: accountEmail,
    localAccountId: accountPrefix,
    myRights: {
      mayRead: true,
      mayWrite: true,
      mayDelete: true,
      mayShare: false,
    },
  };
}

export function mapMicrosoftContactToCard(person: MicrosoftGraphContact, accountEmail: string): ContactCard {
  const accountPrefix = `microsoft:${accountEmail}`;
  const addressBookId = `${accountPrefix}::microsoft-contacts`;
  const given = person.givenName || '';
  const family = person.surname || '';
  const fullName = person.displayName || [given, family].filter(Boolean).join(' ') || '';

  const components: NameComponent[] = [];
  if (given) components.push({ kind: 'given', value: given });
  if (person.middleName) components.push({ kind: 'middle', value: person.middleName });
  if (family) components.push({ kind: 'surname', value: family });
  if (person.title) components.push({ kind: 'prefix', value: person.title });

  const nameObj: ContactName | undefined =
    fullName || components.length > 0
      ? {
          full: fullName || undefined,
          components: components.length > 0 ? components : undefined,
        }
      : undefined;

  const emails: Record<string, ContactEmail> = {};
  (person.emailAddresses || []).forEach((e, idx) => {
    if (e.address) {
      emails[`e${idx}`] = {
        address: e.address,
        contexts: idx === 0 ? { work: true } : { private: true },
        pref: idx === 0 ? 1 : undefined,
      };
    }
  });

  const phones: Record<string, ContactPhone> = {};
  let phoneIdx = 0;
  if (person.mobilePhone) {
    phones[`p${phoneIdx++}`] = {
      number: person.mobilePhone,
      contexts: { private: true },
      pref: 1,
    };
  }
  (person.businessPhones || []).forEach((ph) => {
    if (ph) {
      phones[`p${phoneIdx++}`] = {
        number: ph,
        contexts: { work: true },
        pref: phoneIdx === 1 ? 1 : undefined,
      };
    }
  });
  (person.homePhones || []).forEach((ph) => {
    if (ph) {
      phones[`p${phoneIdx++}`] = {
        number: ph,
        contexts: { private: true },
        pref: phoneIdx === 1 ? 1 : undefined,
      };
    }
  });

  const addresses: Record<string, ContactAddress> = {};
  let addrIdx = 0;
  if (person.businessAddress && Object.values(person.businessAddress).some(Boolean)) {
    addresses[`a${addrIdx++}`] = {
      street: person.businessAddress.street,
      locality: person.businessAddress.city,
      region: person.businessAddress.state,
      postcode: person.businessAddress.postalCode,
      country: person.businessAddress.countryOrRegion,
      contexts: { work: true },
    };
  }
  if (person.homeAddress && Object.values(person.homeAddress).some(Boolean)) {
    addresses[`a${addrIdx++}`] = {
      street: person.homeAddress.street,
      locality: person.homeAddress.city,
      region: person.homeAddress.state,
      postcode: person.homeAddress.postalCode,
      country: person.homeAddress.countryOrRegion,
      contexts: { private: true },
    };
  }

  const organizations: Record<string, ContactOrganization> = {};
  if (person.companyName || person.department) {
    organizations['org-0'] = {
      name: person.companyName,
      units: person.department ? [{ name: person.department }] : undefined,
    };
  }

  const titles: Record<string, ContactTitle> = {};
  if (person.jobTitle) {
    titles['title-0'] = { name: person.jobTitle };
  }

  const notes: Record<string, ContactNote> = {};
  if (person.personalNotes) {
    notes['note-0'] = { note: person.personalNotes };
  }

  const anniversaries: Record<string, ContactAnniversary> = {};
  if (person.birthday) {
    anniversaries['birthday'] = {
      kind: 'birth',
      date: person.birthday.slice(0, 10),
    };
  }

  const links: Record<string, ContactLink> = {};
  if (person.businessHomePage) {
    links['link-0'] = { uri: person.businessHomePage };
  }

  return {
    id: `${accountPrefix}::${person.id}`,
    originalId: person.id,
    localAccountId: accountPrefix,
    addressBookIds: { [addressBookId]: true },
    kind: 'individual',
    name: nameObj,
    emails: Object.keys(emails).length > 0 ? emails : undefined,
    phones: Object.keys(phones).length > 0 ? phones : undefined,
    addresses: Object.keys(addresses).length > 0 ? addresses : undefined,
    organizations: Object.keys(organizations).length > 0 ? organizations : undefined,
    titles: Object.keys(titles).length > 0 ? titles : undefined,
    notes: Object.keys(notes).length > 0 ? notes : undefined,
    anniversaries: Object.keys(anniversaries).length > 0 ? anniversaries : undefined,
    links: Object.keys(links).length > 0 ? links : undefined,
    updated: person.lastModifiedDateTime,
  };
}

export function mapCardToMicrosoftContact(card: Partial<ContactCard>): Record<string, unknown> {
  const given = card.name?.components?.find((c) => c.kind === 'given')?.value || '';
  const family = card.name?.components?.find((c) => c.kind === 'surname')?.value || '';
  const prefix = card.name?.components?.find((c) => c.kind === 'prefix')?.value;
  const full = card.name?.full || [given, family].filter(Boolean).join(' ') || 'Unnamed Contact';

  const body: Record<string, unknown> = {
    givenName: given || (full ? full.split(' ')[0] : ''),
    surname: family || (full ? full.split(' ').slice(1).join(' ') : ''),
    displayName: full,
  };

  if (prefix !== undefined) body.title = prefix;

  const org = Object.values(card.organizations || {})[0];
  if (org?.name !== undefined) body.companyName = org.name;
  if (org?.units?.[0]?.name !== undefined) body.department = org.units[0].name;

  const title = Object.values(card.titles || {})[0]?.name;
  if (title !== undefined) body.jobTitle = title;

  const firstNote = Object.values(card.notes || {})[0]?.note;
  if (firstNote !== undefined) body.personalNotes = firstNote;

  const firstLink = Object.values(card.links || {})[0]?.uri;
  if (firstLink !== undefined) body.businessHomePage = firstLink;

  if (card.emails) {
    body.emailAddresses = Object.values(card.emails)
      .filter((e) => e.address)
      .slice(0, 3)
      .map((e) => ({
        address: e.address,
        name: full,
      }));
  }

  if (card.phones) {
    const phoneEntries = Object.values(card.phones).filter((p) => p.number);
    const work = phoneEntries
      .filter((p) => p.contexts?.work)
      .map((p) => p.number)
      .slice(0, 2);
    const privatePhones = phoneEntries
      .filter((p) => !p.contexts?.work)
      .map((p) => p.number);
    if (privatePhones[0]) body.mobilePhone = privatePhones[0];
    if (work.length > 0) body.businessPhones = work;
    if (privatePhones.length > 1) body.homePhones = privatePhones.slice(1, 3);
  }

  if (card.addresses) {
    const workAddr = Object.values(card.addresses).find((a) => a.contexts?.work);
    const homeAddr = Object.values(card.addresses).find((a) => !a.contexts?.work);
    if (workAddr) {
      body.businessAddress = {
        street: workAddr.street || '',
        city: workAddr.locality || '',
        state: workAddr.region || '',
        postalCode: workAddr.postcode || '',
        countryOrRegion: workAddr.country || '',
      };
    }
    if (homeAddr) {
      body.homeAddress = {
        street: homeAddr.street || '',
        city: homeAddr.locality || '',
        state: homeAddr.region || '',
        postalCode: homeAddr.postcode || '',
        countryOrRegion: homeAddr.country || '',
      };
    }
  }

  return body;
}
