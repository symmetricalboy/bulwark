import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GoogleDriveBrowser } from '../google-drive-browser';
import type { GoogleDriveFile } from '@/lib/google/types';

vi.mock('@/lib/debug', () => ({ debug: { log: () => {}, warn: () => {}, error: () => {} } }));

const DRIVE_FILES: GoogleDriveFile[] = [
  {
    id: 'folder-1',
    name: 'Designs',
    mimeType: 'application/vnd.google-apps.folder',
  },
  {
    id: 'file-1',
    name: 'Presentation.pdf',
    mimeType: 'application/pdf',
    size: '1048576',
    modifiedTime: '2026-10-05T10:00:00Z',
  },
  {
    id: 'file-2',
    name: 'Spreadsheet.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: '524288',
    modifiedTime: '2026-10-06T10:00:00Z',
    starred: true,
  },
];

const mockStatus = {
  configured: true,
  connected: true,
  email: 'tester@gmail.com',
  name: 'Tester',
};

const mockFetchFiles = vi.fn();
const mockCreateFolder = vi.fn();
const mockDeleteFile = vi.fn();
const mockStarFile = vi.fn();

vi.mock('@/lib/google/google-drive-client', () => ({
  getGoogleStatus: vi.fn(async () => mockStatus),
  fetchGoogleDriveFiles: (folderId?: string, search?: string) => mockFetchFiles(folderId, search),
  createGoogleDriveFolder: (name: string, parentId?: string) => mockCreateFolder(name, parentId),
  deleteGoogleDriveFile: (fileId: string) => mockDeleteFile(fileId),
  starGoogleDriveFile: (fileId: string, starred: boolean) => mockStarFile(fileId, starred),
  getGoogleDriveDownloadUrl: (id: string) => `/api/google/drive/files/${id}/download`,
  downloadGoogleDriveFileBlob: vi.fn(),
}));

describe('GoogleDriveBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus.connected = true;
    mockFetchFiles.mockResolvedValue({ files: DRIVE_FILES });
  });

  it('renders Google Drive interface with files and navigation when connected', async () => {
    render(<GoogleDriveBrowser />);

    expect(await screen.findByText('tester@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('my_drive')).toBeInTheDocument();
    expect(screen.getByText('shared_with_me')).toBeInTheDocument();
    expect(screen.getByText('starred')).toBeInTheDocument();

    expect(await screen.findByText('Designs')).toBeInTheDocument();
    expect(screen.getByText('Presentation.pdf')).toBeInTheDocument();
    expect(screen.getByText('Spreadsheet.xlsx')).toBeInTheDocument();
  });

  it('switches section to Starred when Starred pill is clicked', async () => {
    render(<GoogleDriveBrowser />);
    await screen.findByText('Designs');

    fireEvent.click(screen.getByText('starred'));
    expect(mockFetchFiles).toHaveBeenCalledWith('starred', undefined);
  });

  it('toggles Details panel when info button is clicked', async () => {
    render(<GoogleDriveBrowser />);
    await screen.findByText('Presentation.pdf');

    // Click details button
    const detailsBtn = screen.getByTitle('details');
    fireEvent.click(detailsBtn);

    // Inspector sidebar is visible
    expect(screen.getByText('Select a file to inspect details')).toBeInTheDocument();

    // Click file to inspect
    fireEvent.click(screen.getByText('Presentation.pdf'));
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
  });

  it('shows connect prompt when disconnected', async () => {
    mockStatus.connected = false;
    render(<GoogleDriveBrowser />);

    expect(await screen.findByText('connect_button')).toBeInTheDocument();
  });

  it('renders error state with retry and reconnect buttons when fetching files fails', async () => {
    mockFetchFiles.mockRejectedValueOnce(new Error('Google Drive quota exceeded'));
    render(<GoogleDriveBrowser />);

    expect(await screen.findByText('Failed to load Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Google Drive quota exceeded')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('resets to connect prompt when fetch returns 401 unauthenticated', async () => {
    const err = new Error('Unauthorized') as Error & { status?: number };
    err.status = 401;
    mockFetchFiles.mockRejectedValueOnce(err);

    render(<GoogleDriveBrowser />);

    expect(await screen.findByText('connect_button')).toBeInTheDocument();
  });
});
