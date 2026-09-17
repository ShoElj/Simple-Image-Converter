// Text/data conversions: JSON <-> CSV, and a universal Base64 encoder/decoder
// that works on any file type. Pure JS, no dependencies.

function csvEscape(value) {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function jsonToCsv(jsonText) {
    let data = JSON.parse(jsonText);
    if (!Array.isArray(data)) {
        data = [data];
    }
    if (data.length === 0) {
        return '';
    }
    if (typeof data[0] !== 'object' || data[0] === null) {
        // Array of primitives -> single-column CSV.
        return ['value', ...data.map((v) => csvEscape(v))].join('\n');
    }

    const headers = [];
    for (const row of data) {
        for (const key of Object.keys(row)) {
            if (!headers.includes(key)) headers.push(key);
        }
    }

    const lines = [headers.map(csvEscape).join(',')];
    for (const row of data) {
        lines.push(headers.map((h) => {
            const v = row[h];
            if (v !== null && typeof v === 'object') return csvEscape(JSON.stringify(v));
            return csvEscape(v);
        }).join(','));
    }
    return lines.join('\r\n');
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function coerce(value) {
    if (value === '') return null;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
}

export function csvToJson(csvText) {
    const rows = parseCsv(csvText.replace(/^﻿/, ''));
    if (rows.length === 0) return '[]';
    const [headers, ...dataRows] = rows;
    const objects = dataRows.map((row) => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = coerce(row[i] ?? ''); });
        return obj;
    });
    return JSON.stringify(objects, null, 2);
}

// Base64-encodes any file as a self-describing data URL saved to a .txt file,
// so decoding can restore the original name and MIME type.
export function encodeFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result; // "data:<mime>;base64,<data>"
            const [prefix, data] = dataUrl.split(',');
            const mime = prefix.slice('data:'.length).replace(/;base64$/, '') || 'application/octet-stream';
            const named = `data:${mime};name=${encodeURIComponent(file.name)};base64,${data}`;
            resolve(new Blob([named], { type: 'text/plain' }));
        };
        reader.onerror = () => reject(new Error('Could not read the file to encode.'));
        reader.readAsDataURL(file);
    });
}

// Decodes a Base64 data-URL text file back into its original binary file.
export async function decodeBase64ToFile(file) {
    const text = (await file.text()).trim();
    const match = text.match(/^data:([^;,]+)(?:;name=([^;,]+))?;base64,(.+)$/s);

    let mime = 'application/octet-stream';
    let name = 'decoded.bin';
    let base64Data = text;

    if (match) {
        mime = match[1];
        if (match[2]) name = decodeURIComponent(match[2]);
        base64Data = match[3];
    }

    const dataUrl = `data:${mime};base64,${base64Data.replace(/\s+/g, '')}`;
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('The file does not contain valid Base64 data.');
    const blob = await response.blob();
    return { blob, name };
}
