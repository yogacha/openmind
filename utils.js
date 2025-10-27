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

export {
    vecAdd,
    vecSub,
    antipode,
    randId,
};