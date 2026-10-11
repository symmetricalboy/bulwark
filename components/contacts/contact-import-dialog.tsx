"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Upload, FileText, AlertTriangle, X, Check, RefreshCw, GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseVCard, detectDuplicates } from "@/lib/vcard";
import type { ContactCard } from "@/lib/jmap/types";
import { getContactDisplayName, getContactPrimaryEmail, getContactPhotoUri } from "@/stores/contact-store";
import {
  getGoogleStatus,
  fetchGoogleContacts,
  type GoogleAccountStatus,
} from "@/lib/google/google-contacts-client";

interface ContactImportDialogProps {
  existingContacts: ContactCard[];
  onImport: (contacts: ContactCard[]) => Promise<number>;
  onClose: () => void;
  initialSource?: "file" | "google";
}

export function ContactImportDialog({
  existingContacts,
  onImport,
  onClose,
  initialSource = "google",
}: ContactImportDialogProps) {
  const t = useTranslations("contacts");
  const fileRef = useRef<HTMLInputElement>(null);

  const [sourceTab, setSourceTab] = useState<"google" | "file">(initialSource);
  const [googleStatus, setGoogleStatus] = useState<GoogleAccountStatus | null>(null);
  const [isCheckingGoogle, setIsCheckingGoogle] = useState(true);
  const [isFetchingGoogle, setIsFetchingGoogle] = useState(false);

  const [parsed, setParsed] = useState<ContactCard[]>([]);
  const [importSource, setImportSource] = useState<"google" | "file" | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [duplicates, setDuplicates] = useState<Map<number, string>>(new Map());
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check Google status on mount
  useEffect(() => {
    let mounted = true;
    getGoogleStatus()
      .then((status) => {
        if (!mounted) return;
        setGoogleStatus(status);
        setIsCheckingGoogle(false);

        // If Google is already connected and initialSource is google, auto-fetch
        if (status.connected && initialSource === "google") {
          void loadFromGoogle();
        } else if (!status.connected && initialSource === "file") {
          setSourceTab("file");
        }
      })
      .catch(() => {
        if (!mounted) return;
        setIsCheckingGoogle(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loadFromGoogle = useCallback(async () => {
    setIsFetchingGoogle(true);
    setError(null);
    try {
      const data = await fetchGoogleContacts();
      const contacts = data.contacts || [];

      if (contacts.length === 0) {
        setError(t("import.google_empty"));
        setIsFetchingGoogle(false);
        return;
      }

      const dupes = detectDuplicates(existingContacts, contacts);
      setParsed(contacts);
      setDuplicates(dupes);
      setImportSource("google");

      const initialSelected = new Set<number>();
      contacts.forEach((_, idx) => {
        if (!dupes.has(idx)) initialSelected.add(idx);
      });
      setSelected(initialSelected);
    } catch (err) {
      console.error("Failed to load Google contacts:", err);
      setError(t("import.google_error"));
    } finally {
      setIsFetchingGoogle(false);
    }
  }, [existingContacts, t]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setResult(null);

      if (file.size > 5 * 1024 * 1024) {
        setError(t("import.file_too_large"));
        return;
      }

      try {
        const text = await file.text();
        const contacts = parseVCard(text);

        if (contacts.length === 0) {
          setError(t("import.no_contacts"));
          return;
        }

        const dupes = detectDuplicates(existingContacts, contacts);
        setParsed(contacts);
        setDuplicates(dupes);
        setImportSource("file");

        const initialSelected = new Set<number>();
        contacts.forEach((_, idx) => {
          if (!dupes.has(idx)) initialSelected.add(idx);
        });
        setSelected(initialSelected);
      } catch (err) {
        console.error("Failed to parse vCard:", err);
        setError(t("import.parse_error"));
      }
    },
    [existingContacts, t],
  );

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(new Set(parsed.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const resetSelection = () => {
    setParsed([]);
    setSelected(new Set());
    setDuplicates(new Map());
    setError(null);
    setImportSource(null);
  };

  const handleImport = async () => {
    const toImport = parsed.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;

    setIsImporting(true);
    try {
      const count = await onImport(toImport);
      setResult(count);
    } catch (err) {
      console.error("Failed to import contacts:", err);
      setError(t("import.failed"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = "/api/auth/google/start?returnTo=/contacts?import=google";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Dialog Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t("import.title")}</h2>
          {importSource === "google" && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-medium">
              <GoogleIcon className="w-3 h-3" />
              Google
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {result !== null ? (
          /* Success Screen */
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">{t("import.success", { count: result })}</p>
            <Button variant="outline" size="sm" onClick={onClose} className="mt-4">
              {t("import.close")}
            </Button>
          </div>
        ) : parsed.length === 0 ? (
          /* Source Selection & Extraction */
          <div className="space-y-4">
            {/* Source Segmented Control */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-lg text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setSourceTab("google");
                  setError(null);
                  if (googleStatus?.connected && !isFetchingGoogle) {
                    void loadFromGoogle();
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all text-xs sm:text-sm",
                  sourceTab === "google"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <GoogleIcon className="w-4 h-4 shrink-0" />
                <span>{t("import.source_google")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceTab("file");
                  setError(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all text-xs sm:text-sm",
                  sourceTab === "file"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>{t("import.source_file")}</span>
              </button>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 px-3 py-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {sourceTab === "google" ? (
              /* Google Contacts Tab Content */
              <div className="border border-border/80 rounded-xl p-6 flex flex-col items-center text-center space-y-4 bg-muted/20">
                {isCheckingGoogle ? (
                  <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm">{t("import.google_fetching")}</p>
                  </div>
                ) : !googleStatus?.connected ? (
                  <div className="py-6 flex flex-col items-center space-y-4 max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-border flex items-center justify-center">
                      <GoogleIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">
                        {t("import.import_google")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("import.google_subtitle")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleConnectGoogle}
                      className="w-full flex items-center justify-center gap-2 border-border/70 bg-background !text-[#1f1f1f] dark:!text-[#e3e3e3] hover:bg-accent font-medium shadow-sm h-10 mt-2"
                    >
                      <GoogleIcon className="w-4 h-4" />
                      <span>{t("import.google_signin")}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center space-y-4 w-full max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-border flex items-center justify-center">
                      <GoogleIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">
                        {t("import.import_google")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("import.google_connected_as", { email: googleStatus.email || "Google" })}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={() => void loadFromGoogle()}
                      disabled={isFetchingGoogle}
                      className="w-full flex items-center justify-center gap-2 h-10 shadow-sm font-medium"
                    >
                      <RefreshCw className={cn("w-4 h-4", isFetchingGoogle && "animate-spin")} />
                      <span>
                        {isFetchingGoogle
                          ? t("import.google_fetching")
                          : t("import.google_fetch_button")}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* vCard File Tab Content */
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".vcf,.vcard"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "w-full border-2 border-dashed rounded-xl py-12 px-4",
                    "flex flex-col items-center gap-3 transition-colors",
                    "hover:border-primary hover:bg-primary/5",
                    "text-muted-foreground",
                  )}
                >
                  <Upload className="w-8 h-8" />
                  <p className="text-sm font-medium">{t("import.drop_hint")}</p>
                  <p className="text-xs">{t("import.file_types")}</p>
                </button>
              </>
            )}
          </div>
        ) : (
          /* Contact Preview and Duplicate Selection List */
          <div className="space-y-3">
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 px-3 py-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("import.found", { count: parsed.length })}
                </p>
                {duplicates.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {duplicates.size} duplicate(s) detected and unselected by default
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={resetSelection} className="text-xs h-7">
                  Change source
                </Button>
                <div className="h-4 w-px bg-border" />
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                  {t("import.select_all")}
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">
                  {t("import.deselect_all")}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg divide-y divide-border max-h-96 overflow-y-auto">
              {parsed.map((contact, idx) => {
                const cName = getContactDisplayName(contact);
                const cEmail = getContactPrimaryEmail(contact);
                const cPhone = Object.values(contact.phones || {})[0]?.number;
                const photoUri = getContactPhotoUri(contact);
                const isDupe = duplicates.has(idx);
                const isSelected = selected.has(idx);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleSelect(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-muted",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>

                    {photoUri ? (
                      <img
                        src={photoUri}
                        alt={cName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-border/50"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground text-xs font-semibold">
                        {(cName || cEmail || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cName || cEmail || "-"}</div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                        {cEmail && <span>{cEmail}</span>}
                        {cEmail && cPhone && <span>•</span>}
                        {cPhone && <span>{cPhone}</span>}
                      </div>
                    </div>

                    {isDupe && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex-shrink-0 font-medium border border-amber-300 dark:border-amber-800/60">
                        {t("import.duplicate")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialog Footer Actions */}
      {parsed.length > 0 && result === null && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {t("import.selected", { count: selected.size })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              {t("form.cancel")}
            </Button>
            <Button onClick={handleImport} disabled={isImporting || selected.size === 0}>
              {isImporting ? t("import.importing") : `${t("import.import_button")} (${selected.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
