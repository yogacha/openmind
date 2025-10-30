/**
 * @typedef {string} id
 */

import { randId } from './utils.js';

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
        // this._nodes
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
    // TODO: sync(world) {
    // sync workspace with world, 
    // 1. remove items not in world
    // 2. calculate layout for items in attention (this._nodes)
    // 2.1 if layout exists, keep it
    // 2.2 if not, set random x,y & default color
    // }
    // TODO: add(id, world)
    add(id, type) {
        if (this.items.has(id)) {
            return; // already in attention
        }
        if (type === 'light') {
            this.lights.set(id, 'Off'); // default light status is Off
        }
        this.items.add(id);
    }
    // TODO: delete(id, world)
    delete(id) {
        this.lights.delete(id);
        this.items.delete(id);
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