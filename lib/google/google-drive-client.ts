import type { GoogleDriveFile, GoogleDriveFilesResponse } from './types';
import { getGoogleStatus, type GoogleAccountStatus } from './google-calendar-client';
import { getComailAccountHeaders } from './comail-headers';

export { getGoogleStatus, type GoogleAccountStatus };

export async function fetchGoogleDriveFiles(
  folderId?: string,
  search?: string,
  pageToken?: string
): Promise<GoogleDriveFilesResponse> {
  const query = new URLSearchParams();
  if (folderId) query.set('folderId', folderId);
  if (search) query.set('search', search);
  if (pageToken) query.set('pageToken', pageToken);

  const res = await fetch(`/api/google/drive/files?${query.toString()}`, {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    let errMessage = `Failed to fetch Google Drive files (${res.status})`;
    try {
      const data = await res.json();
      if (data.details) {
        errMessage = `${errMessage}: ${data.details}`;
      } else if (data.error) {
        errMessage = `${errMessage}: ${data.error}`;
      }
    } catch {
      // ignore JSON parse error
    }
    const err = new Error(errMessage) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

export async function fetchGoogleDriveFile(fileId: string): Promise<GoogleDriveFile> {
  const res = await fetch(`/api/google/drive/files/${encodeURIComponent(fileId)}`, {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Drive file (${res.status})`);
  }
  const data = await res.json();
  return data.file;
}

export async function createGoogleDriveFolder(name: string, parentId?: string): Promise<GoogleDriveFile> {
  const res = await fetch('/api/google/drive/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Google Drive folder (${res.status})`);
  }
  const data = await res.json();
  return data.folder;
}

export async function uploadGoogleDriveFile(file: File, parentId?: string): Promise<GoogleDriveFile> {
  const formData = new FormData();
  formData.append('file', file);
  if (parentId && parentId !== 'root') {
    formData.append('parentId', parentId);
  }

  const res = await fetch('/api/google/drive/upload', {
    method: 'POST',
    headers: getComailAccountHeaders(),
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload file to Google Drive (${res.status})`);
  }
  const data = await res.json();
  return data.file;
}

export async function renameGoogleDriveFile(fileId: string, newName: string): Promise<GoogleDriveFile> {
  const res = await fetch(`/api/google/drive/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to rename Google Drive file (${res.status})`);
  }
  const data = await res.json();
  return data.file;
}

export async function starGoogleDriveFile(fileId: string, starred: boolean): Promise<GoogleDriveFile> {
  const res = await fetch(`/api/google/drive/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ starred }),
  });
  if (!res.ok) {
    throw new Error(`Failed to star Google Drive file (${res.status})`);
  }
  const data = await res.json();
  return data.file;
}

export async function deleteGoogleDriveFile(fileId: string, permanent: boolean = false): Promise<void> {
  const query = permanent ? '?permanent=true' : '';
  const res = await fetch(`/api/google/drive/files/${encodeURIComponent(fileId)}${query}`, {
    method: 'DELETE',
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete Google Drive file (${res.status})`);
  }
}

export function getGoogleDriveDownloadUrl(fileId: string, format?: string, inline?: boolean): string {
  const query = new URLSearchParams();
  if (format) query.set('format', format);
  if (inline) query.set('inline', 'true');
  const qs = query.toString();
  return `/api/google/drive/files/${encodeURIComponent(fileId)}/download${qs ? `?${qs}` : ''}`;
}

export async function downloadGoogleDriveFileBlob(
  fileId: string,
  format?: string
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const url = getGoogleDriveDownloadUrl(fileId, format);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }

  let filename = 'download';
  const disposition = res.headers.get('Content-Disposition');
  if (disposition) {
    const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2]);
    }
  }

  const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';
  const blob = await res.blob();
  return { blob, filename, mimeType };
}
