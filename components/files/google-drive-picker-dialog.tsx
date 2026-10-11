"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Folder,
  ChevronRight,
  Search,
  Check,
  X,
  Loader2,
  GoogleDriveIcon,
  HardDrive,
  Users,
  Star,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn, formatFileSize } from '@/lib/utils';
import { getFileIconByName } from '@/components/files/file-icons';
import type { GoogleDriveFile } from '@/lib/google/types';
import { fetchGoogleDriveFiles, getGoogleStatus, type GoogleAccountStatus } from '@/lib/google/google-drive-client';

interface GoogleDrivePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (files: GoogleDriveFile[]) => void;
}

export function GoogleDrivePickerDialog({ isOpen, onClose, onPick }: GoogleDrivePickerDialogProps) {
  const t = useTranslations('files');

  const [status, setStatus] = useState<GoogleAccountStatus | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentSection, setCurrentSection] = useState<'root' | 'sharedWithMe' | 'starred'>('root');
  const [folderTrail, setFolderTrail] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, GoogleDriveFile>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const modalRef = useFocusTrap({ isActive: isOpen, onEscape: onClose, restoreFocus: true });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check Google Auth Status on open
  useEffect(() => {
    if (!isOpen) return;
    setCheckingAuth(true);
    setError(null);
    getGoogleStatus().then((s) => {
      setStatus(s);
      setCheckingAuth(false);
      if (s.connected) {
        loadDirectory('root');
      }
    });
  }, [isOpen]);

  const currentFolderId = folderTrail[folderTrail.length - 1]?.id || 'root';

  const loadDirectory = async (folderId: string, search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchGoogleDriveFiles(folderId, search);
      setFiles(res.files || []);
    } catch (err: unknown) {
      console.error('Failed to load Google Drive files for picker:', err);
      const errStatus = (err as { status?: number })?.status;
      if (errStatus === 401) {
        setStatus((prev) => (prev ? { ...prev, connected: false } : { configured: true, connected: false }));
      } else {
        setError((err as Error)?.message || 'Failed to load Google Drive files');
      }
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFolder = (folderId: string, folderName: string) => {
    setSearchQuery('');
    setFolderTrail((prev) => [...prev, { id: folderId, name: folderName }]);
    loadDirectory(folderId);
  };

  const handleNavigateCrumb = (index: number) => {
    setSearchQuery('');
    const target = folderTrail[index];
    if (!target) return;
    setFolderTrail((prev) => prev.slice(0, index + 1));
    loadDirectory(target.id);
  };

  const handleSectionChange = (section: 'root' | 'sharedWithMe' | 'starred') => {
    setCurrentSection(section);
    setSearchQuery('');
    if (section === 'root') {
      setFolderTrail([{ id: 'root', name: 'My Drive' }]);
    } else if (section === 'sharedWithMe') {
      setFolderTrail([{ id: 'sharedWithMe', name: 'Shared with me' }]);
    } else if (section === 'starred') {
      setFolderTrail([{ id: 'starred', name: 'Starred' }]);
    }
    loadDirectory(section);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadDirectory(currentFolderId);
    } else {
      loadDirectory(currentFolderId, searchQuery.trim());
    }
  };

  const getReadableType = (mimeType: string) => {
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return 'Google Doc';
      case 'application/vnd.google-apps.spreadsheet':
        return 'Google Sheet';
      case 'application/vnd.google-apps.presentation':
        return 'Google Slides';
      case 'application/vnd.google-apps.drawing':
        return 'Google Drawing';
      case 'application/vnd.google-apps.form':
        return 'Google Form';
      default:
        return null;
    }
  };

  const isFolder = (file: GoogleDriveFile) => file.mimeType === 'application/vnd.google-apps.folder';

  const toggleSelect = (file: GoogleDriveFile) => {
    if (isFolder(file)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.set(file.id, file);
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = Array.from(selected.values());
    if (chosen.length > 0) {
      onPick(chosen);
    }
  };

  const totalSelectedSize = useMemo(() => {
    let sum = 0;
    for (const f of selected.values()) {
      if (f.size) sum += parseInt(f.size, 10) || 0;
    }
    return sum;
  }, [selected]);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aIsFolder = isFolder(a);
      const bIsFolder = isFolder(b);
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gdrive-picker-title"
        className="flex flex-col bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl h-[560px] max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <GoogleDriveIcon className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <h2 id="gdrive-picker-title" className="text-base font-semibold text-foreground truncate">
                {t('attach_from_google_drive')}
              </h2>
              {status?.email && (
                <p className="text-xs text-muted-foreground truncate">{status.email}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Auth check or not connected state */}
        {checkingAuth ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        ) : !status?.connected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <GoogleDriveIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold mb-2">{t('connect_google_drive')}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('connect_google_drive_desc')}
            </p>
            <Button
              onClick={() => {
                const returnTo = typeof window !== 'undefined'
                  ? `${window.location.pathname}${window.location.search}`
                  : '/mail';
                window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
              }}
              className="gap-2"
            >
              <GoogleDriveIcon className="w-4 h-4" />
              {t('connect_button')}
            </Button>
          </div>
        ) : (
          <>
            {/* Search and Navigation Bar */}
            <div className="px-5 py-2.5 border-b border-border flex items-center gap-2 bg-background/50">
              {/* Quick sections */}
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => handleSectionChange('root')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                    currentSection === 'root'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>{t('my_drive')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSectionChange('sharedWithMe')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                    currentSection === 'sharedWithMe'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('shared_with_me')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSectionChange('starred')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                    currentSection === 'starred'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>{t('starred')}</span>
                </button>
              </div>

              {/* Search Box */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search_placeholder')}
                  className="h-8 pl-8 pr-7 text-xs bg-muted/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      loadDirectory(currentFolderId);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </div>

            {/* Breadcrumb Trail */}
            {currentSection === 'root' && (
              <div className="px-5 py-2 border-b border-border/50 text-xs text-muted-foreground flex items-center gap-1 overflow-x-auto bg-muted/10">
                {folderTrail.map((crumb, idx) => (
                  <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/60 rtl:rotate-180" />}
                    <button
                      type="button"
                      onClick={() => handleNavigateCrumb(idx)}
                      className={cn(
                        'hover:text-foreground transition-colors px-1 py-0.5 rounded',
                        idx === folderTrail.length - 1 ? 'font-medium text-foreground' : ''
                      )}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Files List */}
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/40">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">{t('loading')}</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-6 max-w-sm mx-auto">
                  <p className="text-sm font-semibold text-foreground mb-1">Failed to load files</p>
                  <p className="text-xs text-muted-foreground mb-3">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDirectory(currentFolderId, searchQuery)}
                    className="h-7 text-xs"
                  >
                    Retry
                  </Button>
                </div>
              ) : sortedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-6">
                  <Folder className="w-10 h-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-foreground">{t('empty_folder')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchQuery ? t('no_search_results') : t('no_files')}
                  </p>
                </div>
              ) : (
                sortedFiles.map((file) => {
                  const folder = isFolder(file);
                  const isSelected = selected.has(file.id);

                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        if (folder) {
                          handleOpenFolder(file.id, file.name);
                        } else {
                          toggleSelect(file);
                        }
                      }}
                      className={cn(
                        'flex items-center gap-3 px-5 py-2.5 text-sm cursor-pointer transition-colors select-none hover:bg-muted/50',
                        isSelected && 'bg-primary/10 hover:bg-primary/15'
                      )}
                    >
                      {/* Checkbox or Folder chevron */}
                      {!folder ? (
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 bg-background'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </div>
                      ) : (
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      )}

                      {/* File Icon */}
                      <div className="shrink-0 flex items-center justify-center">
                        {folder ? null : (
                          getFileIconByName(file.name, 'sm')
                        )}
                      </div>

                      {/* Filename and details */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground text-xs leading-normal">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {file.size ? (
                            <span>{formatFileSize(parseInt(file.size, 10))}</span>
                          ) : getReadableType(file.mimeType) ? (
                            <span>{getReadableType(file.mimeType)}</span>
                          ) : null}
                          {file.modifiedTime && (
                            <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                          )}
                          {file.owners?.[0]?.displayName && (
                            <span className="truncate">by {file.owners[0].displayName}</span>
                          )}
                        </div>
                      </div>

                      {/* Right Chevron for folders */}
                      {folder && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 rtl:rotate-180" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
              <div className="text-xs text-muted-foreground">
                {selected.size > 0 ? (
                  <span>
                    {selected.size} selected {totalSelectedSize > 0 && `(${formatFileSize(totalSelectedSize)})`}
                  </span>
                ) : (
                  <span>Select files to attach</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className="gap-1.5"
                >
                  <GoogleDriveIcon className="w-3.5 h-3.5" />
                  <span>Attach {selected.size > 0 ? `(${selected.size})` : ''}</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
