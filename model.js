/**
 * @typedef {string} id
 */

// Utility function to generate random ID
function randId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

class Item {
    constructor(id, type, title = 'Untitled', body = '') { // new item (page)
        /** @type {id} */
        this.id = id;
        this.type = type; // 'material' or 'light'
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
        this._rel = new Map(); // nested map, lightId => materialId => Optional[attachedId]
    }
    addTriplet(srcId, midId, endId = null) { // currently work as set
        if (!this._rel.has(srcId)) {
            this._rel.set(srcId, new Map());
        }
        this._rel.
        this._rel.get(srcId).set(midId, endId);
    }
    removeTriplet(srcId, midId) {
        if (this._rel.has(srcId)) {
            this._rel.get(srcId).delete(midId);
        }
    }
    removeSource(id) {
        return this._rel.delete(id);
    }
    removeMediate(id) {
        for (const materialMap of this._rel.values()) {
            materialMap.delete(id);
            for (const [matId, attachedId] of materialMap.entries()) {
                if (attachedId === id) {
                    materialMap.set(matId, null);
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
    static fromObject(json) {
        const proj = new Relations();
        for (const entry of json) {
            proj.addTriplet(entry.lightId, entry.materialId, entry.attachedId);
        }
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
        const items = [];
        for (const item of this.items.values()) {
            items.push(item.toObject());
        }

        return {
            items: items,
            projections: this.projections.toObject(),
        };
    }
    static fromObject(json) {
        const world = new World();
        for (const itemJson of json.items) {
            const item = Item.fromObject(itemJson);
            world.items.set(item.id, item);
        }
        world.projections = Relations.fromObject(json.projections);
        return world;
    }
    getItem(id) {
        return this.items.get(id);
    }
    addItem(type) {
        // make sure id is unique
        let id = randId();
        while (this.items.has(id)) { id = randId(); }
        const item = new Item(id, type);
        this.items.set(id, item);
        return item;
    }
    removeItem(id) {
        const exist = this.items.has(id);

        if (exist) {
            this.items.delete(id); // remove item from world
            this.projections.removeSource(id); // remove it as a light source
            this.projections.removeMediate(id); // remove it as a material target
        }
        return exist;
    }
    getProjection(lightId, materialId) {  // assume lightId and materialId exist, otherwise return undefined
        if (!this.projections._rel.has(lightId)) return undefined;
        if (!this.projections._rel.get(lightId).has(materialId)) return undefined;
        return this.projections._rel.get(lightId).get(materialId); // return attachedId or null
    }
    addProjection(lightId, materialId) {  // pair light and material, since it's a new projection, attachedId is null
        this.projections.addTriplet(lightId, materialId, null);
    }
    removeProjection(lightId, materialId) {  // unpair light and material
        this.projections.removeTriplet(lightId, materialId);
    }
    addConnection(lightId, materialId, attachedId) { // link material to shadow (projection)
        this.projections.addTriplet(lightId, materialId, attachedId); // #
    }
    removeConnection(lightId, materialId, attachedId) { // unlink material from shadow (projection), 
        this.projections.addTriplet(lightId, materialId, null);  // #
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
        this.dataPath = null;
        /** @type {Map<id, 'On'|'Off'>} */
        this.lights = new Map(); // id => 'On'|'Off'
        /** @type {Set<id>} */
        this.items = new Set(); // ids of items in attention
        // this.visibleOnlyItems = new Set();
    }
    static fromObject(obj) { // triggered: load workspace
        const ws = new Workspace();
        ws.dataPath = obj.dataPath;
        for (const it of obj.lights) {
            ws.lights.set(it.id, it.status);
        }
        for (const id of obj.items) {
            ws.items.add(id);
        }
        return ws;
    }
    toObject() {
        return {
            dataPath: this.dataPath,
            lights: Array.from(this.lights.entries()).map(([id, status]) => ({ id, status })),
            items: Array.from(this.items),
        };
    }
    /** @type {(world: World) => Set<string>} */
    getVisibleItems(world) { // triggered: get all items in attention + visibleOnly
        /** @type {Set<id>} */
        const res = new Set();
        for (const [lightId, status] of this.lights.entries()) {
            res.add(lightId);
            if (status === 'On') {
                for (const materialId of this.items) {
                    const attachedId = world.getProjection(lightId, materialId);
                    if (attachedId !== undefined && attachedId !== null) {
                        res.add(attachedId);
                    }
                }
            }
        }
        return res;
    }
    /** @type {(world: World) => Array<{from: id, through: id, to: [id]}>} */
    getProjections(world) {
        const res = [];
        for (const [from, status] of this.lights.entries()) {
            if (status !== 'On') { continue }
            for (const through of this.items) {
                const to = world.getProjection(from, through);
                if (to !== undefined) {
                    res.push({ from, through, to });
                }
            }
        }
        return res;
    }
    add(id, type) {
        if (type === 'light') {
            this.lights.set(id, 'Off'); // default light status is Off
        }
        this.items.add(id);
    }
    delete(id) {
        this.lights.delete(id);
        this.items.delete(id);
    }
}


// (future) sequence of manipulations in workspace forms a story, you can tell
// const storyLines = {

// }


// Every action in world and workspace should be invertible (for undo/redo)

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { World, Workspace };
}