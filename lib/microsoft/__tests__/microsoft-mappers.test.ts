import { describe, it, expect } from 'vitest';
import { mapOutlookFolderToMailbox, mapOutlookMessageToEmail } from '../outlook-mapper';
import { mapMicrosoftToJmapCalendar, mapMicrosoftToJmapEvent } from '../calendar-mapper';
import { buildMicrosoftAddressBook, mapMicrosoftContactToCard, mapCardToMicrosoftContact } from '../contact-mapper';
import { mapMicrosoftToJmapTask, mapMicrosoftToJmapTaskList } from '../tasks-mapper';
import { mapGraphItemToOneDriveItem } from '../microsoft-onedrive-client';
import { resolveMicrosoftAppMode } from '../types';

describe('Microsoft Graph mappers', () => {
  const email = 'alex@outlook.com';

  it('normalizes app modes accurately', () => {
    expect(resolveMicrosoftAppMode(true)).toBe('separate');
    expect(resolveMicrosoftAppMode(false)).toBe('none');
    expect(resolveMicrosoftAppMode('sync')).toBe('sync');
    expect(resolveMicrosoftAppMode('separate')).toBe('separate');
  });

  it('maps Outlook mail folder and message to JMAP Mailbox & Email', () => {
    const mb = mapOutlookFolderToMailbox(
      email,
      {
        id: 'folder-inbox',
        displayName: 'Inbox',
        totalItemCount: 12,
        unreadItemCount: 3,
      },
      0
    );
    expect(mb?.id).toBe(`microsoft:${email}::folder-inbox`);
    expect(mb?.role).toBe('inbox');
    expect(mb?.unreadEmails).toBe(3);

    const mappedEmail = mapOutlookMessageToEmail(email, {
      id: 'msg-1',
      conversationId: 'conv-1',
      parentFolderId: 'folder-inbox',
      subject: 'Quarterly Review',
      bodyPreview: 'See attached report',
      isRead: false,
      flag: { flagStatus: 'flagged' },
      from: { emailAddress: { name: 'Jane Doe', address: 'jane@contoso.com' } },
      toRecipients: [{ emailAddress: { name: 'Alex', address: email } }],
      body: { contentType: 'html', content: '<p>See attached report</p>' },
    });
    expect(mappedEmail.id).toBe(`microsoft:${email}::msg-1`);
    expect(mappedEmail.keywords?.$seen).toBeUndefined();
    expect(mappedEmail.keywords?.$flagged).toBe(true);
    expect(mappedEmail.htmlBody?.[0]?.blobId).toBe(`microsoft:${email}::msg-1::body-1`);
  });

  it('maps Microsoft Calendar and Event to JMAP Calendar & CalendarEvent', () => {
    const cal = mapMicrosoftToJmapCalendar(
      { id: 'cal-1', name: 'Calendar', isDefaultCalendar: true, canEdit: true },
      email
    );
    expect(cal.id).toBe(`microsoft:${email}::cal-1`);
    expect(cal.isDefault).toBe(true);
    expect(cal.myRights.mayWriteAll).toBe(true);

    const ev = mapMicrosoftToJmapEvent(
      {
        id: 'ev-1',
        subject: 'Standup',
        start: { dateTime: '2026-10-18T14:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-10-18T14:30:00Z', timeZone: 'UTC' },
        location: { displayName: 'Teams' },
      },
      cal.id,
      email
    );
    expect(ev.id).toBe(`microsoft:${email}::ev-1`);
    expect(ev.duration).toBe('PT30M');
    expect(ev.locations?.['loc-1']?.name).toBe('Teams');
  });

  it('maps Microsoft Contact to JMAP ContactCard and back', () => {
    const book = buildMicrosoftAddressBook(email, 'Alex');
    expect(book.id).toBe(`microsoft:${email}::microsoft-contacts`);

    const card = mapMicrosoftContactToCard(
      {
        id: 'contact-1',
        givenName: 'Sam',
        surname: 'Taylor',
        displayName: 'Sam Taylor',
        emailAddresses: [{ address: 'sam@contoso.com', name: 'Sam Taylor' }],
        mobilePhone: '+15550100',
        companyName: 'Contoso',
        jobTitle: 'Engineer',
      },
      email
    );
    expect(card.id).toBe(`microsoft:${email}::contact-1`);
    expect(card.name?.full).toBe('Sam Taylor');
    expect(card.emails?.e0?.address).toBe('sam@contoso.com');

    const roundTrip = mapCardToMicrosoftContact(card);
    expect(roundTrip.givenName).toBe('Sam');
    expect(roundTrip.surname).toBe('Taylor');
    expect(roundTrip.companyName).toBe('Contoso');
  });

  it('maps Microsoft To Do lists/tasks and OneDrive items', () => {
    const list = mapMicrosoftToJmapTaskList(
      { id: 'list-1', displayName: 'Tasks', wellknownListName: 'defaultList' },
      email
    );
    expect(list.id).toBe(`microsoft:${email}::list-1`);
    expect(list.source).toBe('microsoft');

    const task = mapMicrosoftToJmapTask(
      {
        id: 'task-1',
        title: 'Finish slides',
        status: 'notStarted',
        importance: 'high',
      },
      list.id,
      email
    );
    expect(task.id).toBe(`microsoft:${email}::task-1`);
    expect(task.starred).toBe(true);
    expect(task.source).toBe('microsoft');

    const driveFile = mapGraphItemToOneDriveItem(email, {
      id: 'drive-1',
      name: 'Deck.pptx',
      size: 2048,
      file: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    });
    expect(driveFile.id).toBe(`microsoft:${email}::drive-1`);
    expect(driveFile.isFolder).toBe(false);
  });
});
