"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Folder, FolderPlus, ChevronRight, Loader2, Home, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DriveFolder = {
    id: string;
    name: string;
    webViewLink?: string;
    createdTime?: string;
};

type BreadcrumbItem = {
    id: string;
    name: string;
};

type DriveBrowserStrings = {
    feedbackTitle?: string;
    createFolderFailed?: string;
    backLabel?: string;
    dialogTitle?: string;
    createFolderLabel?: string;
    newFolderLabel?: string;
    newFolderPlaceholder?: string;
    createAndSelectLabel?: string;
    emptyStateTitle?: string;
    emptyStateHint?: string;
    selectThisFolderTitle?: string;
    selectLabel?: string;
    footerHint?: string;
    closeLabel?: string;
    confirmLabel?: string;
};

interface DriveBrowserProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookingId: string;
    defaultFolderName: string;
    onFolderCreated: (url: string) => void;
    onFolderSelected: (url: string) => void;
    strings?: DriveBrowserStrings;
}

export function DriveBrowser({
    open,
    onOpenChange,
    bookingId,
    defaultFolderName,
    onFolderCreated,
    onFolderSelected,
    strings,
}: DriveBrowserProps) {
    const t = useTranslations("DriveBrowser");
    const uiStrings: Required<DriveBrowserStrings> = {
        feedbackTitle: t("feedbackTitle"),
        createFolderFailed: t("createFolderFailed"),
        backLabel: t("backLabel"),
        dialogTitle: t("dialogTitle"),
        createFolderLabel: t("createFolderLabel"),
        newFolderLabel: t("newFolderLabel"),
        newFolderPlaceholder: t("newFolderPlaceholder"),
        createAndSelectLabel: t("createAndSelectLabel"),
        emptyStateTitle: t("emptyStateTitle"),
        emptyStateHint: t("emptyStateHint"),
        selectThisFolderTitle: t("selectThisFolderTitle"),
        selectLabel: t("selectLabel"),
        footerHint: t("footerHint"),
        closeLabel: t("closeLabel"),
        confirmLabel: t("confirmLabel"),
        ...strings,
    };
    const [folders, setFolders] = React.useState<DriveFolder[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([
        { id: "root", name: "My Drive" },
    ]);
    const [creating, setCreating] = React.useState(false);
    const [showNewFolder, setShowNewFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState("");
    const [feedbackDialog, setFeedbackDialog] = React.useState<{
        open: boolean;
        title: string;
        message: string;
    }>({ open: false, title: "", message: "" });

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || uiStrings.feedbackTitle,
            message,
        });
    }, [uiStrings.feedbackTitle]);

    const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

    const loadFolder = React.useCallback(async (parentId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/google/drive/list?parentId=${parentId}`);
            const data = await res.json();
            if (data.success) {
                setFolders(data.folders);
            } else {
                console.error(data.error);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, []);

    React.useEffect(() => {
        if (open) {
            loadFolder(currentFolderId);
            setNewFolderName(defaultFolderName);
        }
    }, [open, currentFolderId, defaultFolderName, loadFolder]);

    function navigateToFolder(folder: DriveFolder) {
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        loadFolder(folder.id);
    }

    function navigateToBreadcrumb(index: number) {
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newBreadcrumbs);
        loadFolder(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }

    function handleBack() {
        if (breadcrumbs.length <= 1) return;
        navigateToBreadcrumb(breadcrumbs.length - 2);
    }

    async function handleCreateFolder() {
        if (!newFolderName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch("/api/google/drive/create-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingId,
                    folderName: newFolderName.trim(),
                    parentId: currentFolderId === "root" ? undefined : currentFolderId,
                }),
            });
            const data = await res.json();
            if (data.success && data.folderUrl) {
                onFolderCreated(data.folderUrl);
                onOpenChange(false);
                setShowNewFolder(false);
            } else {
                showFeedback(data.error || uiStrings.createFolderFailed);
            }
        } catch {
            showFeedback(uiStrings.createFolderFailed);
        }
        setCreating(false);
    }

    function handleSelectFolder(folder: DriveFolder) {
        if (folder.webViewLink) {
            onFolderSelected(folder.webViewLink);
            onOpenChange(false);
        }
    }

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-blue-500" /> {uiStrings.dialogTitle}
                    </DialogTitle>
                </DialogHeader>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1 border-b border-dashed">
                    {breadcrumbs.map((bc, i) => (
                        <React.Fragment key={bc.id}>
                            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                            <button
                                onClick={() => navigateToBreadcrumb(i)}
                                className={cn(
                                    "shrink-0 px-1.5 py-0.5 rounded text-xs font-medium transition-colors",
                                    i === breadcrumbs.length - 1
                                        ? "text-foreground bg-muted"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                {i === 0 ? <Home className="w-3.5 h-3.5 inline" /> : bc.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost" size="sm"
                        disabled={breadcrumbs.length <= 1}
                        onClick={handleBack}
                        className="h-7 px-2 gap-1 text-xs"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> {uiStrings.backLabel}
                    </Button>
                    <div className="flex-1" />
                    <Button
                        variant="outline" size="sm"
                        onClick={() => { setShowNewFolder(!showNewFolder); setNewFolderName(defaultFolderName); }}
                        className="h-7 px-3 gap-1.5 text-xs"
                    >
                        <FolderPlus className="w-3.5 h-3.5" /> {uiStrings.createFolderLabel}
                    </Button>
                </div>

                {/* New Folder Form */}
                {showNewFolder && (
                    <div className="flex gap-2 items-end p-3 rounded-lg border bg-muted/30">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                                {uiStrings.newFolderLabel}
                            </label>
                            <input
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder={uiStrings.newFolderPlaceholder}
                                autoFocus
                                className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); }}
                            />
                        </div>
                        <Button
                            size="sm" className="h-8 gap-1.5"
                            onClick={handleCreateFolder}
                            disabled={creating || !newFolderName.trim()}
                        >
                            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
                            {uiStrings.createAndSelectLabel}
                        </Button>
                    </div>
                )}

                {/* Folder List */}
                <div className="flex-1 min-h-0 overflow-y-auto -mx-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : folders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            <Folder className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p>{uiStrings.emptyStateTitle}</p>
                            <p className="text-xs mt-1">{uiStrings.emptyStateHint}</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5 px-1">
                            {folders.map(folder => (
                                <div
                                    key={folder.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group cursor-pointer"
                                    onDoubleClick={() => navigateToFolder(folder)}
                                >
                                    <Folder className="w-5 h-5 text-blue-500 shrink-0" />
                                    <span
                                        className="flex-1 text-sm font-medium truncate cursor-pointer hover:underline"
                                        onClick={() => navigateToFolder(folder)}
                                    >
                                        {folder.name}
                                    </span>
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-7 px-2 gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10"
                                        onClick={e => { e.stopPropagation(); handleSelectFolder(folder); }}
                                        title={uiStrings.selectThisFolderTitle}
                                    >
                                        <Check className="w-3.5 h-3.5" /> {uiStrings.selectLabel}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-3">
                    <p className="text-xs text-muted-foreground flex-1">
                        {uiStrings.footerHint}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        {uiStrings.closeLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <ActionFeedbackDialog
            open={feedbackDialog.open}
            onOpenChange={(open) => setFeedbackDialog((prev) => ({ ...prev, open }))}
            title={feedbackDialog.title}
            message={feedbackDialog.message}
            confirmLabel={uiStrings.confirmLabel}
        />
        </>
    );
}
