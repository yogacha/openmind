/**
 * @typedef {string} id
 */

import utils from './utils.js';

const nodeRadius = 30; // for hit testing
const endpointRadius = 5; // for hit testing

class Item {
    constructor(id, type, title = 'Untitled', body = '') {
        /** @type {id} */
        this.id = id;
        /** @type {'material' | 'light'} */
        this.type = type;
        this.title = title;
        this.body = body;
    }
    toObject() {
        return { ...this };
    }
    static fromObject(obj) {
        return new Item(obj.id, obj.type, obj.title, obj.body);
    }
}

class Relations {
    constructor() {
        /** @type {Map<id, Map<id, id | null>>} lightId => materialId => attachedId */
        this._rel = new Map();
    }
    addTriplet(start, mid, end) {
        if (!this._rel.has(start)) {
            this._rel.set(start, new Map());
        }
        // currently end is unique for each (start, mid)
        this._rel.get(start).set(mid, end);
    }
    removeTriplet(start, mid, end) {
        if (this._rel.has(start) && this._rel.get(start).get(mid) === end) {
            this._rel.get(start).set(mid, null);
            // currently end is unique, so just set to null
        } else { // raise error
            throw new Error(`Triplet (${start}, ${mid}, ${end}) does not exist.`);
        }
    }
    unlink(start, mid) { // remove triplets of form (start, mid, *)
        if (this._rel.has(start)) {
            this._rel.get(start).delete(mid);
        }
    }
    unlinkAll(id) { // remove as source / mid / end 
        this._rel.delete(id); // remove as source
        for (const mid2end of this._rel.values()) {
            mid2end.delete(id); // remove as mid
            for (const [mid, end] of mid2end.entries()) {
                if (end === id) {
                    mid2end.set(mid, null); // remove as end
                    // the mapping remains, but end is set to null
                }
            }
        }
    }
    toObject() {
        const array = [];
        for (const [lightId, materialMap] of this._rel.entries()) {
            for (const [materialId, attachedId] of materialMap.entries()) {
                array.push({ lightId, materialId, attachedId });
            }
        }
        return array;
    }
    static fromObject(obj) {
        const proj = new Relations();
        obj.forEach(entry => {
            proj.addTriplet(entry.lightId, entry.materialId, entry.attachedId);
        });
        return proj;
    }
}

// Future: AxisItem 

class World {
    constructor() {
        /** @type {Map<id, Item>} */
        this.items = new Map();
        this.projections = new Relations();
        // this.axes = new Map(); // id => AxisItem (future)
    }
    toObject() {
        return {
            items: Array.from(this.items.values()).map(item => item.toObject()),
            projections: this.projections.toObject(),
        };
    }
    static fromObject(obj) {
        const world = new World();
        obj.items.forEach(item => {
            world.items.set(item.id, Item.fromObject(item));
        });
        world.projections = Relations.fromObject(obj.projections);
        return world;
    }
    newItem(type) {
        let id = utils.randId();
        while (this.has(id)) { id = utils.randId(); }
        return new Item(id, type);
    }
    has(id) { return this.items.has(id); }
    get(id) { return this.items.get(id); }
    add(item) { this.items.set(item.id, item); }
    delete(id) {
        const exist = this.has(id);

        if (exist) {
            this.items.delete(id); // remove item from world
            this.projections.unlinkAll(id); // remove projections related to this item
        }
        return exist;
    }
    addProjection(lightId, materialId) {  // pair light and material, since it's a new projection, attachedId is null
        this.projections.addTriplet(lightId, materialId, null);
    }
    removeProjection(lightId, materialId) {  // unpair light and material
        this.projections.unlink(lightId, materialId);
    }
    getAttachment(lightId, materialId) {  // assume lightId and materialId exist, otherwise return undefined
        if (!this.projections._rel.has(lightId)) return undefined;
        if (!this.projections._rel.get(lightId).has(materialId)) return undefined;
        return this.projections._rel.get(lightId).get(materialId); // return attachedId or null
    }
    addAttachment(lightId, materialId, attachedId) { // link material to shadow (projection)
        this.projections.addTriplet(lightId, materialId, attachedId); // #
    }
    removeAttachment(lightId, materialId, attachedId) { // unlink material from shadow (projection), 
        this.projections.removeTriplet(lightId, materialId, attachedId);
    }
    searchTitle(query) { // return list of items that match the query in title
        const results = [];
        for (const item of this.items.values()) {
            if (item.title.includes(query)) {
                results.push(item);
            }
        }
        return results;
    }
}


// world is too big, we can not focus on all of them, we can keep some of them in our attention.

