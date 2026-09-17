import { convertImage, IMAGE_TARGETS } from './converters/image.js';
import { convertImageToPdf, convertPdfToImages } from './converters/pdf.js';
import { jsonToCsv, csvToJson, encodeFileToBase64, decodeBase64ToFile } from './converters/data.js';
import { convertAudio, AUDIO_TARGETS } from './converters/audio.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM element references ---
    const dropZone = document.getElementById('drop-zone');
    const fileUpload = document.getElementById('file-upload');
    const mainContent = document.getElementById('main-content');
    const conversionInterface = document.getElementById('conversion-interface');
    const categoryBadge = document.getElementById('category-badge');
    const originalPreview = document.getElementById('original-preview');
    const originalInfo = document.getElementById('original-info');
    const formatSelect = document.getElementById('format-select');
    const qualityControl = document.getElementById('quality-control');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const bitrateControl = document.getElementById('bitrate-control');
    const bitrateSelect = document.getElementById('bitrate-select');
    const convertBtn = document.getElementById('convert-btn');
    const convertBtnText = document.getElementById('convert-btn-text');
    const loader = document.getElementById('loader');
    const resultArea = document.getElementById('result-area');
    const resultPreview = document.getElementById('result-preview');
    const resultInfo = document.getElementById('result-info');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // --- State ---
    let originalFile = null;
    let originalFileName = '';
    let category = null;
    let originalObjectUrl = null;
    let resultObjectUrl = null;

    // --- Category detection ---
    const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tif', 'tiff'];
    const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'weba', 'opus'];

    const CATEGORY_LABELS = {
        image: 'Image',
        pdf: 'PDF',
        'data-json': 'JSON',
        'data-csv': 'CSV',
        audio: 'Audio',
        base64: 'Base64',
        unknown: 'File',
    };

    function getExt(name) {
        const parts = name.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    async function detectCategory(file) {
        const ext = getExt(file.name);
        if (ext === 'b64' || ext === 'base64') return 'base64';
        if (ext === 'json') return 'data-json';
        if (ext === 'csv') return 'data-csv';
        if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
        if (file.type.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image';
        if (file.type.startsWith('audio/') || AUDIO_EXTS.includes(ext)) return 'audio';

        // Sniff text-ish/unknown files for our own Base64 data-URL format, so
        // re-uploading a file this app just encoded (as .txt) is recognized
        // for decoding without requiring a .b64/.base64 extension.
        if (ext === 'txt' || ext === '' || file.type.startsWith('text/')) {
            try {
                const head = await file.slice(0, 100).text();
                if (/^data:[^,]*;base64,/.test(head.trim())) return 'base64';
            } catch {
                // Fall through to 'unknown' below.
            }
        }
        return 'unknown';
    }

    function targetsForCategory(cat) {
        const base64Target = { value: 'base64', label: 'Base64 (.txt)' };
        switch (cat) {
            case 'image':
                return [...IMAGE_TARGETS, { value: 'pdf', label: 'PDF' }, base64Target];
            case 'pdf':
                return [
                    { value: 'png', label: 'PNG (per page)' },
                    { value: 'jpeg', label: 'JPEG (per page)' },
                    base64Target,
                ];
            case 'data-json':
                return [{ value: 'csv', label: 'CSV' }, base64Target];
            case 'data-csv':
                return [{ value: 'json', label: 'JSON' }, base64Target];
            case 'audio':
                return [...AUDIO_TARGETS, base64Target];
            case 'base64':
                return [{ value: 'decode', label: 'Decoded Original File' }];
            default:
                return [base64Target];
        }
    }

    // --- Event listeners ---

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    fileUpload.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length) handleFile(files[0]);
    });

    formatSelect.addEventListener('change', () => {
        updateOptionVisibility();
        resultArea.classList.add('hidden');
    });

    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = parseFloat(qualitySlider.value).toFixed(2);
        resultArea.classList.add('hidden');
    });

    bitrateSelect.addEventListener('change', () => {
        resultArea.classList.add('hidden');
    });

    convertBtn.addEventListener('click', () => {
        if (!originalFile) return;

        showLoader(true);
        resultArea.classList.add('hidden');
        hideError();

        setTimeout(() => {
            runConversion()
                .catch((err) => showError(err.message || 'Something went wrong during conversion.'))
                .finally(() => showLoader(false));
        }, 50);
    });

    resetBtn.addEventListener('click', resetInterface);

    // --- Core functions ---

    async function handleFile(file) {
        hideError();
        originalFile = file;
        category = await detectCategory(file);
        originalFileName = file.name.split('.').slice(0, -1).join('.') || file.name;

        categoryBadge.textContent = CATEGORY_LABELS[category];
        populateFormatSelect();
        renderOriginalPreview();

        originalInfo.innerHTML = `<strong>Name:</strong> ${escapeHtml(file.name)}<br><strong>Size:</strong> ${formatBytes(file.size)}`;

        mainContent.classList.add('hidden');
        conversionInterface.classList.remove('hidden');
        resultArea.classList.add('hidden');
    }

    function populateFormatSelect() {
        const targets = targetsForCategory(category);
        formatSelect.innerHTML = '';
        for (const t of targets) {
            const opt = document.createElement('option');
            opt.value = t.value;
            opt.textContent = t.label;
            formatSelect.appendChild(opt);
        }
        updateOptionVisibility();
    }

    function updateOptionVisibility() {
        const target = formatSelect.value;
        qualityControl.classList.toggle('hidden', !(category === 'image' && (target === 'jpeg' || target === 'webp')));
        bitrateControl.classList.toggle('hidden', !(category === 'audio' && target === 'mp3'));
    }

    async function runConversion() {
        const target = formatSelect.value;
        let blob;
        let outName;

        if (target === 'base64' && category !== 'base64') {
            blob = await encodeFileToBase64(originalFile);
            outName = `${originalFileName}.txt`;
        } else if (category === 'image') {
            if (target === 'pdf') {
                blob = await convertImageToPdf(originalFile);
                outName = `${originalFileName}.pdf`;
            } else {
                const quality = parseFloat(qualitySlider.value);
                blob = await convertImage(originalFile, target, { quality });
                outName = `${originalFileName}.${target}`;
            }
        } else if (category === 'pdf') {
            const result = await convertPdfToImages(originalFile, target, 0.92);
            blob = result.blob;
            outName = result.multi ? `${originalFileName}-pages.zip` : `${originalFileName}.${target}`;
        } else if (category === 'data-json') {
            const csv = jsonToCsv(await originalFile.text());
            blob = new Blob([csv], { type: 'text/csv' });
            outName = `${originalFileName}.csv`;
        } else if (category === 'data-csv') {
            const json = csvToJson(await originalFile.text());
            blob = new Blob([json], { type: 'application/json' });
            outName = `${originalFileName}.json`;
        } else if (category === 'audio') {
            const bitrate = parseInt(bitrateSelect.value, 10);
            blob = await convertAudio(originalFile, target, { bitrate });
            outName = `${originalFileName}.${target}`;
        } else if (category === 'base64') {
            const decoded = await decodeBase64ToFile(originalFile);
            blob = decoded.blob;
            outName = decoded.name;
        } else {
            blob = await encodeFileToBase64(originalFile);
            outName = `${originalFileName}.txt`;
        }

        displayResult(blob, outName);
    }

    function displayResult(blob, outName) {
        if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
        resultObjectUrl = URL.createObjectURL(blob);

        renderPreview(resultPreview, blob, resultObjectUrl, outName);

        resultInfo.innerHTML = `<strong>New Name:</strong> ${escapeHtml(outName)}<br><strong>Size:</strong> ${formatBytes(blob.size)}`;

        downloadBtn.href = resultObjectUrl;
        downloadBtn.download = outName;

        resultArea.classList.remove('hidden');
    }

    function resetInterface() {
        originalFile = null;
        originalFileName = '';
        category = null;

        if (originalObjectUrl) { URL.revokeObjectURL(originalObjectUrl); originalObjectUrl = null; }
        if (resultObjectUrl) { URL.revokeObjectURL(resultObjectUrl); resultObjectUrl = null; }

        fileUpload.value = '';
        mainContent.classList.remove('hidden');
        conversionInterface.classList.add('hidden');
        resultArea.classList.add('hidden');
        hideError();

        originalPreview.innerHTML = '';
        resultPreview.innerHTML = '';
        categoryBadge.textContent = '';

        qualitySlider.value = '0.92';
        qualityValue.textContent = '0.92';
        qualityControl.classList.add('hidden');
        bitrateControl.classList.add('hidden');
        bitrateSelect.value = '192';
    }

    // --- Preview rendering ---

    function renderOriginalPreview() {
        if (originalObjectUrl) URL.revokeObjectURL(originalObjectUrl);
        originalObjectUrl = URL.createObjectURL(originalFile);
        renderPreview(originalPreview, originalFile, originalObjectUrl, originalFile.name);
    }

    async function renderPreview(container, blob, objectUrl, name) {
        container.innerHTML = '';
        const type = blob.type || '';
        const looksText = type.startsWith('text/') || type === 'application/json' || /\.(txt|json|csv|b64|base64)$/i.test(name);

        if (type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = objectUrl;
            img.alt = name;
            img.className = 'rounded-md max-h-80 w-full object-contain';
            img.onerror = () => renderGenericFile(container, name);
            container.appendChild(img);
            return;
        }

        if (type.startsWith('audio/')) {
            const audio = document.createElement('audio');
            audio.src = objectUrl;
            audio.controls = true;
            audio.className = 'w-full';
            container.appendChild(audio);
            return;
        }

        if (looksText) {
            const text = await blob.text();
            const pre = document.createElement('pre');
            pre.className = 'text-xs text-gray-300 whitespace-pre-wrap break-all max-h-64 overflow-auto w-full p-2';
            pre.textContent = text.length > 2000 ? `${text.slice(0, 2000)}\n…` : text;
            container.appendChild(pre);
            return;
        }

        renderGenericFile(container, name);
    }

    function renderGenericFile(container, name) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'flex flex-col items-center justify-center text-gray-400 py-6';

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'w-12 h-12 mb-2 text-gray-500');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>';
        wrap.appendChild(icon);

        const label = document.createElement('p');
        label.className = 'text-sm text-center break-all px-2';
        label.textContent = name;
        wrap.appendChild(label);

        container.appendChild(wrap);
    }

    // --- Helpers ---

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showLoader(show) {
        convertBtn.disabled = show;
        convertBtnText.classList.toggle('hidden', show);
        loader.classList.toggle('hidden', !show);
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }
});
