import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession } from '@/lib/google/session';
import type { GoogleDriveFile } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GOOGLE_WORKSPACE_EXPORTS: Record<string, { mimeType: string; ext: string }> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/pdf',
    ext: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/pdf',
    ext: '.pdf',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'image/png',
    ext: '.png',
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: 'missing_file_id' }, { status: 400 });
  }

  const requestedAccountId = request.nextUrl.searchParams.get('googleAccountId') || (fileId.includes('::') ? fileId : undefined);
  const session = await getGoogleSession(request, { accountId: requestedAccountId, app: 'drive' });
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const rawFileId = fileId.includes('::') ? fileId.split('::')[1] : fileId;
  const formatParam = request.nextUrl.searchParams.get('format')?.toLowerCase();

  try {
    // 1. Fetch file metadata to determine name and mimeType
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rawFileId)}?fields=id,name,mimeType,size&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      logger.error('Failed to get Google Drive file metadata for download', { fileId, status: metaRes.status, details: errText });
      return NextResponse.json({ error: 'google_api_error', status: metaRes.status }, { status: metaRes.status === 404 ? 404 : 502 });
    }

    const meta = (await metaRes.json()) as GoogleDriveFile;
    const isWorkspace = Boolean(GOOGLE_WORKSPACE_EXPORTS[meta.mimeType]);

    let downloadUrl: string;
    let contentType: string;
    let filename = meta.name || 'file';

    if (isWorkspace) {
      let exportInfo = GOOGLE_WORKSPACE_EXPORTS[meta.mimeType];
      if (formatParam === 'docx' && meta.mimeType === 'application/vnd.google-apps.document') {
        exportInfo = { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' };
      } else if (formatParam === 'pdf' && meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
        exportInfo = { mimeType: 'application/pdf', ext: '.pdf' };
      } else if (formatParam === 'pptx' && meta.mimeType === 'application/vnd.google-apps.presentation') {
        exportInfo = { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: '.pptx' };
      }

      contentType = exportInfo.mimeType;
      if (!filename.toLowerCase().endsWith(exportInfo.ext)) {
        filename = `${filename}${exportInfo.ext}`;
      }
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(contentType)}&supportsAllDrives=true`;
    } else {
      contentType = meta.mimeType || 'application/octet-stream';
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    }

    let contentRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      redirect: 'manual',
    });

    if (
      contentRes.status === 301 ||
      contentRes.status === 302 ||
      contentRes.status === 303 ||
      contentRes.status === 307 ||
      contentRes.status === 308
    ) {
      const location = contentRes.headers.get('location');
      if (location) {
        const isGoogleApis =
          location.startsWith('https://www.googleapis.com') ||
          location.startsWith('https://drive.google.com');
        contentRes = await fetch(location, {
          headers: isGoogleApis ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
        });
      }
    }

    if (!contentRes.ok) {
      const errText = await contentRes.text();
      logger.error('Failed to download Google Drive file content', { fileId, status: contentRes.status, details: errText });
      return NextResponse.json({ error: 'download_failed', status: contentRes.status, details: errText }, { status: 502 });
    }

    const isInline = request.nextUrl.searchParams.get('inline') === 'true';
    const dispositionType = isInline ? 'inline' : 'attachment';

    const safeAsciiFilename = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set(
      'Content-Disposition',
      `${dispositionType}; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    const contentLength = contentRes.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new Response(contentRes.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    logger.error('Exception downloading Google Drive file', { err, fileId });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
