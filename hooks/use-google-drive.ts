"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GoogleDriveFile } from '@/lib/google/types';
import {
  getGoogleStatus,
  fetchGoogleDriveFiles,
  createGoogleDriveFolder as apiCreateFolder,
  uploadGoogleDriveFile as apiUploadFile,
  renameGoogleDriveFile as apiRenameFile,
  starGoogleDriveFile as apiStarFile,
  deleteGoogleDriveFile as apiDeleteFile,
  type GoogleAccountStatus,
} from '@/lib/google/google-drive-client';
import { disconnectGoogle as apiDisconnectGoogle } from '@/lib/google/google-calendar-client';
import { toast } from '@/stores/toast-store';

export type GoogleDriveSection = 'root' | 'sharedWithMe' | 'starred';

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export function useGoogleDrive(initialAccountId?: string | null) {
  const [status, setStatus] = useState<GoogleAccountStatus>({ configured: false, connected: false });
  const [activeAccountId, setActiveAccountId] = useState<string | null>(initialAccountId || null);
  const [currentSection, setCurrentSection] = useState<GoogleDriveSection>('root');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderTrail, setFolderTrail] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('google-drive-view-mode') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  // Sync external initialAccountId prop if provided
  useEffect(() => {
    if (initialAccountId !== undefined && initialAccountId !== activeAccountId) {
      setActiveAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  const activeAccountEmail = useMemo(() => {
    if (!status.accounts || status.accounts.length === 0) return status.email;
    if (!activeAccountId) return status.accounts[0]?.email || status.email;
    const found = status.accounts.find(
      (a) => a.id === activeAccountId || a.email === activeAccountId
    );
    return found?.email || activeAccountId;
  }, [status.accounts, status.email, activeAccountId]);

  const checkStatus = useCallback(async () => {
    try {
      const currentStatus = await getGoogleStatus();
      setStatus(currentStatus);
      return currentStatus;
    } catch {
      return { configured: false, connected: false };
    }
  }, []);

  const loadFiles = useCallback(
    async (targetFolderId: string, search?: string, accountId?: string | null) => {
      setIsLoading(true);
      setError(null);
      const accId = accountId !== undefined ? accountId : activeAccountId;
      try {
        const res = await fetchGoogleDriveFiles(
          targetFolderId,
          search && search.trim() ? search.trim() : undefined,
          undefined,
          accId || undefined
        );
        setFiles(res.files || []);
        setNextPageToken(res.nextPageToken);
        setSelectedFileIds(new Set());
      } catch (err: unknown) {
        console.error('Failed to load Google Drive files:', err);
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          setStatus((prev) => ({ ...prev, connected: false }));
          setError(null);
        } else {
          setError((err as Error)?.message || 'Failed to load Google Drive files');
        }
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeAccountId]
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadFiles(currentFolderId, searchQuery, activeAccountId);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentFolderId, searchQuery, activeAccountId, loadFiles]);

  // Initial status check & initial load
  useEffect(() => {
    checkStatus().then((s) => {
      if (s.connected) {
        loadFiles('root', undefined, activeAccountId);
      }
    });
  }, [checkStatus, activeAccountId]);

  const navigateToFolder = useCallback(
    (folderId: string, folderName: string) => {
      setSearchQuery('');
      setCurrentFolderId(folderId);
      setFolderTrail((prev) => [...prev, { id: folderId, name: folderName }]);
      loadFiles(folderId);
    },
    [loadFiles]
  );

  const navigateToCrumb = useCallback(
    (index: number) => {
      setSearchQuery('');
      const target = folderTrail[index];
      if (!target) return;
      setCurrentFolderId(target.id);
      setFolderTrail((prev) => prev.slice(0, index + 1));
      loadFiles(target.id);
    },
    [folderTrail, loadFiles]
  );

  const navigateUp = useCallback(() => {
    if (folderTrail.length <= 1) return;
    const nextTrail = folderTrail.slice(0, folderTrail.length - 1);
    const target = nextTrail[nextTrail.length - 1];
    setSearchQuery('');
    setCurrentFolderId(target.id);
    setFolderTrail(nextTrail);
    loadFiles(target.id);
  }, [folderTrail, loadFiles]);

  const setSection = useCallback(
    (section: GoogleDriveSection) => {
      setCurrentSection(section);
      setSearchQuery('');
      setCurrentFolderId(section);
      if (section === 'root') {
        setFolderTrail([{ id: 'root', name: 'My Drive' }]);
      } else if (section === 'sharedWithMe') {
        setFolderTrail([{ id: 'sharedWithMe', name: 'Shared with me' }]);
      } else if (section === 'starred') {
        setFolderTrail([{ id: 'starred', name: 'Starred' }]);
      }
      loadFiles(section);
    },
    [loadFiles]
  );

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      loadFiles(currentFolderId, q);
    },
    [currentFolderId, loadFiles]
  );

  const handleSetViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('google-drive-view-mode', mode);
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFileIds(new Set(files.map((f) => f.id)));
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedFileIds(new Set());
  }, []);

  const createFolder = useCallback(
    async (name: string): Promise<GoogleDriveFile | null> => {
      try {
        const folder = await apiCreateFolder(
          name,
          currentFolderId === 'sharedWithMe' || currentFolderId === 'starred' ? 'root' : currentFolderId,
          activeAccountId || undefined
        );
        toast.success(`Created folder "${name}"`);
        setFiles((prev) => [folder, ...prev]);
        return folder;
      } catch (err) {
        console.error('Failed to create folder:', err);
        toast.error('Failed to create folder in Google Drive');
        return null;
      }
    },
    [currentFolderId, activeAccountId]
  );

  const uploadFiles = useCallback(
    async (fileList: File[]): Promise<void> => {
      const targetFolder =
        currentFolderId === 'sharedWithMe' || currentFolderId === 'starred' ? 'root' : currentFolderId;
      for (const file of fileList) {
        try {
          const uploaded = await apiUploadFile(file, targetFolder, activeAccountId || undefined);
          setFiles((prev) => [uploaded, ...prev]);
          toast.success(`Uploaded "${file.name}" to Google Drive`);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          toast.error(`Failed to upload "${file.name}"`);
        }
      }
    },
    [currentFolderId, activeAccountId]
  );

  const renameFile = useCallback(
    async (fileId: string, newName: string): Promise<boolean> => {
      try {
        const updated = await apiRenameFile(fileId, newName, activeAccountId || undefined);
        setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
        toast.success('Renamed successfully');
        return true;
      } catch (err) {
        console.error('Failed to rename file:', err);
        toast.error('Failed to rename file');
        return false;
      }
    },
    [activeAccountId]
  );

  const starFile = useCallback(
    async (fileId: string, starred: boolean): Promise<boolean> => {
      try {
        const updated = await apiStarFile(fileId, starred, activeAccountId || undefined);
        setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
        return true;
      } catch (err) {
        console.error('Failed to star/unstar file:', err);
        toast.error('Failed to update star');
        return false;
      }
    },
    [activeAccountId]
  );

  const deleteFile = useCallback(
    async (fileId: string, permanent: boolean = false): Promise<boolean> => {
      try {
        await apiDeleteFile(fileId, permanent, activeAccountId || undefined);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setSelectedFileIds((prev) => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
        toast.success(permanent ? 'File deleted permanently' : 'File moved to trash');
        return true;
      } catch (err) {
        console.error('Failed to delete file:', err);
        toast.error('Failed to delete file');
        return false;
      }
    },
    [activeAccountId]
  );

  const connectGoogle = useCallback(() => {
    const returnTo = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/files';
    window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  const disconnectGoogle = useCallback(async (accountIdOrEmail?: string) => {
    const target = accountIdOrEmail || activeAccountId || undefined;
    const ok = await apiDisconnectGoogle(target);
    if (ok) {
      const refreshedStatus = await getGoogleStatus();
      setStatus(refreshedStatus);
      if (refreshedStatus.connected && refreshedStatus.accounts?.length) {
        setActiveAccountId(refreshedStatus.accounts[0].id);
      } else {
        setActiveAccountId(null);
        setFiles([]);
      }
      toast.success('Disconnected Google Account');
    }
  }, [activeAccountId]);

  useEffect(() => {
    const handleUpdated = () => {
      void checkStatus().then(() => void refresh());
    };
    window.addEventListener('google-services-updated', handleUpdated);
    return () => window.removeEventListener('google-services-updated', handleUpdated);
  }, [checkStatus, refresh]);

  return {
    status,
    activeAccountId,
    setActiveAccountId,
    activeAccountEmail,
    currentSection,
    currentFolderId,
    folderTrail,
    files,
    isLoading,
    isRefreshing,
    error,
    searchQuery,
    viewMode,
    selectedFileIds,
    nextPageToken,
    checkStatus,
    loadFiles,
    refresh,
    navigateToFolder,
    navigateToCrumb,
    navigateUp,
    setSection,
    handleSearch,
    setViewMode: handleSetViewMode,
    toggleSelect,
    selectAll,
    clearSelection,
    createFolder,
    uploadFiles,
    renameFile,
    starFile,
    deleteFile,
    connectGoogle,
    disconnectGoogle,
  };
}
