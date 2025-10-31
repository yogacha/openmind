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
    Vec,
    randId,
    downloadJSONFile,
};