import { useState, useEffect, useCallback } from 'react';
import {
  listOneDriveFilesClient,
  createOneDriveFolderClient,
  uploadOneDriveFileClient,
  updateOneDriveFileClient,
  deleteOneDriveFileClient,
  type OneDriveItem,
  type OneDriveSection,
  type OneDriveAccountInfo,
} from '@/lib/microsoft/microsoft-onedrive-client';
import { toast } from '@/stores/toast-store';

export interface OneDriveFolderBreadcrumb {
  id: string;
  name: string;
}

export function useMicrosoftOneDrive() {
  const [accounts, setAccounts] = useState<OneDriveAccountInfo[]>([]);
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string>('');
  const [files, setFiles] = useState<OneDriveItem[]>([]);
  const [section, setSection] = useState<OneDriveSection>('my-drive');
  const [breadcrumbs, setBreadcrumbs] = useState<OneDriveFolderBreadcrumb[]>([
    { id: 'root', name: 'OneDrive' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1]?.id || 'root';

  const fetchFiles = useCallback(
    async (opts?: {
      accountEmail?: string;
      folderId?: string;
      section?: OneDriveSection;
      q?: string;
    }) => {
      setIsLoading(true);
      try {
        const targetEmail = opts?.accountEmail ?? selectedAccountEmail;
        const targetSection = opts?.section ?? section;
        const targetFolderId = opts?.folderId ?? currentFolderId;
        const targetQ = opts?.q ?? searchQuery;

        const data = await listOneDriveFilesClient({
          accountEmail: targetEmail || undefined,
          folderId: targetSection === 'my-drive' ? targetFolderId : undefined,
          section: targetSection,
          q: targetQ || undefined,
        });

        setAccounts(data.accounts || []);
        if (!targetEmail && data.accounts && data.accounts.length > 0) {
          setSelectedAccountEmail(data.accounts[0].email);
        }
        setFiles(data.files || []);
      } catch {
        // Ignore if not connected
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAccountEmail, section, currentFolderId, searchQuery]
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const handleAccountsChanged = () => {
      fetchFiles();
    };
    window.addEventListener('microsoft-accounts-changed', handleAccountsChanged);
    window.addEventListener('google-accounts-changed', handleAccountsChanged);
    return () => {
      window.removeEventListener('microsoft-accounts-changed', handleAccountsChanged);
      window.removeEventListener('google-accounts-changed', handleAccountsChanged);
    };
  }, [fetchFiles]);

  const openFolder = useCallback((folder: OneDriveItem) => {
    setSection('my-drive');
    setBreadcrumbs((prev) => [...prev, { id: folder.rawId, name: folder.name }]);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }, []);

  const changeSection = useCallback((newSection: OneDriveSection) => {
    setSection(newSection);
    if (newSection === 'my-drive') {
      setBreadcrumbs([{ id: 'root', name: 'OneDrive' }]);
    }
  }, []);

  const createFolder = useCallback(
    async (name: string) => {
      if (!selectedAccountEmail) return;
      try {
        const created = await createOneDriveFolderClient({
          accountEmail: selectedAccountEmail,
          name,
          parentId: currentFolderId,
        });
        setFiles((prev) => [created, ...prev]);
        toast.success(`Created folder "${name}"`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create OneDrive folder');
      }
    },
    [selectedAccountEmail, currentFolderId]
  );

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!selectedAccountEmail) return;
      const arr = Array.from(fileList);
      for (const file of arr) {
        try {
          const uploaded = await uploadOneDriveFileClient({
            accountEmail: selectedAccountEmail,
            file,
            parentId: currentFolderId,
          });
          setFiles((prev) => [uploaded, ...prev]);
          toast.success(`Uploaded "${file.name}" to OneDrive`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
        }
      }
    },
    [selectedAccountEmail, currentFolderId]
  );

  const renameItem = useCallback(async (item: OneDriveItem, newName: string) => {
    try {
      const updated = await updateOneDriveFileClient(item.id, { name: newName });
      setFiles((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
      toast.success(`Renamed to "${newName}"`);
    } catch {
      toast.error('Failed to rename OneDrive item');
    }
  }, []);

  const deleteItem = useCallback(async (item: OneDriveItem) => {
    try {
      await deleteOneDriveFileClient(item.id);
      setFiles((prev) => prev.filter((f) => f.id !== item.id));
      toast.success(`Deleted "${item.name}"`);
    } catch {
      toast.error('Failed to delete OneDrive item');
    }
  }, []);

  return {
    accounts,
    selectedAccountEmail,
    setSelectedAccountEmail,
    files,
    section,
    changeSection,
    breadcrumbs,
    openFolder,
    navigateToBreadcrumb,
    searchQuery,
    setSearchQuery,
    isLoading,
    refresh: fetchFiles,
    createFolder,
    uploadFiles,
    renameItem,
    deleteItem,
  };
}
