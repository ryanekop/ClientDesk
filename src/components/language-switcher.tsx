"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

const locales = [
    { code: "id", label: "Bahasa Indonesia" },
    { code: "en", label: "English" },
];

export function LanguageSwitcher() {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const currentLocale = useLocale();

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function switchLocale(newLocale: string) {
        const segments = pathname.split("/");
        segments[1] = newLocale;
        router.push(segments.join("/"));
        setOpen(false);
    }

    return (
        <div className="relative" ref={ref}>
            <Button variant="outline" size="icon" onClick={() => setOpen(!open)}>
                <Languages className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Switch language</span>
            </Button>
            <div
                className={`absolute right-0 top-full mt-2 w-48 rounded-lg border bg-card shadow-lg py-1 z-50 origin-top-right transform-gpu transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] motion-reduce:transition-none ${open
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-1 opacity-0"
                    }`}
            >
                {locales.map((locale) => (
                    <button
                        key={locale.code}
                        onClick={() => switchLocale(locale.code)}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors cursor-pointer ${currentLocale === locale.code ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                    >
                        {locale.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
