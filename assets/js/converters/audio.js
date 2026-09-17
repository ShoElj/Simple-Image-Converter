// Audio conversion: decode anything the browser's Web Audio API can decode,
// then re-encode as WAV (native, no deps) or MP3 (vendored lamejs).

import { loadScript } from '../vendor-loader.js';

export const AUDIO_TARGETS = [
    { value: 'wav', label: 'WAV' },
    { value: 'mp3', label: 'MP3' },
];

export const MP3_BITRATES = [128, 192, 320];

async function decodeAudio(file) {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    try {
        return await ctx.decodeAudioData(arrayBuffer);
    } catch {
        throw new Error('Could not decode this audio file. It may be an unsupported or corrupt format.');
    } finally {
        ctx.close();
    }
}

function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
}

function encodeWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = [];
    for (let c = 0; c < numChannels; c++) channelData.push(audioBuffer.getChannelData(c));

    const numFrames = audioBuffer.length;
    const interleaved = new Float32Array(numFrames * numChannels);
    for (let i = 0; i < numFrames; i++) {
        for (let c = 0; c < numChannels; c++) {
            interleaved[i * numChannels + c] = channelData[c][i];
        }
    }
    const pcm = floatTo16BitPCM(interleaved);

    const blockAlign = numChannels * 2;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < pcm.length; i++, offset += 2) {
        view.setInt16(offset, pcm[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

async function encodeMp3(audioBuffer, bitrateKbps) {
    if (!window.lamejs) {
        await loadScript('assets/vendor/lame.min.js');
    }

    const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new window.lamejs.Mp3Encoder(numChannels, sampleRate, bitrateKbps);

    const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
    const right = numChannels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

    const chunkSize = 1152;
    const mp3Chunks = [];
    for (let i = 0; i < left.length; i += chunkSize) {
        const leftChunk = left.subarray(i, i + chunkSize);
        const mp3buf = right
            ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + chunkSize))
            : encoder.encodeBuffer(leftChunk);
        if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
    }
    const finalBuf = encoder.flush();
    if (finalBuf.length > 0) mp3Chunks.push(finalBuf);

    return new Blob(mp3Chunks, { type: 'audio/mpeg' });
}

export async function convertAudio(file, targetFormat, options = {}) {
    const audioBuffer = await decodeAudio(file);
    if (targetFormat === 'wav') {
        return encodeWav(audioBuffer);
    }
    if (targetFormat === 'mp3') {
        return encodeMp3(audioBuffer, options.bitrate || 192);
    }
    throw new Error(`Unsupported audio target format: ${targetFormat}`);
}
