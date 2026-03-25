"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [open, setOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const activeTheme = mounted ? theme : null;

    return (
        <div className="relative" ref={ref}>
            <Button
                variant="outline"
                size="icon"
                onClick={() => setOpen(!open)}
            >
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </Button>
            <div
                className={`absolute right-0 top-full mt-2 w-36 rounded-lg border bg-card shadow-lg py-1 z-50 origin-top-right transform-gpu transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] motion-reduce:transition-none ${open
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-1 opacity-0"
                    }`}
            >
                {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                ].map((item) => (
                    <button
                        key={item.value}
                        onClick={() => { setTheme(item.value); setOpen(false); }}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors cursor-pointer ${activeTheme === item.value ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
