// Image format conversion using canvas, plus hand-rolled encoders for
// formats browsers don't actually support via canvas.toBlob (BMP, ICO).

export const IMAGE_TARGETS = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WEBP' },
    { value: 'bmp', label: 'BMP' },
    { value: 'ico', label: 'ICO' },
];

// Browsers only reliably encode these via canvas — everything else needs a
// manual encoder below.
const NATIVE_CANVAS_TARGETS = new Set(['png', 'jpeg', 'webp']);

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not load the image. The file might be corrupt or an unsupported format.'));
        };
        img.src = url;
    });
}

function drawToCanvas(img, opaque) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (opaque) {
        // Formats without alpha support need a solid background or
        // transparent pixels render as black.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    return canvas;
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error(`Your browser could not encode this image as ${mimeType}.`));
        }, mimeType, quality);
    });
}

// Encodes raw RGBA canvas pixels as an uncompressed 24-bit BMP.
function encodeBMP(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);

    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // BITMAPFILEHEADER
    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4d); // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true);
    view.setUint32(10, 54, true); // pixel data offset

    // BITMAPINFOHEADER
    view.setUint32(14, 40, true); // header size
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true); // planes
    view.setUint16(28, 24, true); // bits per pixel
    view.setUint32(30, 0, true); // no compression
    view.setUint32(34, pixelArraySize, true);
    view.setInt32(38, 2835, true); // ~72 DPI
    view.setInt32(42, 2835, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // Pixel data: bottom-up, BGR, rows padded to 4 bytes.
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
        const rowStart = offset;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            view.setUint8(offset++, data[i + 2]); // B
            view.setUint8(offset++, data[i + 1]); // G
            view.setUint8(offset++, data[i]);     // R
        }
        offset = rowStart + rowSize; // skip padding bytes (already zeroed)
    }

    return new Blob([buffer], { type: 'image/bmp' });
}

// Wraps a PNG-encoded canvas in a minimal single-image ICO container.
// Modern Windows/browsers happily read PNG-compressed ICO entries.
async function encodeICO(canvas) {
    const pngBlob = await canvasToBlob(canvas, 'image/png');
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const { width, height } = canvas;

    const header = new ArrayBuffer(6);
    const headerView = new DataView(header);
    headerView.setUint16(0, 0, true); // reserved
    headerView.setUint16(2, 1, true); // type: icon
    headerView.setUint16(4, 1, true); // 1 image

    const entry = new ArrayBuffer(16);
    const entryView = new DataView(entry);
    entryView.setUint8(0, width >= 256 ? 0 : width);
    entryView.setUint8(1, height >= 256 ? 0 : height);
    entryView.setUint8(2, 0); // color palette
    entryView.setUint8(3, 0); // reserved
    entryView.setUint16(4, 1, true); // color planes
    entryView.setUint16(6, 32, true); // bits per pixel
    entryView.setUint32(8, pngBytes.byteLength, true);
    entryView.setUint32(12, 22, true); // offset of image data

    return new Blob([header, entry, pngBytes], { type: 'image/x-icon' });
}

export async function convertImage(file, targetFormat, options = {}) {
    const img = await loadImage(file);
    const opaque = targetFormat === 'jpeg' || targetFormat === 'bmp';
    const canvas = drawToCanvas(img, opaque);

    if (targetFormat === 'bmp') {
        return encodeBMP(canvas);
    }
    if (targetFormat === 'ico') {
        if (canvas.width > 256 || canvas.height > 256) {
            throw new Error('ICO images must be 256x256 pixels or smaller. Resize the source image first.');
        }
        return encodeICO(canvas);
    }
    if (NATIVE_CANVAS_TARGETS.has(targetFormat)) {
        const mimeType = `image/${targetFormat}`;
        const quality = targetFormat === 'jpeg' || targetFormat === 'webp' ? options.quality : undefined;
        return canvasToBlob(canvas, mimeType, quality);
    }
    throw new Error(`Unsupported image target format: ${targetFormat}`);
}

export async function loadImageAsCanvas(file) {
    const img = await loadImage(file);
    return drawToCanvas(img, false);
}
