// vector operations
function vecAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

function vecSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function randId() { // generate random ID
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

module.exports = {
    vecAdd,
    vecSub,
    randId,
};