class Workspace { // describe status of workspace data, actions in workspace should not affect world data
    constructor() {
        /** @type {Map<id, 'On'|'Off'>} status of lights in attention */
        this.lights = new Map();
        /** @type {Set<id>} ids of items (lights & materials) in attention */
        this.items = new Set();
        /** @type {Map<id, {x: number, y: number, color: string}>} */
        this._nodes = new Map(); // id => {x, y, color}, style info for items in attention
        /** @type {Map<id, Map<id, {x: number, y: number}>>} */
        this._endpoint = new Map(); // id => {x, y}, layout info for items in attention (future)   
    }
    toObject() {
        return {
            lights: Array.from(this.lights.entries()).map(([id, status]) => ({ id, status })),
            items: Array.from(this.items),
            // nodes: 
        };
    }
    static fromObject(obj) {
        const ws = new Workspace();
        for (const it of obj.lights) {
            ws.lights.set(it.id, it.status);
        }
        for (const id of obj.items) {
            ws.items.add(id);
        }
        // TODO: nodes: 
        return ws;
    }
    initializeNodes(world) { // random position
        // Remove items not in world
        const itemsToDelete = [];
        for (const id of this.items) {
            if (!world.has(id)) itemsToDelete.push(id);
        }
        for (const id of itemsToDelete) {
            this.delete(id, world);
        }
        this._updateNodes(world);
    }
    colour(id) {
        if (this.items.has(id)) {
            return this.lights.has(id) ? '#ffff00' : '#ffffff';
        }
        return '#888888';
    }
    _updateNodes(world) {
        // set default color and random position for missing items ONLY
        for (const id of this.items) {
            if (this._nodes.has(id)) continue;
            this._nodes.set(id, {
                x: Math.random() * 800 - 400,
                y: Math.random() * 600 - 300,
                color: this.colour(id)
            });
        }
        // now, _nodes contains all items in this.items

        // gather visibleOnly items, a disjoint set from this.items
        const visibleOnly = new Set();
        for (const [, , id] of this.projections(world)) {
            if (!this.items.has(id)) visibleOnly.add(id);
        }
        // remove invisible nodes
        for (const id of this._nodes.keys()) {
            if (!this.items.has(id) && !visibleOnly.has(id)) {
                this._nodes.delete(id);
            }
        }
        // add unsetted visibleOnly nodes
        for (const id of visibleOnly) {
            if (!this._nodes.has(id)) {
                this._nodes.set(id, {
                    x: Math.random() * 800 - 400,
                    y: Math.random() * 600 - 300,
                    color: this.colour(id),
                });
            }
        }
    }
    /** @type {(id: id, world: World) => void} */
    add(item, world) {
        const id = item.id;
        if (this.items.has(id)) return; // already in attention
        world.add(item); // add to world first
        if (item.type === 'light') {
            this.lights.set(id, 'Off'); // default light status is Off
        }
        this.items.add(id);
        this._updateNodes(world);
    }
    /** @type {(id: id, world: World) => void} */
    delete(id, world) {
        world.delete(id); // remove from world first
        this.hide(id, world);
    }
    hide(id, world) { // remove from attention, but keep in world
        this.lights.delete(id);
        this.items.delete(id);
        this._updateNodes(world);
    }
    getNode(id) { return this._nodes.get(id); }
    getIdAtPosition(x, y) {
        for (const [id, info] of this._nodes.entries()) {
            const dx = info.x - x;
            const dy = info.y - y;
            if (dx * dx + dy * dy <= nodeRadius * nodeRadius) {
                return id;
            }
        }
        return null;
    }
    setStyle(id, x, y, colour = null) {
        if (this._nodes.has(id)) {
            this._nodes.set(id, { x, y, color: colour || this.colour(id) });
        }
    }
    *nodes(world) {
        for (const [id, info] of this._nodes.entries()) {
            yield {
                id: id,
                type: world.get(id).type,
                title: world.get(id).title,
                x: info.x,
                y: info.y,
                color: info.color.slice(0, 7) + (this.items.has(id) ? 'ff' : '88'),
            };
        }
    }
    /** @type {(world: World) => Iterable<[id, id, id | null]>} */
    *projections(world) {
        for (const [start, status] of this.lights.entries()) {
            if (status !== 'On') { continue }
            for (const mid of this.items) {
                const end = world.getAttachment(start, mid);
                if (end !== undefined) {
                    yield [start, mid, end];
                }
            }
        }
    }
    getBoundingRect() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (this._nodes.size === 0) {
            minX = -100; minY = -100; maxX = 100; maxY = 100;
        }
        for (const info of this._nodes.values()) {
            minX = Math.min(minX, info.x);
            minY = Math.min(minY, info.y);
            maxX = Math.max(maxX, info.x);
            maxY = Math.max(maxY, info.y);
        }
        return {
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY,
        }
    }
    _updateEndpoints(world) {
        this._endpoint.clear();
        for (const [start, mid, end] of this.projections(world)) {
            const startNode = this.getNode(start);
            const midNode = this.getNode(mid);
            if (!startNode || !midNode) { continue; } // for type hint

            const endNode = this.getNode(end) ?? utils.vecAntipode(midNode, startNode);

            const endToMid = utils.vecSub(midNode, endNode);
            const endpoint = utils.vecAdd(
                endNode, 
                utils.vecNormalize(endToMid, nodeRadius + 2 * endpointRadius)
            );
            if (!this._endpoint.has(start)) {
                this._endpoint.set(start, new Map());
            }
            this._endpoint.get(start).set(mid, endpoint);
        }
    }
    *curves(world) {
        this._updateEndpoints(world);

        for (const [start, mid, ] of this.projections(world)) {
            const startNode = this.getNode(start);
            const midNode = this.getNode(mid);
            const endpoint = this._endpoint.get(start).get(mid);

            yield {
                start: { x: startNode.x, y: startNode.y },
                mid: { x: midNode.x, y: midNode.y },
                end: endpoint,
                color: startNode.color,
            }
        }
    }



}


// (future) sequence of manipulations in workspace forms a story, you can tell

// class Story {
//     constructor() {
//         /** @type {Array<{timestamp: number, workspace: Workspace}>} */
//         this.frames = [];
//         this.audioPath = null;
//         this.subtitle = null;
//     }
// }

// Every action in world and workspace should be invertible (for undo/redo)

// Export classes for ES6 modules
export { World, Workspace };