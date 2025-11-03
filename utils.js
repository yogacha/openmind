export const Vec = {
    add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y };
    },
    sub(a, b) {
        return { x: a.x - b.x, y: a.y - b.y };
    },
    scale(v, scale = 1) {
        return { x: v.x * scale, y: v.y * scale };
    },
    dist(a, b) {
        return Vec.norm(Vec.sub(a, b));
    },
    norm(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    },
    normalize(v, length = 1) {
        const mag = Math.sqrt(v.x * v.x + v.y * v.y);
        if (mag === 0) return { x: 0, y: 0 };
        return Vec.scale(v, length / mag);
    },
    antipode(center, v) {
        return Vec.add(center, Vec.sub(center, v));
    },
}

export function randId() { // generate random ID
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function randUniform(low, high) {
    return Math.random() * (high - low) + low
}

export function downloadJSONFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function randomColor(brightnessLow = 128) {
    // Generate brighter colors by ensuring minimum brightness
    const c = 256 - brightnessLow;
    const r = Math.floor(Math.random() * c + brightnessLow); // [brightnessLow, 256)
    const g = Math.floor(Math.random() * c + brightnessLow); // [brightnessLow, 256)
    const b = Math.floor(Math.random() * c + brightnessLow); // [brightnessLow, 256)
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


export default {
    Vec,
    randId,
    randUniform,
    downloadJSONFile,
    randomColor,
    escapeHtml,
};