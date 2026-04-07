import * as React from "react";
import {
    Archive,
    ArchiveRestore,
    CheckCheck,
    FolderOpen,
    Settings2,
    Trash2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ArchiveMode = "active" | "archived";

type CommonLabels = {
    manage: string;
    selectAll: string;
    deleteSelected: string;
    selectedCount: string;
    closeManage: string;
};

type ArchiveLabels = CommonLabels & {
    active: string;
    archived: string;
    archiveSelected: string;
    restoreSelected: string;
};

type SimpleManageActionToolbarProps = {
    variant: "simple-manage";
    isManageMode: boolean;
    labels: CommonLabels;
    selectedCount: number;
    onEnterManage: () => void;
    onToggleSelectAll: () => void;
    onDelete: () => void;
    onCloseManage: () => void;
    className?: string;
    actionsClassName?: string;
    manageButtonClassName?: string;
    manageDisabled?: boolean;
    manageDisabledReason?: string;
    selectAllDisabled?: boolean;
    deleteDisabled?: boolean;
};

type ArchiveManageActionToolbarProps = {
    variant: "archive-capable";
    archiveMode: ArchiveMode;
    isManageMode: boolean;
    labels: ArchiveLabels;
    selectedCount: number;
    onArchiveModeChange: (mode: ArchiveMode) => void;
    onEnterManage: () => void;
    onToggleSelectAll: () => void;
    onPrimaryBulkAction: () => void;
    onDelete: () => void;
    onCloseManage: () => void;
    className?: string;
    actionsClassName?: string;
    manageButtonClassName?: string;
    manageDisabled?: boolean;
    manageDisabledReason?: string;
    selectAllDisabled?: boolean;
    primaryBulkDisabled?: boolean;
    deleteDisabled?: boolean;
};

export type ManageActionToolbarProps =
    | SimpleManageActionToolbarProps
    | ArchiveManageActionToolbarProps;

const responsiveActionButtonClassName =
    "h-9 w-9 px-0 sm:w-auto sm:px-3";

function ActionLabel({ children }: { children: React.ReactNode }) {
    return <span className="hidden sm:inline">{children}</span>;
}

function ToolbarActionButton({
    label,
    className,
    children,
    ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
    return (
        <Button
            type="button"
            aria-label={label}
            title={label}
            className={cn(responsiveActionButtonClassName, className)}
            {...props}
        >
            {children}
            <ActionLabel>{label}</ActionLabel>
        </Button>
    );
}

function ManageModeActions({
    labels,
    onToggleSelectAll,
    onDelete,
    onCloseManage,
    selectAllDisabled,
    deleteDisabled,
    primaryButton,
    className,
}: {
    labels: CommonLabels;
    onToggleSelectAll: () => void;
    onDelete: () => void;
    onCloseManage: () => void;
    selectAllDisabled?: boolean;
    deleteDisabled?: boolean;
    primaryButton?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            <span className="text-sm font-medium text-foreground">
                {labels.selectedCount}
            </span>
            <ToolbarActionButton
                label={labels.selectAll}
                variant="outline"
                onClick={onToggleSelectAll}
                disabled={selectAllDisabled}
            >
                <CheckCheck className="h-4 w-4" />
            </ToolbarActionButton>
            {primaryButton}
            <ToolbarActionButton
                label={labels.deleteSelected}
                variant="destructive"
                onClick={onDelete}
                disabled={deleteDisabled}
            >
                <Trash2 className="h-4 w-4" />
            </ToolbarActionButton>
            <Button
                type="button"
                variant="ghost"
                aria-label={labels.closeManage}
                title={labels.closeManage}
                className="h-9 w-9 px-0"
                onClick={onCloseManage}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function ManageActionToolbar(props: ManageActionToolbarProps) {
    if (props.variant === "archive-capable") {
        const isArchiveView = props.archiveMode === "archived";
        const primaryBulkLabel = isArchiveView
            ? props.labels.restoreSelected
            : props.labels.archiveSelected;

        return (
            <div className={cn("flex flex-wrap items-center gap-2", props.className)}>
                <ToolbarActionButton
                    label={props.labels.active}
                    variant={!isArchiveView ? "default" : "outline"}
                    onClick={() => props.onArchiveModeChange("active")}
                >
                    <FolderOpen className="h-4 w-4" />
                </ToolbarActionButton>
                <ToolbarActionButton
                    label={props.labels.archived}
                    variant={isArchiveView ? "default" : "outline"}
                    onClick={() => props.onArchiveModeChange("archived")}
                >
                    <Archive className="h-4 w-4" />
                </ToolbarActionButton>
                <div
                    className={cn(
                        "ml-auto flex flex-wrap items-center gap-2",
                        props.actionsClassName,
                    )}
                >
                    {props.isManageMode ? (
                        <ManageModeActions
                            labels={props.labels}
                            onToggleSelectAll={props.onToggleSelectAll}
                            onDelete={props.onDelete}
                            onCloseManage={props.onCloseManage}
                            selectAllDisabled={props.selectAllDisabled}
                            deleteDisabled={props.deleteDisabled}
                            primaryButton={(
                                <ToolbarActionButton
                                    label={primaryBulkLabel}
                                    variant="outline"
                                    onClick={props.onPrimaryBulkAction}
                                    disabled={props.primaryBulkDisabled}
                                >
                                    {isArchiveView ? (
                                        <ArchiveRestore className="h-4 w-4" />
                                    ) : (
                                        <Archive className="h-4 w-4" />
                                    )}
                                </ToolbarActionButton>
                            )}
                        />
                    ) : (
                        <ToolbarActionButton
                            label={props.labels.manage}
                            variant="outline"
                            onClick={props.onEnterManage}
                            disabled={props.manageDisabled}
                            className={props.manageButtonClassName}
                            title={props.manageDisabled ? props.manageDisabledReason : props.labels.manage}
                        >
                            <Settings2 className="h-4 w-4" />
                        </ToolbarActionButton>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-wrap items-center gap-2", props.className)}>
            {props.isManageMode ? (
                <ManageModeActions
                    labels={props.labels}
                    onToggleSelectAll={props.onToggleSelectAll}
                    onDelete={props.onDelete}
                    onCloseManage={props.onCloseManage}
                    selectAllDisabled={props.selectAllDisabled}
                    deleteDisabled={props.deleteDisabled}
                    className={props.actionsClassName}
                />
            ) : (
                <ToolbarActionButton
                    label={props.labels.manage}
                    variant="outline"
                    onClick={props.onEnterManage}
                    disabled={props.manageDisabled}
                    className={props.manageButtonClassName}
                    title={props.manageDisabled ? props.manageDisabledReason : props.labels.manage}
                >
                    <Settings2 className="h-4 w-4" />
                </ToolbarActionButton>
            )}
        </div>
    );
}
