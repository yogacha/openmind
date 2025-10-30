// vector operations
function vecAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

function vecSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function antipode(center, v) {
    return vecAdd(center, vecSub(center, v));
}

function randId() { // generate random ID
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export {
    vecAdd,
    vecSub,
    antipode,
    randId,
    downloadFile,
};

export default {
    vecAdd,
    vecSub,
    antipode,
    randId,
    downloadFile,
};