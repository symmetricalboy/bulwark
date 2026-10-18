import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { mapGraphItemToOneDriveItem } from '@/lib/microsoft/microsoft-onedrive-client';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accountEmail = (formData.get('accountEmail') as string) || '';
    const parentId = (formData.get('parentId') as string) || 'root';
    const file = formData.get('file') as File | null;

    if (!accountEmail || !file) {
      return NextResponse.json({ error: 'Missing accountEmail or file' }, { status: 400 });
    }

    const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
    const acc = accounts.find(
      (a) => a.email.toLowerCase() === accountEmail.toLowerCase() && a.apps?.onedrive === true
    );

    if (!acc) {
      return NextResponse.json({ error: 'OneDrive account not found or disabled' }, { status: 404 });
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());
    const safeFileName = encodeURIComponent(file.name);
    const endpoint =
      parentId && parentId !== 'root'
        ? `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(parentId)}:/${safeFileName}:/content`
        : `${MICROSOFT_GRAPH_BASE}/me/drive/root:/${safeFileName}:/content`;

    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${acc.accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileBytes,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OneDrive upload failed (${res.status}): ${errText}`);
    }

    const created = await res.json();
    const mapped = mapGraphItemToOneDriveItem(acc.email, created);
    const response = NextResponse.json({ file: mapped });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to upload file to OneDrive', { error: err });
    return NextResponse.json({ error: 'Failed to upload file to OneDrive' }, { status: 500 });
  }
}
