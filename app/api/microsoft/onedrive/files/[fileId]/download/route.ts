import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts } from '@/lib/microsoft/session';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  const parsed = parseNamespacedFileId(fileId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid OneDrive file ID' }, { status: 400 });
  }

  const { accounts } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === parsed.accountEmail.toLowerCase() && a.apps?.onedrive === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'OneDrive account not found' }, { status: 404 });
  }

  try {
    const metaRes = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(parsed.fileId)}`,
      {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      }
    );

    if (!metaRes.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const meta = await metaRes.json();
    const fileName = meta.name || 'download';
    const contentType = meta.file?.mimeType || 'application/octet-stream';

    const contentRes = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(parsed.fileId)}/content`,
      {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      }
    );

    if (!contentRes.ok || !contentRes.body) {
      throw new Error(`OneDrive download failed: ${contentRes.status}`);
    }

    return new NextResponse(contentRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (err) {
    logger.error('Failed to download OneDrive file', {
      email: acc.email,
      fileId: parsed.fileId,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to download OneDrive file' }, { status: 500 });
  }
}
