// PDF conversion: images -> PDF (jsPDF) and PDF -> images (pdf.js).
// Both libraries are vendored locally and loaded on demand.

import { loadScript } from '../vendor-loader.js';
import { loadImageAsCanvas } from './image.js';

let pdfjsLibPromise = null;
function getPdfjsLib() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = import('../../vendor/pdf.min.mjs').then((lib) => {
            lib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.mjs';
            return lib;
        });
    }
    return pdfjsLibPromise;
}

async function getJsPDF() {
    if (!window.jspdf) {
        await loadScript('assets/vendor/jspdf.umd.min.js');
    }
    return window.jspdf.jsPDF;
}

async function getJSZip() {
    if (!window.JSZip) {
        await loadScript('assets/vendor/jszip.min.js');
    }
    return window.JSZip;
}

export async function convertImageToPdf(file) {
    const [canvas, JsPDF] = await Promise.all([loadImageAsCanvas(file), getJsPDF()]);
    const orientation = canvas.width >= canvas.height ? 'l' : 'p';
    const doc = new JsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    doc.addImage(dataUrl, 'JPEG', 0, 0, canvas.width, canvas.height);
    return doc.output('blob');
}

// Renders every page of a PDF to an image. Returns a single Blob for a
// one-page PDF, or a zip Blob containing one image per page otherwise.
export async function convertPdfToImages(file, imageFormat = 'png', quality = 0.92) {
    const pdfjsLib = await getPdfjsLib();
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const mimeType = `image/${imageFormat}`;
    const pageBlobs = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (imageFormat === 'jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render PDF page.'))), mimeType, quality);
        });
        pageBlobs.push(blob);
    }

    if (pageBlobs.length === 1) {
        return { blob: pageBlobs[0], multi: false };
    }

    const JSZip = await getJSZip();
    const zip = new JSZip();
    for (let i = 0; i < pageBlobs.length; i++) {
        zip.file(`page-${String(i + 1).padStart(2, '0')}.${imageFormat}`, pageBlobs[i]);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, multi: true, pageCount: pageBlobs.length };
}
