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
  ContactMedia,
  ContactAnniversary,
  ContactLink,
  AddressBook,
} from '@/lib/jmap/types';

export interface GooglePersonName {
  displayName?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

export interface GooglePersonEmail {
  value: string;
  type?: string;
  formattedType?: string;
  metadata?: { primary?: boolean };
}

export interface GooglePersonPhone {
  value: string;
  type?: string;
  formattedType?: string;
  canonicalForm?: string;
}

export interface GooglePersonPhoto {
  url: string;
  default?: boolean;
}

export interface GooglePersonOrganization {
  name?: string;
  title?: string;
  department?: string;
  type?: string;
}

export interface GooglePersonAddress {
  formattedValue?: string;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: string;
}

export interface GooglePersonBirthday {
  date?: {
    year?: number;
    month?: number;
    day?: number;
  };
  text?: string;
}

export interface GooglePersonBiography {
  value: string;
  contentType?: string;
}

export interface GooglePersonUrl {
  value: string;
  type?: string;
}

export interface GooglePerson {
  resourceName: string; // e.g. "people/c1234567890"
  etag?: string;
  names?: GooglePersonName[];
  emailAddresses?: GooglePersonEmail[];
  phoneNumbers?: GooglePersonPhone[];
  photos?: GooglePersonPhoto[];
  organizations?: GooglePersonOrganization[];
  addresses?: GooglePersonAddress[];
  birthdays?: GooglePersonBirthday[];
  biographies?: GooglePersonBiography[];
  urls?: GooglePersonUrl[];
}

export interface GoogleConnectionsResponse {
  connections?: GooglePerson[];
  nextPageToken?: string;
  totalPeople?: number;
  totalItems?: number;
}

export function createGoogleAddressBook(accountEmail: string): AddressBook {
  const accountPrefix = `google:${accountEmail}`;
  return {
    id: `${accountPrefix}::google-contacts`,
    originalId: 'google-contacts',
    name: 'Google Contacts',
    description: `Contacts synced from ${accountEmail}`,
    sortOrder: 0,
    isDefault: false,
    isSubscribed: true,
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

export function googlePersonToContactCard(person: GooglePerson, accountEmail: string): ContactCard {
  const accountPrefix = `google:${accountEmail}`;
  const cleanId = person.resourceName ? person.resourceName.replace(/^people\//, '') : Math.random().toString(36).slice(2);
  const namespacedId = `${accountPrefix}::${cleanId}`;
  const addressBookId = `${accountPrefix}::google-contacts`;

  // Parse Name
  const primaryName = person.names?.[0];
  let nameObj: ContactName | undefined;
  if (primaryName) {
    const components: NameComponent[] = [];
    if (primaryName.givenName) components.push({ kind: 'given', value: primaryName.givenName });
    if (primaryName.middleName) components.push({ kind: 'middle', value: primaryName.middleName });
    if (primaryName.familyName) components.push({ kind: 'surname', value: primaryName.familyName });
    if (primaryName.honorificPrefix) components.push({ kind: 'prefix', value: primaryName.honorificPrefix });
    if (primaryName.honorificSuffix) components.push({ kind: 'suffix', value: primaryName.honorificSuffix });

    const full = primaryName.displayName || [primaryName.givenName, primaryName.familyName].filter(Boolean).join(' ');
    nameObj = {
      full: full || undefined,
      components: components.length > 0 ? components : undefined,
    };
  }

  // Parse Emails
  const emails: Record<string, ContactEmail> = {};
  person.emailAddresses?.forEach((email, i) => {
    if (!email.value) return;
    const isWork = email.type?.toLowerCase() === 'work';
    emails[`email-${i}`] = {
      address: email.value,
      contexts: isWork ? { work: true } : { private: true },
      pref: email.metadata?.primary ? 1 : undefined,
    };
  });

  // Parse Phones
  const phones: Record<string, ContactPhone> = {};
  person.phoneNumbers?.forEach((phone, i) => {
    if (!phone.value) return;
    const isWork = phone.type?.toLowerCase() === 'work';
    phones[`phone-${i}`] = {
      number: phone.value,
      contexts: isWork ? { work: true } : { private: true },
      pref: i === 0 ? 1 : undefined,
    };
  });

  // Parse Addresses
  const addresses: Record<string, ContactAddress> = {};
  person.addresses?.forEach((addr, i) => {
    const isWork = addr.type?.toLowerCase() === 'work';
    addresses[`addr-${i}`] = {
      full: addr.formattedValue,
      street: addr.streetAddress,
      locality: addr.city,
      region: addr.region,
      postcode: addr.postalCode,
      country: addr.country,
      contexts: isWork ? { work: true } : { private: true },
    };
  });

  // Parse Organizations
  const organizations: Record<string, ContactOrganization> = {};
  const titles: Record<string, ContactTitle> = {};
  person.organizations?.forEach((org, i) => {
    if (org.name) {
      organizations[`org-${i}`] = {
        name: org.name,
        units: org.department ? [{ name: org.department }] : undefined,
      };
    }
    if (org.title) {
      titles[`title-${i}`] = {
        name: org.title,
      };
    }
  });

  // Parse Notes / Biographies
  const notes: Record<string, ContactNote> = {};
  person.biographies?.forEach((bio, i) => {
    if (bio.value) {
      notes[`note-${i}`] = { note: bio.value };
    }
  });

  // Parse Photo
  const media: Record<string, ContactMedia> = {};
  const photo = person.photos?.find((p) => p.url && !p.default) || person.photos?.[0];
  if (photo?.url && !photo.default) {
    media['photo'] = {
      uri: photo.url,
      kind: 'photo',
    };
  }

  // Parse Birthday
  const anniversaries: Record<string, ContactAnniversary> = {};
  const bday = person.birthdays?.[0];
  if (bday?.date?.month && bday?.date?.day) {
    const monthStr = String(bday.date.month).padStart(2, '0');
    const dayStr = String(bday.date.day).padStart(2, '0');
    const dateStr = bday.date.year
      ? `${String(bday.date.year).padStart(4, '0')}-${monthStr}-${dayStr}`
      : `--${monthStr}-${dayStr}`;
    anniversaries['birthday'] = {
      kind: 'birth',
      date: dateStr,
    };
  }

  // Parse URLs / Links
  const links: Record<string, ContactLink> = {};
  person.urls?.forEach((url, i) => {
    if (url.value) {
      links[`link-${i}`] = { uri: url.value };
    }
  });

  return {
    id: namespacedId,
    originalId: person.resourceName,
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
    media: Object.keys(media).length > 0 ? media : undefined,
    anniversaries: Object.keys(anniversaries).length > 0 ? anniversaries : undefined,
    links: Object.keys(links).length > 0 ? links : undefined,
  };
}

export function contactCardToGooglePerson(contact: Partial<ContactCard>, existingEtag?: string): Partial<GooglePerson> {
  const person: Partial<GooglePerson> = {};
  if (existingEtag) {
    person.etag = existingEtag;
  }

  // Name
  const given = contact.name?.components?.find((c) => c.kind === 'given')?.value || '';
  const family = contact.name?.components?.find((c) => c.kind === 'surname')?.value || '';
  const full = contact.name?.full || [given, family].filter(Boolean).join(' ');
  if (given || family || full) {
    person.names = [
      {
        displayName: full || undefined,
        givenName: given || undefined,
        familyName: family || undefined,
      },
    ];
  }

  // Emails
  if (contact.emails) {
    person.emailAddresses = Object.values(contact.emails).map((e, idx) => ({
      value: e.address,
      type: e.contexts?.work ? 'work' : 'home',
      metadata: idx === 0 || e.pref === 1 ? { primary: true } : undefined,
    }));
  }

  // Phones
  if (contact.phones) {
    person.phoneNumbers = Object.values(contact.phones).map((p) => ({
      value: p.number,
      type: p.contexts?.work ? 'work' : 'mobile',
    }));
  }

  // Addresses
  if (contact.addresses) {
    person.addresses = Object.values(contact.addresses).map((a) => ({
      formattedValue: a.full,
      streetAddress: a.street,
      city: a.locality,
      region: a.region,
      postalCode: a.postcode,
      country: a.country,
      type: a.contexts?.work ? 'work' : 'home',
    }));
  }

  // Organizations & Titles
  const orgName = Object.values(contact.organizations || {})[0]?.name;
  const titleName = Object.values(contact.titles || {})[0]?.name;
  if (orgName || titleName) {
    person.organizations = [
      {
        name: orgName,
        title: titleName,
      },
    ];
  }

  // Notes
  const firstNote = Object.values(contact.notes || {})[0]?.note;
  if (firstNote) {
    person.biographies = [
      {
        value: firstNote,
        contentType: 'TEXT_PLAIN',
      },
    ];
  }

  // URLs
  if (contact.links) {
    person.urls = Object.values(contact.links).map((l) => ({
      value: l.uri,
    }));
  }

  return person;
}
