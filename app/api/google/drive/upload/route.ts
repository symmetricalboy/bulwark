import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleDriveFile } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;
    const googleAccountId = formData.get('googleAccountId') as string | null;

    const session = await getGoogleSession(request, {
      accountId: googleAccountId || undefined,
      app: 'drive',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: 'file_required' }, { status: 400 });
    }

    const metadata: { name: string; parents?: string[] } = {
      name: file.name,
    };
    if (parentId && parentId !== 'root') {
      metadata.parents = [parentId];
    }

    const boundary = `----DriveUploadBoundary${Date.now()}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaPartHeader = `${delimiter}Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

    const fileBuffer = await file.arrayBuffer();
    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(metadataPart);
    const mediaHeaderBytes = encoder.encode(mediaPartHeader);
    const closeBytes = encoder.encode(closeDelimiter);

    const fullLength = metaBytes.length + mediaHeaderBytes.length + fileBuffer.byteLength + closeBytes.length;
    const combined = new Uint8Array(fullLength);

    let offset = 0;
    combined.set(metaBytes, offset);
    offset += metaBytes.length;
    combined.set(mediaHeaderBytes, offset);
    offset += mediaHeaderBytes.length;
    combined.set(new Uint8Array(fileBuffer), offset);
    offset += fileBuffer.byteLength;
    combined.set(closeBytes, offset);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,createdTime,iconLink,thumbnailLink,webViewLink,parents,capabilities&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: combined,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      logger.error('Failed to upload file to Google Drive', { status: uploadRes.status, details: errText });
      return NextResponse.json({ error: 'google_api_error', status: uploadRes.status, details: errText }, { status: 502 });
    }

    const createdFile = (await uploadRes.json()) as GoogleDriveFile;
    const response = NextResponse.json({ file: createdFile });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception uploading to Google Drive', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
