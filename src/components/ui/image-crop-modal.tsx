"use client";

import * as React from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, X, Check } from "lucide-react";

interface ImageCropModalProps {
    open: boolean;
    imageSrc: string;
    title?: string;
    aspect?: number; // 1 for square, use 1 for both avatar and logo
    cropShape?: "round" | "rect";
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => void;
}

function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("No 2d context")); return; }
            ctx.drawImage(
                image,
                pixelCrop.x, pixelCrop.y,
                pixelCrop.width, pixelCrop.height,
                0, 0,
                pixelCrop.width, pixelCrop.height
            );
            canvas.toBlob(
                (blob) => { if (blob) resolve(blob); else reject(new Error("Canvas is empty")); },
                "image/png",
                1
            );
        };
        image.onerror = reject;
        image.src = imageSrc;
    });
}

export function ImageCropModal({ open, imageSrc, title = "Crop Gambar", aspect = 1, cropShape = "rect", onClose, onCropComplete }: ImageCropModalProps) {
    const [crop, setCrop] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
    const [processing, setProcessing] = React.useState(false);

    const handleCropComplete = React.useCallback((_: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    async function handleApply() {
        if (!croppedAreaPixels) return;
        setProcessing(true);
        try {
            const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(blob);
        } catch (err) {
            console.error("Crop failed:", err);
        } finally {
            setProcessing(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="relative w-full" style={{ height: 350 }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        cropShape={cropShape}
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={handleCropComplete}
                    />
                </div>
                {/* Zoom controls */}
                <div className="flex items-center gap-3 justify-center py-2">
                    <ZoomOut className="w-4 h-4 text-muted-foreground" />
                    <input
                        type="range"
                        min={1} max={3} step={0.05}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 max-w-60 accent-primary h-1.5 cursor-pointer"
                    />
                    <ZoomIn className="w-4 h-4 text-muted-foreground" />
                </div>
                <DialogFooter className="flex gap-2 sm:gap-2">
                    <Button variant="outline" onClick={onClose} className="gap-1.5 flex-1">
                        <X className="w-4 h-4" /> Batal
                    </Button>
                    <Button onClick={handleApply} disabled={processing} className="gap-1.5 flex-1">
                        <Check className="w-4 h-4" /> Gunakan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
