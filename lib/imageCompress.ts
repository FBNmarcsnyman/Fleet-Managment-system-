// Downsize + compress an image data-URL BEFORE upload, so PODs/photos aren't multi-MB.
// Camera photos are often 5–10MB; this scales the longest side to `maxDim` and re-encodes
// as JPEG at `quality`, typically cutting the size by 80–95%. PDFs and non-images pass
// through untouched (can't canvas-resize a PDF). Safe: on any failure it returns the input.
export async function compressImage(
    dataUrl: string,
    maxDim = 1600,
    quality = 0.72,
): Promise<{ dataUrl: string; type: string }> {
    try {
        if (!dataUrl.startsWith('data:image/')) {
            const type = dataUrl.slice(5, dataUrl.indexOf(';')) || 'application/octet-stream';
            return { dataUrl, type };
        }
        return await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (!width || !height) { resolve({ dataUrl, type: 'image/jpeg' }); return; }
                if (width > maxDim || height > maxDim) {
                    const r = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * r); height = Math.round(height * r);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve({ dataUrl, type: 'image/jpeg' }); return; }
                // White backdrop so any transparency doesn't turn black in JPEG.
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), type: 'image/jpeg' });
            };
            img.onerror = () => resolve({ dataUrl, type: 'image/jpeg' });
            img.src = dataUrl;
        });
    } catch {
        return { dataUrl, type: 'image/jpeg' };
    }
}
