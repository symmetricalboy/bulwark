import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { mapGraphItemToOneDriveItem } from '../files/route';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let body: { accountEmail?: string; name?: string; parentId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.accountEmail || !body.name?.trim()) {
    return NextResponse.json({ error: 'Missing accountEmail or folder name' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === body.accountEmail!.toLowerCase() && a.apps?.onedrive === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'OneDrive account not found or disabled' }, { status: 404 });
  }

  try {
    const endpoint =
      body.parentId && body.parentId !== 'root'
        ? `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(body.parentId)}/children`
        : `${MICROSOFT_GRAPH_BASE}/me/drive/root/children`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${acc.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: body.name.trim(),
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    });

    if (!res.ok) {
      throw new Error(`OneDrive create folder failed: ${res.status}`);
    }

    const created = await res.json();
    const folder = mapGraphItemToOneDriveItem(acc.email, created);
    const response = NextResponse.json({ folder });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to create OneDrive folder', {
      email: acc.email,
      name: body.name,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to create OneDrive folder' }, { status: 500 });
  }
}
