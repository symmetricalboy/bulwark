import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleDriveFile } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: 'missing_file_id' }, { status: 400 });
  }

  try {
    const fields = 'id, name, mimeType, size, modifiedTime, createdTime, iconLink, thumbnailLink, webViewLink, webContentLink, shared, starred, trashed, parents, owners(displayName, emailAddress, photoLink), capabilities(canEdit, canDelete, canShare, canDownload)';
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to get Google Drive file', { fileId, status: res.status, details: errText });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: res.status === 404 ? 404 : 502 });
    }

    const file = (await res.json()) as GoogleDriveFile;
    const response = NextResponse.json({ file });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception getting Google Drive file', { err, fileId });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: 'missing_file_id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, starred, trashed, addParents, removeParents } = body;

    const patchBody: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) patchBody.name = name.trim();
    if (typeof starred === 'boolean') patchBody.starred = starred;
    if (typeof trashed === 'boolean') patchBody.trashed = trashed;

    const queryParams = new URLSearchParams({
      fields: 'id, name, mimeType, size, modifiedTime, createdTime, iconLink, thumbnailLink, webViewLink, webContentLink, shared, starred, trashed, parents, owners(displayName, emailAddress, photoLink), capabilities(canEdit, canDelete, canShare, canDownload)',
      supportsAllDrives: 'true',
    });
    if (addParents) queryParams.set('addParents', addParents);
    if (removeParents) queryParams.set('removeParents', removeParents);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${queryParams.toString()}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to update Google Drive file', { fileId, status: res.status, details: errText });
      return NextResponse.json({ error: 'google_api_error', status: res.status, details: errText }, { status: 502 });
    }

    const file = (await res.json()) as GoogleDriveFile;
    const response = NextResponse.json({ file });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception updating Google Drive file', { err, fileId });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: 'missing_file_id' }, { status: 400 });
  }

  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  try {
    if (permanent) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }
      );

      if (!res.ok && res.status !== 404) {
        const errText = await res.text();
        logger.error('Failed to permanently delete Google Drive file', { fileId, status: res.status, details: errText });
        return NextResponse.json({ error: 'google_api_error', status: res.status, details: errText }, { status: 502 });
      }
    } else {
      // By default move to trash rather than permanent delete
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trashed: true }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        logger.error('Failed to trash Google Drive file', { fileId, status: res.status, details: errText });
        return NextResponse.json({ error: 'google_api_error', status: res.status, details: errText }, { status: 502 });
      }
    }

    const response = NextResponse.json({ success: true, fileId });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception deleting Google Drive file', { err, fileId });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
