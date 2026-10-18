import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { mapGraphItemToOneDriveItem } from '../route';
import { logger } from '@/lib/logger';

function parseNamespacedFileId(rawId: string): { accountEmail: string; fileId: string } | null {
  const decoded = decodeURIComponent(rawId);
  if (!decoded.startsWith('microsoft:')) return null;
  const rest = decoded.slice('microsoft:'.length);
  const sepIdx = rest.indexOf('::');
  if (sepIdx < 0) return null;
  return {
    accountEmail: rest.slice(0, sepIdx),
    fileId: rest.slice(sepIdx + 2),
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  const parsed = parseNamespacedFileId(fileId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid OneDrive file ID' }, { status: 400 });
  }

  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === parsed.accountEmail.toLowerCase() && a.apps?.onedrive === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'OneDrive account not found' }, { status: 404 });
  }

  try {
    const res = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(parsed.fileId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: body.name }),
      }
    );

    if (!res.ok) {
      throw new Error(`OneDrive update failed: ${res.status}`);
    }

    const updated = await res.json();
    const file = mapGraphItemToOneDriveItem(acc.email, updated);
    const response = NextResponse.json({ file });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to update OneDrive item', {
      email: acc.email,
      fileId: parsed.fileId,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to update OneDrive item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  const parsed = parseNamespacedFileId(fileId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid OneDrive file ID' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === parsed.accountEmail.toLowerCase() && a.apps?.onedrive === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'OneDrive account not found' }, { status: 404 });
  }

  try {
    const res = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(parsed.fileId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      }
    );

    if (!res.ok && res.status !== 404) {
      throw new Error(`OneDrive delete failed: ${res.status}`);
    }

    const response = NextResponse.json({ success: true });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to delete OneDrive item', {
      email: acc.email,
      fileId: parsed.fileId,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to delete OneDrive item' }, { status: 500 });
  }
}
