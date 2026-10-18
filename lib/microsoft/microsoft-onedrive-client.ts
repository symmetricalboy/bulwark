export interface OneDriveItem {
  id: string;
  rawId: string;
  accountEmail: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  starred: boolean;
  trashed: boolean;
  parents: string[];
  webViewLink?: string;
  isFolder: boolean;
}

export type OneDriveSection = 'my-drive' | 'shared' | 'recent';

export interface OneDriveAccountInfo {
  id: string;
  email: string;
  name?: string;
}

export async function listOneDriveFilesClient(params: {
  accountEmail?: string;
  folderId?: string;
  section?: OneDriveSection;
  q?: string;
}): Promise<{
  files: OneDriveItem[];
  accounts: OneDriveAccountInfo[];
}> {
  const searchParams = new URLSearchParams();
  if (params.accountEmail) searchParams.set('accountEmail', params.accountEmail);
  if (params.folderId) searchParams.set('folderId', params.folderId);
  if (params.section) searchParams.set('section', params.section);
  if (params.q) searchParams.set('q', params.q);

  const res = await fetch(`/api/microsoft/onedrive/files?${searchParams.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to list OneDrive files');
  }
  return res.json();
}

export async function createOneDriveFolderClient(params: {
  accountEmail: string;
  name: string;
  parentId?: string;
}): Promise<OneDriveItem> {
  const res = await fetch('/api/microsoft/onedrive/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create OneDrive folder');
  }
  const data = await res.json();
  return data.folder;
}

export async function uploadOneDriveFileClient(params: {
  accountEmail: string;
  file: File;
  parentId?: string;
}): Promise<OneDriveItem> {
  const formData = new FormData();
  formData.append('accountEmail', params.accountEmail);
  formData.append('file', params.file);
  if (params.parentId) {
    formData.append('parentId', params.parentId);
  }

  const res = await fetch('/api/microsoft/onedrive/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload file to OneDrive');
  }
  const data = await res.json();
  return data.file;
}

export async function updateOneDriveFileClient(
  namespacedFileId: string,
  updates: {
    name?: string;
  }
): Promise<OneDriveItem> {
  const res = await fetch(`/api/microsoft/onedrive/files/${encodeURIComponent(namespacedFileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update OneDrive item');
  }
  const data = await res.json();
  return data.file;
}

export async function deleteOneDriveFileClient(namespacedFileId: string): Promise<void> {
  const res = await fetch(`/api/microsoft/onedrive/files/${encodeURIComponent(namespacedFileId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete OneDrive item');
  }
}

export function getOneDriveDownloadUrl(namespacedFileId: string): string {
  return `/api/microsoft/onedrive/files/${encodeURIComponent(namespacedFileId)}/download`;
}

export interface GraphDriveItem {
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
