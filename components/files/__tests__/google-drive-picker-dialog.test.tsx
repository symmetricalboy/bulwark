import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GoogleDrivePickerDialog } from '../google-drive-picker-dialog';
import type { GoogleDriveFile } from '@/lib/google/types';

vi.mock('@/lib/debug', () => ({ debug: { log: () => {}, warn: () => {}, error: () => {} } }));

const DRIVE_FILES: GoogleDriveFile[] = [
  {
    id: 'folder-work',
    name: 'Work',
    mimeType: 'application/vnd.google-apps.folder',
  },
  {
    id: 'doc-report',
    name: 'Q3 Report.pdf',
    mimeType: 'application/pdf',
    size: '2048',
    modifiedTime: '2026-10-01T12:00:00Z',
  },
  {
    id: 'sheet-budget',
    name: 'Budget 2026',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    size: '1024',
    modifiedTime: '2026-10-02T12:00:00Z',
  },
];

const mockGetGoogleStatus = vi.fn();
const mockFetchGoogleDriveFiles = vi.fn();

vi.mock('@/lib/google/google-drive-client', () => ({
  getGoogleStatus: () => mockGetGoogleStatus(),
  fetchGoogleDriveFiles: (folderId?: string, search?: string) => mockFetchGoogleDriveFiles(folderId, search),
}));

describe('GoogleDrivePickerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders connect prompt when Google Account is not connected', async () => {
    mockGetGoogleStatus.mockResolvedValue({ configured: true, connected: false });
    render(<GoogleDrivePickerDialog isOpen={true} onClose={vi.fn()} onPick={vi.fn()} />);

    expect(await screen.findByText('connect_google_drive')).toBeInTheDocument();
    expect(screen.getByText('connect_button')).toBeInTheDocument();
  });

  it('lists files and folders when connected and handles selection', async () => {
    mockGetGoogleStatus.mockResolvedValue({ configured: true, connected: true, email: 'user@gmail.com' });
    mockFetchGoogleDriveFiles.mockResolvedValue({ files: DRIVE_FILES });
    const onPick = vi.fn();

    render(<GoogleDrivePickerDialog isOpen={true} onClose={vi.fn()} onPick={onPick} />);

    expect(await screen.findByText('Q3 Report.pdf')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Budget 2026')).toBeInTheDocument();

    // Click file to select
    fireEvent.click(screen.getByText('Q3 Report.pdf'));
    expect(screen.getByText(/Attach \(1\)/i)).toBeInTheDocument();

    // Click Attach
    fireEvent.click(screen.getByText(/Attach \(1\)/i));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0][0].id).toBe('doc-report');
  });

  it('navigates into folders when folder is clicked', async () => {
    mockGetGoogleStatus.mockResolvedValue({ configured: true, connected: true, email: 'user@gmail.com' });
    mockFetchGoogleDriveFiles.mockImplementation(async (folderId?: string) => {
      if (folderId === 'folder-work') {
        return {
          files: [
            {
              id: 'file-sub',
              name: 'Project Plan.docx',
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              size: '4096',
            },
          ],
        };
      }
      return { files: DRIVE_FILES };
    });

    render(<GoogleDrivePickerDialog isOpen={true} onClose={vi.fn()} onPick={vi.fn()} />);

    expect(await screen.findByText('Work')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Work'));

    expect(await screen.findByText('Project Plan.docx')).toBeInTheDocument();
    expect(mockFetchGoogleDriveFiles).toHaveBeenCalledWith('folder-work', undefined);
  });

  it('renders error state with retry button when loading files fails', async () => {
    mockGetGoogleStatus.mockResolvedValue({ configured: true, connected: true, email: 'user@gmail.com' });
    mockFetchGoogleDriveFiles.mockRejectedValueOnce(new Error('Network offline'));

    render(<GoogleDrivePickerDialog isOpen={true} onClose={vi.fn()} onPick={vi.fn()} />);

    expect(await screen.findByText('Failed to load files')).toBeInTheDocument();
    expect(screen.getByText('Network offline')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles 401 unauthorized in picker by displaying connect prompt', async () => {
    mockGetGoogleStatus.mockResolvedValue({ configured: true, connected: true, email: 'user@gmail.com' });
    const err = new Error('Unauthorized') as Error & { status?: number };
    err.status = 401;
    mockFetchGoogleDriveFiles.mockRejectedValueOnce(err);

    render(<GoogleDrivePickerDialog isOpen={true} onClose={vi.fn()} onPick={vi.fn()} />);

    expect(await screen.findByText('connect_button')).toBeInTheDocument();
  });
});
