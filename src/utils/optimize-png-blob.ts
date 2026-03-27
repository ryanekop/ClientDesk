type OptimizePngBlobOptions = {
  maxBytes: number;
  maxDimension?: number;
  minDimension?: number;
  downscaleRatio?: number;
  maxAttempts?: number;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_MIN_DIMENSION = 256;
const DEFAULT_DOWNSCALE_RATIO = 0.85;
const DEFAULT_MAX_ATTEMPTS = 8;

function ensurePositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

function normalizeRatio(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0 || value >= 1) return fallback;
  return value;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca gambar."));
    };

    image.src = objectUrl;
  });
}

function renderToPngBlob(
  image: HTMLImageElement,
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Browser tidak mendukung canvas."));
      return;
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Gagal memproses gambar."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function optimizePngBlobForUpload(
  inputBlob: Blob,
  options: OptimizePngBlobOptions,
) {
  const maxBytes = ensurePositiveInteger(options.maxBytes, 500 * 1024);
  const maxDimension = ensurePositiveInteger(
    options.maxDimension ?? DEFAULT_MAX_DIMENSION,
    DEFAULT_MAX_DIMENSION,
  );
  const minDimension = ensurePositiveInteger(
    options.minDimension ?? DEFAULT_MIN_DIMENSION,
    DEFAULT_MIN_DIMENSION,
  );
  const downscaleRatio = normalizeRatio(
    options.downscaleRatio ?? DEFAULT_DOWNSCALE_RATIO,
    DEFAULT_DOWNSCALE_RATIO,
  );
  const maxAttempts = ensurePositiveInteger(
    options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    DEFAULT_MAX_ATTEMPTS,
  );

  if (inputBlob.size <= maxBytes) {
    return inputBlob;
  }

  const image = await loadImageFromBlob(inputBlob);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error("Dimensi gambar tidak valid.");
  }

  const initialScale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
  let width = Math.max(1, Math.round(originalWidth * initialScale));
  let height = Math.max(1, Math.round(originalHeight * initialScale));

  let currentBlob = await renderToPngBlob(image, width, height);
  if (currentBlob.size <= maxBytes) {
    return currentBlob;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (Math.max(width, height) <= minDimension) {
      break;
    }

    let nextWidth = Math.max(1, Math.round(width * downscaleRatio));
    let nextHeight = Math.max(1, Math.round(height * downscaleRatio));

    if (Math.max(nextWidth, nextHeight) < minDimension) {
      const minScale = minDimension / Math.max(width, height);
      nextWidth = Math.max(1, Math.round(width * minScale));
      nextHeight = Math.max(1, Math.round(height * minScale));
    }

    if (nextWidth === width && nextHeight === height) {
      break;
    }

    width = nextWidth;
    height = nextHeight;

    currentBlob = await renderToPngBlob(image, width, height);
    if (currentBlob.size <= maxBytes) {
      return currentBlob;
    }
  }

  return currentBlob;
}
