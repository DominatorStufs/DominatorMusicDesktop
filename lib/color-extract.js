// Uses a hidden, separate Image (not the visible <img>) so that even if
// pixel reading is blocked by the CDN's CORS policy, nothing the user sees
// is affected - this feature just quietly does nothing in that case.
export function extractDominantColor(src) {
    return new Promise((resolve) => {
        if (!src || typeof window === "undefined") {
            resolve(null);
            return;
        }
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const size = 24;
                    const canvas = document.createElement("canvas");
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, size, size);
                    const { data } = ctx.getImageData(0, 0, size, size);
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        // skip near-white/near-black pixels so the color isn't washed out
                        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                        if (brightness < 15 || brightness > 245) continue;
                        r += data[i]; g += data[i + 1]; b += data[i + 2];
                        count++;
                    }
                    if (!count) { resolve(null); return; }
                    resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
                } catch (e) {
                    resolve(null); // canvas tainted by CORS - just skip the effect
                }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        } catch (e) {
            resolve(null);
        }
    });
}
