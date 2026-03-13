import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-sm">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          Memuat halaman...
        </p>
      </div>
    </div>
  );
}
