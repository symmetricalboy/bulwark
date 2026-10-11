"use client";

import { useState, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Folder,
  FolderPlus,
  ChevronRight,
  Search,
  Upload,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  Info,
  Star,
  Download,
  Trash2,
  ExternalLink,
  Pencil,
  X,
  Check,
  Eye,
  Loader2,
  HardDrive,
  Users,
  Home,
  GoogleDriveIcon,
  GoogleIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { cn, formatFileSize } from '@/lib/utils';
import { getFileIconByName, isImageFile, isPdfFile, isTextFile } from '@/components/files/file-icons';
import { useGoogleDrive } from '@/hooks/use-google-drive';
import type { GoogleDriveFile } from '@/lib/google/types';
import { getGoogleDriveDownloadUrl, downloadGoogleDriveFileBlob } from '@/lib/google/google-drive-client';
import { ImagePreviewModal } from '@/components/files/image-preview-modal';
import { FilePreviewModal } from '@/components/files/file-preview-modal';

interface GoogleDriveBrowserProps {
  onBackToBulwarkFiles?: () => void;
}

export function GoogleDriveBrowser({ onBackToBulwarkFiles }: GoogleDriveBrowserProps) {
  const t = useTranslations('files');
  const drive = useGoogleDrive();
  const { dialogProps: confirmDialogProps, confirm: confirmDialog } = useConfirmDialog();

  const [showDetails, setShowDetails] = useState(false);
  const [activeDetailFile, setActiveDetailFile] = useState<GoogleDriveFile | null>(null);

  // New folder dialog
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<GoogleDriveFile | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Previews
  const [previewImage, setPreviewImage] = useState<{ name: string; url: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; id: string; mimeType: string } | null>(null);

  // Upload input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isFolder = (file: GoogleDriveFile) => file.mimeType === 'application/vnd.google-apps.folder';

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await drive.createFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleStartRename = (file: GoogleDriveFile) => {
    setRenameTarget(file);
    setRenameValue(file.name);
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    await drive.renameFile(renameTarget.id, renameValue.trim());
    setRenameTarget(null);
  };

  const handleDelete = async (file: GoogleDriveFile) => {
    const confirmed = await confirmDialog({
      title: t('delete_confirm_title'),
      message: t('delete_confirm_message', { name: file.name }),
      confirmText: t('delete'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    await drive.deleteFile(file.id);
    if (activeDetailFile?.id === file.id) {
      setActiveDetailFile(null);
    }
  };

  const handleBatchDelete = async () => {
    const count = drive.selectedFileIds.size;
    if (count === 0) return;
    const confirmed = await confirmDialog({
      title: t('delete_confirm_title'),
      message: t('batch_delete_confirm_message', { count }),
      confirmText: t('delete'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    for (const id of Array.from(drive.selectedFileIds)) {
      await drive.deleteFile(id);
    }
    drive.clearSelection();
  };

  const getExpectedFilename = (file: { name: string; mimeType?: string }) => {
    if (file.mimeType === 'application/vnd.google-apps.document' && !file.name.toLowerCase().endsWith('.pdf')) {
      return `${file.name}.pdf`;
    }
    if (file.mimeType === 'application/vnd.google-apps.spreadsheet' && !file.name.toLowerCase().endsWith('.xlsx')) {
      return `${file.name}.xlsx`;
    }
    if (file.mimeType === 'application/vnd.google-apps.presentation' && !file.name.toLowerCase().endsWith('.pdf')) {
      return `${file.name}.pdf`;
    }
    if (file.mimeType === 'application/vnd.google-apps.drawing' && !file.name.toLowerCase().endsWith('.png')) {
      return `${file.name}.png`;
    }
    return file.name;
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

  const handleDownload = async (file: GoogleDriveFile) => {
    const url = getGoogleDriveDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExpectedFilename(file);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBatchDownload = async () => {
    for (const id of Array.from(drive.selectedFileIds)) {
      const file = drive.files.find((f) => f.id === id);
      if (file && !isFolder(file)) {
        await handleDownload(file);
      }
    }
  };

  const handlePreview = (file: GoogleDriveFile) => {
    // If it's a Google Doc, Sheet, or Slide, open its webViewLink directly
    if (
      file.mimeType.startsWith('application/vnd.google-apps.') &&
      file.mimeType !== 'application/vnd.google-apps.folder' &&
      file.webViewLink
    ) {
      window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isImageFile(file.name) || file.mimeType.startsWith('image/')) {
      const url = getGoogleDriveDownloadUrl(file.id, undefined, true);
      setPreviewImage({ name: file.name, url });
      return;
    }

    if (isPdfFile(file.name) || isTextFile(file.name) || file.mimeType === 'application/pdf') {
      setPreviewFile({ name: file.name, id: file.id, mimeType: file.mimeType });
      return;
    }

    // Fallback: open in Google Drive web view
    if (file.webViewLink) {
      window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
    } else {
      handleDownload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void drive.uploadFiles(Array.from(files));
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void drive.uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const sortedFiles = useMemo(() => {
    return [...drive.files].sort((a, b) => {
      const aIsFolder = isFolder(a);
      const bIsFolder = isFolder(b);
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [drive.files]);

  // If not connected, display the Connect Google Account banner/card
  if (!drive.status.connected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="max-w-md w-full bg-card border border-border p-8 rounded-2xl shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5 ring-1 ring-amber-500/20">
            <GoogleDriveIcon className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t('google_drive')}</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {t('connect_google_drive_desc')}
          </p>
          <div className="flex items-center gap-3 w-full justify-center">
            {onBackToBulwarkFiles && (
              <Button variant="outline" onClick={onBackToBulwarkFiles}>
                {t('bulwark_files')}
              </Button>
            )}
            <Button onClick={drive.connectGoogle} className="gap-2 shadow-sm">
              <GoogleIcon className="w-4 h-4" />
              <span>{t('connect_button')}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 bg-background relative',
        isDraggingOver && 'ring-2 ring-primary ring-inset bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/60 backdrop-blur-sm gap-3">
        {/* Left: Account indicator & Section pills */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center border border-border shadow-xs">
              <GoogleDriveIcon className="w-4 h-4" />
            </div>
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate leading-tight">
                {t('google_drive')}
              </span>
              <span className="text-[11px] text-muted-foreground truncate leading-tight">
                {drive.status.email}
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Section pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => drive.setSection('root')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                drive.currentSection === 'root'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t('my_drive')}</span>
            </button>
            <button
              type="button"
              onClick={() => drive.setSection('sharedWithMe')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                drive.currentSection === 'sharedWithMe'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t('shared_with_me')}</span>
            </button>
            <button
              type="button"
              onClick={() => drive.setSection('starred')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                drive.currentSection === 'starred'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{t('starred')}</span>
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolder(true)}
            className="h-8 gap-1.5 hidden md:inline-flex text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t('new_folder')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 gap-1.5 hidden md:inline-flex text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('upload')}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={drive.refresh}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={t('refresh')}
          >
            <RefreshCw className={cn('w-4 h-4', drive.isRefreshing && 'animate-spin text-primary')} />
          </Button>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => drive.setViewMode(drive.viewMode === 'grid' ? 'list' : 'grid')}
            className={cn('h-8 w-8 text-muted-foreground hover:text-foreground')}
            title={drive.viewMode === 'grid' ? t('list_view') : t('grid_view')}
          >
            {drive.viewMode === 'grid' ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDetails((v) => !v)}
            className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', showDetails && 'bg-muted text-foreground')}
            title={t('details')}
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Breadcrumb & Search Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/15 text-xs text-muted-foreground gap-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 py-0.5">
          {drive.folderTrail.map((crumb, idx) => (
            <div key={crumb.id} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 rtl:rotate-180" />}
              <button
                type="button"
                onClick={() => drive.navigateToCrumb(idx)}
                className={cn(
                  'px-1.5 py-0.5 rounded hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1',
                  idx === drive.folderTrail.length - 1 ? 'font-semibold text-foreground' : ''
                )}
              >
                {idx === 0 && <Home className="w-3.5 h-3.5" />}
                <span>{crumb.name}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative shrink-0 w-48 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={drive.searchQuery}
            onChange={(e) => drive.handleSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="h-7 pl-8 pr-7 text-xs bg-background/80"
          />
          {drive.searchQuery && (
            <button
              type="button"
              onClick={() => drive.handleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Multi-selection action bar */}
      {drive.selectedFileIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span>{drive.selectedFileIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={drive.clearSelection} className="h-6 text-xs px-2">
              {t('clear_selection')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchDownload}
              className="h-7 text-xs gap-1.5 bg-background"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('download')}</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              className="h-7 text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('delete')}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Files Area with Details Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Files Content */}
        <div className="flex-1 overflow-y-auto p-4 min-w-0">
          {drive.isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          ) : drive.error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
                <Info className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Failed to load Google Drive</h3>
              <p className="text-xs text-muted-foreground mb-4">{drive.error}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={drive.refresh} className="gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </Button>
                <Button size="sm" onClick={drive.connectGoogle} className="gap-1.5 text-xs">
                  <GoogleIcon className="w-3.5 h-3.5" />
                  <span>Reconnect</span>
                </Button>
              </div>
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                <Folder className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{t('empty_folder')}</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {drive.searchQuery
                  ? t('no_search_results')
                  : 'Drop files here or click "Upload" above to add files to this Google Drive folder.'}
              </p>
            </div>
          ) : drive.viewMode === 'grid' ? (
            /* ===== GRID VIEW ===== */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedFiles.map((file) => {
                const folder = isFolder(file);
                const isSelected = drive.selectedFileIds.has(file.id);

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      if (folder) {
                        drive.navigateToFolder(file.id, file.name);
                      } else {
                        drive.toggleSelect(file.id);
                        setActiveDetailFile(file);
                      }
                    }}
                    onDoubleClick={() => handlePreview(file)}
                    className={cn(
                      'group relative flex flex-col p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-all cursor-pointer select-none text-start shadow-xs',
                      isSelected && 'ring-2 ring-primary border-primary/50 bg-primary/5',
                      folder && 'hover:border-amber-500/50'
                    )}
                  >
                    {/* Star toggle button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void drive.starFile(file.id, !file.starred);
                      }}
                      className={cn(
                        'absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground/40 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100 z-10',
                        file.starred && 'opacity-100 text-amber-500 fill-amber-500'
                      )}
                      title={file.starred ? t('unstar') : t('star')}
                    >
                      <Star className={cn('w-3.5 h-3.5', file.starred && 'fill-amber-500 text-amber-500')} />
                    </button>

                    {/* Thumbnail or Big Icon */}
                    <div className="h-24 w-full rounded-lg bg-muted/40 flex items-center justify-center mb-2.5 overflow-hidden">
                      {folder ? (
                        <Folder className="w-12 h-12 text-amber-500 fill-amber-500/10" />
                      ) : file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="h-full w-full object-cover rounded-lg"
                          loading="lazy"
                        />
                      ) : (
                        getFileIconByName(file.name, 'lg')
                      )}
                    </div>

                    {/* File Title and Meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                        <span>{file.size ? formatFileSize(parseInt(file.size, 10)) : folder ? 'Folder' : ''}</span>
                        {file.modifiedTime && (
                          <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Quick Action buttons on hover */}
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(file);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        title={t('preview')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!folder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownload(file);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title={t('download')}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title={t('open_in_google_drive')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(file);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        title={t('rename')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(file);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                        title={t('delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ===== LIST / TABLE VIEW ===== */
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                    <th className="py-2.5 px-4 w-8">
                      <div
                        onClick={() => {
                          if (drive.selectedFileIds.size === drive.files.length) {
                            drive.clearSelection();
                          } else {
                            drive.selectAll();
                          }
                        }}
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center cursor-pointer',
                          drive.selectedFileIds.size > 0 && drive.selectedFileIds.size === drive.files.length
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40 bg-background'
                        )}
                      >
                        {drive.selectedFileIds.size > 0 && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-foreground">{t('name')}</th>
                    <th className="py-2.5 px-4 hidden md:table-cell">{t('modified')}</th>
                    <th className="py-2.5 px-4 hidden sm:table-cell">{t('size')}</th>
                    <th className="py-2.5 px-4 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedFiles.map((file) => {
                    const folder = isFolder(file);
                    const isSelected = drive.selectedFileIds.has(file.id);

                    return (
                      <tr
                        key={file.id}
                        onClick={() => {
                          if (folder) {
                            drive.navigateToFolder(file.id, file.name);
                          } else {
                            drive.toggleSelect(file.id);
                            setActiveDetailFile(file);
                          }
                        }}
                        onDoubleClick={() => handlePreview(file)}
                        className={cn(
                          'hover:bg-muted/40 cursor-pointer transition-colors select-none',
                          isSelected && 'bg-primary/10'
                        )}
                      >
                        <td className="py-2 px-4" onClick={(e) => e.stopPropagation()}>
                          <div
                            onClick={() => drive.toggleSelect(file.id)}
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center cursor-pointer',
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/40 bg-background'
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {folder ? (
                              <Folder className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500/20" />
                            ) : (
                              <span className="shrink-0">{getFileIconByName(file.name, 'sm')}</span>
                            )}
                            <span className="font-medium text-foreground truncate">{file.name}</span>
                            {file.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-muted-foreground hidden md:table-cell">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-4 text-muted-foreground hidden sm:table-cell">
                          {file.size ? formatFileSize(parseInt(file.size, 10)) : folder ? '—' : ''}
                        </td>
                        <td className="py-2 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handlePreview(file)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title={t('preview')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!folder && (
                              <button
                                type="button"
                                onClick={() => void handleDownload(file)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                title={t('download')}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                title={t('open_in_google_drive')}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartRename(file)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title={t('rename')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(file)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                              title={t('delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Details Inspector Sidebar (Toggleable) */}
        {showDetails && (
          <div className="w-72 border-s border-border bg-card p-4 overflow-y-auto shrink-0 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('details')}</h4>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeDetailFile ? (
              <div className="flex flex-col gap-4 text-xs">
                {/* Preview / Icon */}
                <div className="h-32 w-full rounded-xl bg-muted/40 border border-border flex items-center justify-center overflow-hidden">
                  {isFolder(activeDetailFile) ? (
                    <Folder className="w-16 h-16 text-amber-500 fill-amber-500/20" />
                  ) : activeDetailFile.thumbnailLink ? (
                    <img
                      src={activeDetailFile.thumbnailLink}
                      alt={activeDetailFile.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getFileIconByName(activeDetailFile.name, 'lg')
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-foreground text-sm break-all">{activeDetailFile.name}</h3>
                  <p className="text-muted-foreground mt-0.5">{activeDetailFile.mimeType}</p>
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('size')}</span>
                    <span className="font-medium text-foreground">
                      {activeDetailFile.size
                        ? formatFileSize(parseInt(activeDetailFile.size, 10))
                        : getReadableType(activeDetailFile.mimeType) || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('modified')}</span>
                    <span className="font-medium text-foreground">
                      {activeDetailFile.modifiedTime
                        ? new Date(activeDetailFile.modifiedTime).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                  {activeDetailFile.createdTime && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium text-foreground">
                        {new Date(activeDetailFile.createdTime).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {activeDetailFile.owners?.[0] && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground">Owner</span>
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={activeDetailFile.owners[0].displayName || activeDetailFile.owners[0].emailAddress}
                          size="sm"
                        />
                        <span className="font-medium text-foreground">
                          {activeDetailFile.owners[0].displayName || activeDetailFile.owners[0].emailAddress}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions in details */}
                <div className="space-y-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-2"
                    onClick={() => handlePreview(activeDetailFile)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('preview')}</span>
                  </Button>
                  {!isFolder(activeDetailFile) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center gap-2"
                      onClick={() => handleDownload(activeDetailFile)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t('download')}</span>
                    </Button>
                  )}
                  {activeDetailFile.webViewLink && (
                    <a
                      href={activeDetailFile.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button variant="outline" size="sm" className="w-full justify-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{t('open_in_google_drive')}</span>
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Info className="w-8 h-8 opacity-40 mb-2" />
                <p>Select a file to inspect details</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="bg-card border border-border rounded-xl p-5 shadow-xl w-full max-w-sm"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">{t('new_folder')}</h3>
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="mb-4 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewFolder(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={!newFolderName.trim()}>
                {t('create')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleConfirmRename}
            className="bg-card border border-border rounded-xl p-5 shadow-xl w-full max-w-sm"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">{t('rename')}</h3>
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mb-4 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={!renameValue.trim()}>
                {t('save')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          name={previewImage.name}
          onClose={() => setPreviewImage(null)}
          onDownload={async () => {
            const a = document.createElement('a');
            a.href = previewImage.url;
            a.download = previewImage.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          getImageUrl={async () => previewImage.url}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          name={previewFile.name}
          onClose={() => setPreviewFile(null)}
          onDownload={() => {
            const url = getGoogleDriveDownloadUrl(previewFile.id);
            const a = document.createElement('a');
            a.href = url;
            a.download = getExpectedFilename(previewFile);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          getFileContent={async () => {
            const res = await downloadGoogleDriveFileBlob(previewFile.id);
            return { blob: res.blob, contentType: res.mimeType };
          }}
        />
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
