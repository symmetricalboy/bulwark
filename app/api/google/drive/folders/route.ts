import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleDriveFile } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId, googleAccountId } = body;

    const session = await getGoogleSession(request, {
      accountId: googleAccountId,
      app: 'drive',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'folder_name_required' }, { status: 400 });
    }

    const payload: { name: string; mimeType: string; parents?: string[] } = {
      name: name.trim(),
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId && parentId !== 'root') {
      payload.parents = [parentId];
    }

    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,createdTime,iconLink,thumbnailLink,webViewLink,parents,capabilities&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to create Google Drive folder', { status: res.status, details: errText });
      return NextResponse.json({ error: 'google_api_error', status: res.status, details: errText }, { status: 502 });
    }

    const folder = (await res.json()) as GoogleDriveFile;
    const response = NextResponse.json({ folder });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google Drive folder', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
