// vector operations
export function vecAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function vecSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(v, scale = 1) {
    return { x: v.x * scale, y: v.y * scale };
}

export function vecNormalize(v, length = 1) {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    if (mag === 0) return { x: 0, y: 0 };
    return vecScale(v, length / mag);
}

export function vecAntipode(center, v) {
    return vecAdd(center, vecSub(center, v));
}

export function randId() { // generate random ID
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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

export default {
    vecAdd,
    vecSub,
    vecScale,
    vecNormalize,
    vecAntipode,
    randId,
    downloadJSONFile,
};