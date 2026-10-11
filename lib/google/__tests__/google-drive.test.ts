import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchGoogleDriveFiles,
  createGoogleDriveFolder,
  renameGoogleDriveFile,
  starGoogleDriveFile,
  deleteGoogleDriveFile,
  getGoogleDriveDownloadUrl,
  downloadGoogleDriveFileBlob,
} from '../google-drive-client';

describe('Google Drive Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches files with query parameters', async () => {
    const mockFiles = [{ id: 'f1', name: 'Notes.txt', mimeType: 'text/plain' }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: mockFiles }),
    } as Response);

    const res = await fetchGoogleDriveFiles('root', 'Notes');
    expect(res.files).toEqual(mockFiles);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/google/drive/files?folderId=root&search=Notes'),
      expect.anything()
    );
  });

  it('creates folder via POST /api/google/drive/folders', async () => {
    const mockFolder = { id: 'fold-1', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ folder: mockFolder }),
    } as Response);

    const res = await createGoogleDriveFolder('Projects', 'root');
    expect(res).toEqual(mockFolder);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/google/drive/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projects', parentId: 'root' }),
    });
  });

  it('renames file via PATCH /api/google/drive/files/:id', async () => {
    const updated = { id: 'f1', name: 'NewName.txt', mimeType: 'text/plain' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ file: updated }),
    } as Response);

    const res = await renameGoogleDriveFile('f1', 'NewName.txt');
    expect(res).toEqual(updated);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/google/drive/files/f1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewName.txt' }),
    });
  });

  it('stars file via PATCH /api/google/drive/files/:id', async () => {
    const updated = { id: 'f1', name: 'Name.txt', mimeType: 'text/plain', starred: true };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ file: updated }),
    } as Response);

    const res = await starGoogleDriveFile('f1', true);
    expect(res.starred).toBe(true);
  });

  it('deletes file via DELETE /api/google/drive/files/:id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response);

    await deleteGoogleDriveFile('f1', false);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/google/drive/files/f1', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('generates download URL and downloads blob with parsed filename', async () => {
    const downloadUrl = getGoogleDriveDownloadUrl('f1', 'pdf');
    expect(downloadUrl).toBe('/api/google/drive/files/f1/download?format=pdf');

    const fakeBlob = new Blob(['hello world'], { type: 'application/pdf' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Document.pdf"',
      }),
      blob: async () => fakeBlob,
    } as Response);

    const result = await downloadGoogleDriveFileBlob('f1');
    expect(result.filename).toBe('Document.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.blob).toBe(fakeBlob);
  });
});
