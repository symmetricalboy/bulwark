import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import type { OneDriveItem, OneDriveSection } from '@/lib/microsoft/microsoft-onedrive-client';
import { logger } from '@/lib/logger';

interface GraphDriveItem {
  id: string;
  name?: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  webUrl?: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  parentReference?: { id?: string };
}

export function mapGraphItemToOneDriveItem(accountEmail: string, item: GraphDriveItem): OneDriveItem {
  const isFolder = Boolean(item.folder);
  const now = new Date().toISOString();
  return {
    id: `microsoft:${accountEmail}::${item.id}`,
    rawId: item.id,
    accountEmail,
    name: item.name || 'Untitled',
    mimeType: isFolder ? 'application/vnd.microsoft.folder' : item.file?.mimeType || 'application/octet-stream',
    size: item.size || 0,
    createdTime: item.createdDateTime || now,
    modifiedTime: item.lastModifiedDateTime || item.createdDateTime || now,
    starred: false,
    trashed: false,
    parents: item.parentReference?.id ? [item.parentReference.id] : [],
    webViewLink: item.webUrl,
    isFolder,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountEmailParam = searchParams.get('accountEmail') || '';
  const folderId = searchParams.get('folderId') || 'root';
  const section = (searchParams.get('section') || 'my-drive') as OneDriveSection;
  const searchQuery = searchParams.get('q') || '';

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const oneDriveAccounts = accounts.filter((a) => a.apps?.onedrive === true);

  const accountInfos = oneDriveAccounts.map((a) => ({
    id: a.id || a.email.toLowerCase(),
    email: a.email,
    name: a.name,
  }));

  if (oneDriveAccounts.length === 0) {
    const res = NextResponse.json({ files: [], accounts: [] });
    if (updatedSession) setMicrosoftSessionCookie(res, updatedSession);
    return res;
  }

  const acc = accountEmailParam
    ? oneDriveAccounts.find((a) => a.email.toLowerCase() === accountEmailParam.toLowerCase()) ||
      oneDriveAccounts[0]
    : oneDriveAccounts[0];

  try {
    let url: string;
    if (searchQuery.trim()) {
      const safeQ = searchQuery.trim().replace(/'/g, "''");
      url = `${MICROSOFT_GRAPH_BASE}/me/drive/root/search(q='${encodeURIComponent(safeQ)}')?$top=100`;
    } else if (section === 'shared') {
      url = `${MICROSOFT_GRAPH_BASE}/me/drive/sharedWithMe?$top=100`;
    } else if (section === 'recent') {
      url = `${MICROSOFT_GRAPH_BASE}/me/drive/recent?$top=100`;
    } else if (!folderId || folderId === 'root') {
      url = `${MICROSOFT_GRAPH_BASE}/me/drive/root/children?$top=100`;
    } else {
      url = `${MICROSOFT_GRAPH_BASE}/me/drive/items/${encodeURIComponent(folderId)}/children?$top=100`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${acc.accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`OneDrive list failed: ${res.status}`);
    }

    const data = await res.json();
    const rawItems = (data.value || []) as GraphDriveItem[];
    const files: OneDriveItem[] = rawItems.map((f) => mapGraphItemToOneDriveItem(acc.email, f));

    const response = NextResponse.json({
      files,
      accounts: accountInfos,
    });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to list OneDrive files', { email: acc.email, error: err });
    return NextResponse.json({ error: 'Failed to list OneDrive files' }, { status: 500 });
  }
}
