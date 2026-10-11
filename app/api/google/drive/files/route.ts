import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleDriveFilesResponse } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const folderId = searchParams.get('folderId') || 'root';
  const search = searchParams.get('search')?.trim();
  const pageToken = searchParams.get('pageToken');
  const pageSize = searchParams.get('pageSize') || '100';

  try {
    let q = 'trashed = false';
    if (search) {
      const sanitized = search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      q = `trashed = false and (name contains '${sanitized}' or fullText contains '${sanitized}')`;
    } else if (folderId === 'sharedWithMe') {
      q = 'sharedWithMe = true and trashed = false';
    } else if (folderId === 'starred') {
      q = 'starred = true and trashed = false';
    } else {
      const sanitizedFolderId = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      q = `'${sanitizedFolderId}' in parents and trashed = false`;
    }

    const driveParams = new URLSearchParams({
      q,
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, iconLink, thumbnailLink, webViewLink, webContentLink, shared, starred, trashed, parents, owners(displayName, emailAddress, photoLink), capabilities(canEdit, canDelete, canShare, canDownload))',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    // In Google Drive API v3:
    // - queries containing `fullText` DO NOT support `orderBy` (API returns 400 Bad Request)
    // - queries containing `sharedWithMe` DO NOT support `orderBy` (API returns 400 Bad Request)
    // Only set orderBy for standard folder/starred listings:
    if (!search && folderId !== 'sharedWithMe') {
      driveParams.set('orderBy', 'folder, modifiedTime desc');
    }

    if (pageToken) {
      driveParams.set('pageToken', pageToken);
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${driveParams.toString()}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to list Google Drive files', { status: res.status, details: errText });
      return NextResponse.json({ error: 'google_api_error', status: res.status, details: errText }, { status: 502 });
    }

    const data = (await res.json()) as GoogleDriveFilesResponse;
    const response = NextResponse.json({
      files: data.files || [],
      nextPageToken: data.nextPageToken,
    });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google Drive files', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
