"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (perPage: number) => void;
    perPageOptions?: number[];
}

export function TablePagination({
    totalItems,
    currentPage,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    perPageOptions = [10, 25, 50],
}: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
                <span>Tampilkan</span>
                <select
                    value={itemsPerPage}
                    onChange={(e) => { onItemsPerPageChange(Number(e.target.value)); onPageChange(1); }}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
                >
                    {perPageOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>per halaman</span>
            </div>
            <div className="flex items-center gap-2">
                <span>{totalItems > 0 ? `${start}–${end} dari ${totalItems}` : "0 data"}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-input bg-background hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-medium text-foreground">{currentPage}/{totalPages}</span>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-input bg-background hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Utility: paginate an array */
export function paginateArray<T>(items: T[], page: number, perPage: number): T[] {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
}
