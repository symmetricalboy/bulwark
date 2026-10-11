import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getFiles } from '../files/route';
import { GET as downloadFile } from '../files/[fileId]/download/route';
import { POST as createFolder } from '../folders/route';
import { PATCH as updateFile, DELETE as deleteFile } from '../files/[fileId]/route';
import * as sessionModule from '@/lib/google/session';

describe('Google Drive API Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/google/drive/files', () => {
    it('returns 401 if user is not connected', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files');
      const res = await getFiles(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('not_connected');
    });

    it('queries root folder and includes orderBy', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: '1', name: 'File.txt' }] }),
      } as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files?folderId=root');
      const res = await getFiles(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.files).toHaveLength(1);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('orderBy=folder%2C+modifiedTime+desc'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("q=%27root%27+in+parents+and+trashed+%3D+false"),
        expect.anything()
      );
    });

    it('queries sharedWithMe and OMITs orderBy to prevent Google Drive 400 error', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'shared1', name: 'Shared Doc' }] }),
      } as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files?folderId=sharedWithMe');
      const res = await getFiles(req);

      expect(res.status).toBe(200);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('orderBy');
      expect(calledUrl).toContain('sharedWithMe+%3D+true+and+trashed+%3D+false');
    });

    it('queries search and OMITs orderBy to prevent Google Drive 400 error', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 's1', name: 'Search Result' }] }),
      } as Response);

      const req = new NextRequest("http://localhost:3000/api/google/drive/files?search=budget'2026");
      const res = await getFiles(req);

      expect(res.status).toBe(200);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('orderBy');
      expect(decodeURIComponent(calledUrl)).toContain("budget\\'2026");
    });
  });

  describe('GET /api/google/drive/files/[fileId]/download', () => {
    it('returns 401 if user is not connected', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files/f1/download');
      const res = await downloadFile(req, { params: Promise.resolve({ fileId: 'f1' }) });

      expect(res.status).toBe(401);
    });

    it('exports Google Workspace docs to PDF with attachment disposition by default', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      // 1. Metadata call
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'gdoc1',
            name: 'Roadmap',
            mimeType: 'application/vnd.google-apps.document',
          }),
        } as Response)
        // 2. Export call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1234' }),
          body: 'fake-pdf-stream' as never,
        } as unknown as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files/gdoc1/download');
      const res = await downloadFile(req, { params: Promise.resolve({ fileId: 'gdoc1' }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toContain('attachment');
      expect(res.headers.get('Content-Disposition')).toContain('Roadmap.pdf');
    });

    it('sets inline disposition when ?inline=true is passed', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      // 1. Metadata call
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'img1',
            name: 'Photo.jpg',
            mimeType: 'image/jpeg',
          }),
        } as Response)
        // 2. Content call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '5678' }),
          body: 'fake-img-stream' as never,
        } as unknown as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files/img1/download?inline=true');
      const res = await downloadFile(req, { params: Promise.resolve({ fileId: 'img1' }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      expect(res.headers.get('Content-Disposition')).toContain('inline');
    });

    it('handles manual redirect when Google returns 302', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      vi.spyOn(globalThis, 'fetch')
        // 1. Metadata call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'f1', name: 'File.zip', mimeType: 'application/zip' }),
        } as Response)
        // 2. Initial media request -> 302 redirect
        .mockResolvedValueOnce({
          status: 302,
          headers: new Headers({ location: 'https://doc-04-lh.googleusercontent.com/download?token=xyz' }),
        } as unknown as Response)
        // 3. Redirected target request -> 200 OK
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '9999' }),
          body: 'zip-stream' as never,
        } as unknown as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files/f1/download');
      const res = await downloadFile(req, { params: Promise.resolve({ fileId: 'f1' }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Disposition')).toContain('File.zip');
    });
  });

  describe('POST /api/google/drive/folders', () => {
    it('validates folder name', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      const req = new NextRequest('http://localhost:3000/api/google/drive/folders', {
        method: 'POST',
        body: JSON.stringify({ name: '   ' }),
      });
      const res = await createFolder(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('folder_name_required');
    });

    it('creates folder successfully', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'new-fold',
          name: 'Quarterly Reports',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      } as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/folders', {
        method: 'POST',
        body: JSON.stringify({ name: 'Quarterly Reports', parentId: 'root' }),
      });
      const res = await createFolder(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.folder.id).toBe('new-fold');
    });
  });

  describe('PATCH & DELETE /api/google/drive/files/[fileId]', () => {
    it('updates file (rename/star)', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'f1', name: 'Renamed.txt', starred: true }),
      } as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files/f1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed.txt', starred: true }),
      });
      const res = await updateFile(req, { params: Promise.resolve({ fileId: 'f1' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.file.name).toBe('Renamed.txt');
    });

    it('trashes file by default', async () => {
      vi.spyOn(sessionModule, 'getGoogleSession').mockResolvedValueOnce({
        accessToken: 'test-token',
        tokens: { accessToken: 'test-token', expiresAt: Date.now() + 10000 },
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'f1', trashed: true }),
      } as Response);

      const req = new NextRequest('http://localhost:3000/api/google/drive/files/f1', {
        method: 'DELETE',
      });
      const res = await deleteFile(req, { params: Promise.resolve({ fileId: 'f1' }) });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://www.googleapis.com/drive/v3/files/f1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ trashed: true }),
        })
      );
    });
  });
});
