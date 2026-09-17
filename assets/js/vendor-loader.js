// Lazily loads vendored (non-module) libraries as plain <script> tags,
// only when a conversion actually needs them, and only once each.

const loaded = new Map();

export function loadScript(src) {
    if (loaded.has(src)) return loaded.get(src);

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load required library: ${src}`));
        document.head.appendChild(script);
    });

    loaded.set(src, promise);
    return promise;
}
