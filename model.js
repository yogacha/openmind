// @ts-check
/**
 * @typedef {string} id
 * @typedef {'material' | 'light'} ItemType
 * @typedef {{id: id, type: ItemType, title: string, body: string, icon?: string}} ItemData
 * @typedef {{startId: id, midId: id, endId: id | null}} ProjectionData
 * @typedef {{axisId: id, itemId: id, value: number}} MeasurementData
 * @typedef {string} color string in hex format of length 6
 * @typedef {{x: number, y: number}} coord
 * @typedef {any} SuperGifCanvas
*/

import utils, { Vec } from './utils.js';

const nodeRadius = 30; // for hit testing
const endpointRadius = 7; // for hit testing

class Item {
    /**
     * Constructs a new model instance.
     * @constructor
     * @param {string} id - Unique identifier for the model.
     * @param {ItemType} type - The type/category of the model.
     * @param {string} [title='Untitled'] - The title of the model (defaults to 'Untitled').
     * @param {string} [body=''] - The body/content of the model (defaults to an empty string).
     */
    constructor(id, type, title = '', body = '', icon = '') {
        this.id = id;
        this.type = type;
        this.title = title;
        this.body = body;
        /** @type {string} base64 */
        this.icon = icon;
    }
    toObject() {
        return { ...this };
    }
    /** @type {(obj: ItemData) => Item} */
    static fromObject(obj) {
        return new Item(obj.id, obj.type, obj.title, obj.body, obj.icon ?? '');
    }
}
/** @extends {Map<id, Map<id, id | null>>} startId => midId => endId, i.e. light => item => item | null) */
class Relations extends Map {
    constructor() {
        super();
    }
    /** @type {(proj: ProjectionData) => void} */
    addTriplet(proj) {
        let innerMap = this.get(proj.startId);
        if (!innerMap) {
            innerMap = new Map();
            this.set(proj.startId, innerMap);
        }
        // currently end is unique for each (start, mid)
        innerMap.set(proj.midId, proj.endId);
    }
    /** @type {(proj: ProjectionData) => boolean} delete triplet, return true if existed */
    deleteTriplet(proj) {
        const innerMap = this.get(proj.startId);
        if (innerMap?.get(proj.midId) === proj.endId) {
            innerMap.set(proj.midId, null);
            // currently end is unique, so just set to null, (future: ?)
            return true;
        } else {
            return false;
        }
    }
    /** @type {(arg0: id, arg1: id) => boolean} remove triplets of form (start, mid, *) */
    unlink(startId, midId) {
        return this.get(startId)?.delete(midId) ?? false;
    }
    /** @type {(id: id) => void} remove id as light / material / end */
    unlinkAll(id) {
        this.delete(id); // remove as light
        for (const mid2end of this.values()) {
            mid2end.delete(id); // remove as material
            for (const [midId, endId] of mid2end.entries()) {
                if (endId === id) {
                    mid2end.set(midId, null); // remove as end
                    // the mapping remains, but end is set to null
                }
            }
        }
    }
    /** @type {() => ProjectionData[]} */
    toObject() {
        const array = [];
        for (const [startId, mid2end] of this.entries()) {
            for (const [midId, endId] of mid2end.entries()) {
                array.push({ startId, midId, endId });
            }
        }
        return array;
    }
    /** @type {(obj: ProjectionData[]) => Relations} */
    static fromObject(obj) {
        const proj = new Relations();
        obj.forEach(entry => {
            proj.addTriplet(entry);
        });
        return proj;
    }
}

/** @extends {Map<id, Map<id, number>>} axisId => itemId => number */
class Measurements extends Map {
    constructor() {
        super();
    }
    /** @type {(measurement: MeasurementData) => void} set item value on axis */
    setValue(measurement) {
        let innerMap = this.get(measurement.axisId);
        if (!innerMap) {
            innerMap = new Map();
            this.set(measurement.axisId, innerMap);
        }
        innerMap.set(measurement.itemId, measurement.value);
    }
    /** @type {(axisId: id, itemId: id) => number | undefined} get item value on axis */
    getValue(axisId, itemId) {
        return this.get(axisId)?.get(itemId);
    }
    /** @type {(axisId: id, itemId: id) => boolean} delete measurement, return true if existed */
    unlink(axisId, itemId) {
        return this.get(axisId)?.delete(itemId) ?? false;
    }
    /** @type {(id: id) => void} remove all measurements related id */
    unlinkAll(id) {
        this.delete(id); // remove as axis
        for (const item2value of this.values()) {
            item2value.delete(id); // remove as item
        }
    }
    /** @type {() => MeasurementData[]} */
    toObject() {
        const array = [];
        for (const [axisId, item2value] of this.entries()) {
            for (const [itemId, value] of item2value.entries()) {
                array.push({ axisId, itemId, value });
            }
        }
        return array;
    }
    /** @type {(obj: MeasurementData[]) => Measurements} */
    static fromObject(obj) {
        const axes = new Measurements();
        obj.forEach(entry => {
            axes.setValue(entry);
        });
        return axes;
    }
}

class World {
    constructor() {
        /** @type {Map<id, Item>} */
        this.items = new Map();
        this.projections = new Relations();
        this.axes = new Measurements();
    }
    toObject() {
        return {
            items: Array.from(this.items.values()).map(item => item.toObject()),
            projections: this.projections.toObject(),
            axes: this.axes.toObject(),
        };
    }
    /** @type {(obj: {items: ItemData[], projections: ProjectionData[], axes: MeasurementData[]}) => World} */
    static fromObject(obj) {
        const world = new World();
        obj.items.forEach(item => {
            world.items.set(item.id, Item.fromObject(item));
        });
        world.projections = Relations.fromObject(obj.projections);
        world.axes = Measurements.fromObject(obj.axes);
        return world;
    }
    /** @type {(type: ItemType) => Item} */
    newItem(type) {
        let id = utils.randId();
        while (this.has(id)) { id = utils.randId(); }
        return new Item(id, type);
    }
    /** @type {(id: id) => boolean} */
    has(id) { return this.items.has(id); }
    /** @type {(id: id) => Item | undefined} */
    get(id) { return this.items.get(id); }
    /** @type {(item: Item) => void} */
    add(item) { this.items.set(item.id, item); }
    /** @type {(id: id) => boolean} */
    delete(id) {
        const exist = this.has(id);

        if (exist) {
            this.items.delete(id); // remove item from world
            this.projections.unlinkAll(id); // remove projections related to this item
            this.axes.unlinkAll(id); // remove measurements related to this axis
        }
        return exist;
    }
    /** @type {(lightId: id, materialId: id) => void} */
    addProjection(lightId, materialId) {  // pair light and material, since it's a new projection, attachedId is null
        this.projections.addTriplet({ startId: lightId, midId: materialId, endId: null });
    }
    /** @type {(lightId: id, materialId: id) => void} */
    removeProjection(lightId, materialId) {  // unpair light and material
        this.projections.unlink(lightId, materialId);
    }
    /** return attachedId for given lightId and materialId, undefined if not exist
     * @param {id} lightId
     * @param {id} materialId 
     * @returns {id | null | undefined}} */
    getAttachment(lightId, materialId) {
        return this.projections.get(lightId)?.get(materialId);
    }
    /** @type {(lightId: id, materialId: id, attachedId: id | null) => void} */
    addAttachment(lightId, materialId, attachedId) { // link material to shadow (projection)
        this.projections.addTriplet({ startId: lightId, midId: materialId, endId: attachedId });
    }
    /** @type {(lightId: id, materialId: id, attachedId: id | null) => void} */
    removeAttachment(lightId, materialId, attachedId) { // unlink material from shadow (projection), 
        this.projections.deleteTriplet({ startId: lightId, midId: materialId, endId: attachedId });
    }
    /** @type {(query: string, skipset: Set<id>) => Item[]} items that contains query in title (case-insensitive) */
    searchTitle(query, skipset) {
        if (query.length === 0) { return []; }
        const lowerQuery = query.toLowerCase();
        return Array.from(this.items.values()).filter(item =>
            !skipset.has(item.id) && item.title.toLowerCase().includes(lowerQuery)
        );
    }
}


// world is too big, we can not focus on all of them, we can keep some of them in our attention.

class Workspace { // describe status of workspace data, actions in workspace should not affect world data
    constructor() {
        /** @type {Map<id, 'On'|'Off'>} status of lights in attention */
        this.lights = new Map();
        /** @type {Set<id>} ids of items (lights & materials) in attention */
        this.items = new Set();
        /** @type {Map<id, {x: number, y: number, color: string}>} style info for items in attention */
        this._nodes = new Map();
        /** @type {Map<id, coord>} drag points for attachment endpoints */
        this._endpoints = new Map();
        /** @type {Map<id, HTMLImageElement | SuperGifCanvas>} */
        this._icons = new Map();
        /** @type {{id: id, start: coord} | null} selected x-axis id */
        this.xaxis = null;
        /** @type {{id: id, start: coord} | null} selected y-axis id */
        this.yaxis = null;
    }
    toObject() {
        return {
            lights: Array.from(this.lights.entries()).map(([id, status]) => ({ id, status })),
            items: Array.from(this.items),
            styles: Array.from(this._nodes.entries()).map(([id, style]) => ({ id, ...style })),
        };
    }
    /** @type {(obj: {lights: {id: id, status: 'On'|'Off'}[], items: id[], styles: {id: id, x: number, y: number, color: string}[]}) => Workspace} */
    static fromObject(obj) {
        const ws = new Workspace();
        for (const it of obj.lights) {
            ws.lights.set(it.id, it.status);
        }
        for (const id of obj.items) {
            ws.items.add(id);
        }
        for (const {id, x, y, color} of (obj.styles ?? [])) {
            ws._nodes.set(id, {x, y, color});
        }
        return ws;
    }
    /** @type {(world: World) => void} */
    initializeNodes(world) { // random position
        // Remove items not in world
        const itemsToDelete = Array.from(this.items).filter(id => !world.has(id));
        for (const id of itemsToDelete) {
            this.delete(id, world);
            console.warn(`Item ${id} in workspace but not in world - removing from workspace`);
        }
        this._updateNodes(world);
    }
    /** @type {(id: id) => color} */
    colour(id) { // default colour for light/material/visibleOnly nodes
        if (this.items.has(id)) {
            return this.lights.has(id) ? utils.randomColor() : '#ffffff';
        }
        return '#ffffff';
    }
    /** @type {(item: Item, world: World) => void} */
    add(item, world) {
        const id = item.id;
        if (this.items.has(id)) { // already in attention
            this._updateNodes(world);
            return;
        }
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
        if (this.xaxis?.id === id) this.xaxis = null;
        if (this.yaxis?.id === id) this.yaxis = null;
    }
    /** @type {(id: id, world: World) => void} */
    hide(id, world) { // remove from attention, but keep in world
        this.lights.delete(id);
        this.items.delete(id);
        this._updateNodes(world);
    }
    /** @type {(id: id) => boolean} */
    hasNode(id) { return this._nodes.has(id); }
    /** @type {(coord: coord, delta?: number) => id | null} */
    getNodeAtPosition(coord, delta = nodeRadius) {
        for (const [id, pos] of this._nodes.entries()) {
            if (Vec.dist(pos, coord) <= delta) {
                return id;
            }
        }
        return null;
    }
    /** @type {(coord: coord, delta?: number) => id | null} */
    getEndpointAtPosition(coord, delta = endpointRadius + 2) {
        for (const [index, pos] of this._endpoints.entries()) {
            if (Vec.dist(pos, coord) <= delta) {
                return index;
            }
        }
        return null;
    }
    /** @type {(id: id, status: 'On'|'Off', world: World) => void} */
    setLight(id, status, world) {
        if (!this.lights.has(id)) { return; }
        this.lights.set(id, status);
        this._updateNodes(world);
    }
    /** @type {(id: id, x?: number | null, y?: number | null, color?: color | null) => void} */
    setStyle(id, x = null, y = null, color = null) {
        const style = this._nodes.get(id);
        if (x !== null && y !== null && style) { // move axis start point accordingly
            const delta = Vec.sub({x, y}, style);
            if (this.xaxis?.id == id) {
                this.xaxis.start.y = this.xaxis.start.y + delta.y;
            } else if (this.yaxis?.id == id) {
                this.yaxis.start.x = this.yaxis.start.x + delta.x;
            }
        }
        if (style) {
            this._nodes.set(id, {
                x: x ?? style.x, y: y ?? style.y, color: color ?? style.color,
            });
        }
    }
    /** @type {(world: World) => Iterable<{id: id, type: ItemType, title: string, x: number, y: number, color: string, icon: any | null}>} */
    *nodes(world) {
        // this._updateNodes(world); // unneeded since we update on every add/delete/hide
        for (const [id, info] of this._nodes.entries()) {
            const item = world.get(id);
            if (!item) {
                console.warn(`Node ${id} exists in _nodes but not in world - skipping`);
                continue;
            }
            yield {
                id: id,
                type: item.type,
                title: item.title,
                x: info.x,
                y: info.y,
                color: info.color.slice(0, 7) + (this.items.has(id) ? 'ff' : '88'),
                icon: this._icons.get(id) ?? null,
            };
        }
    }
    /** @type {(world: World) => Iterable<[id, id, id | null]>} */
    *projections(world) {
        for (const [start, status] of this.lights.entries()) {
            if (status !== 'On') { continue }
            for (const id of this.items) {
                // yield (start, id. *)
                const end = world.getAttachment(start, id);
                if (end !== undefined) {
                    yield [start, id, end];
                }
                // yield (start, *, id)
                const mid2end = world.projections.get(start);
                if (mid2end) {
                    for (const [mid, endId] of mid2end.entries()) {
                        if (endId === id) {
                            yield [start, mid, id];
                        }
                    }
                }
            }
        }
    }
    /** @type {(world: World) => Iterable<{index: string, start: coord, mid: coord, end: coord, color: string}>} */
    *curves(world) {
        this._updateEndpoints(world);

        for (const [start, mid,] of this.projections(world)) {
            const index = `${start}-${mid}`;
            const startNode = this._nodes.get(start);
            const midNode = this._nodes.get(mid);
            const endpoint = this._endpoints.get(index);

            if (!startNode || !midNode) continue; // skip if nodes missing, inpossible case, just for type safety

            // Check if endpoint exists to prevent undefined errors
            if (!endpoint) {
                console.warn(`Endpoint not found for curve ${index}`);
                continue;
            }

            yield {
                index,
                start: { x: startNode.x, y: startNode.y },
                mid: { x: midNode.x, y: midNode.y },
                end: endpoint,
                color: startNode.color,
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
    /** @type {(item: Item) => void} */
    _load_icon(item) {
        if (item.icon.startsWith('data:image/gif;') || item.icon.endsWith('.gif')) {
            this._icons.set(item.id, utils.createSuperGifPlayer(item.icon) );
        } else {
            const iconImg = new Image();
            iconImg.src = item.icon;
            this._icons.set(item.id, iconImg);
        }
    }
    // private methods
    /** @type {(world: World) => void} */
    _updateNodes(world) {
        // set default color and random position for missing items ONLY
        for (const id of this.items) {
            const item = world.get(id);
            if (!item) {
                continue;
            }
            
            // Create node if it doesn't exist
            if (!this._nodes.has(id)) {
                if (this.lights.has(id)) { // randomize at outer margin
                    this._nodes.set(id, {
                        x: utils.randUniform(400, 500) * (Math.random() > 0.5 ? 1 : -1),
                        y: utils.randUniform(-400, 400),
                        color: this.colour(id)
                    });
                } else { // randomize at center area
                    console.info('Adding node for item', item.title);
                    this._nodes.set(id, {
                        x: utils.randUniform(-400, 400),
                        y: utils.randUniform(-400, 400),
                        color: this.colour(id)
                    });
                }
            }
            
            // load icon if item has icon and icon not loaded yet
            if (item.icon && !this._icons.has(id) ) {
                this._load_icon(item);
            }
        }
        // now, _nodes contains all items in this.items

        // gather visibleOnly items, a disjoint set from this.items
        const visibleOnly = new Map();
        
        for (const [start, mid, end] of this.projections(world)) {
            // visible-only endpoints
            if (end && !this.items.has(end) && !visibleOnly.has(end)) {
                visibleOnly.set(end,
                    Vec.antipode(this._nodes.get(mid), this._nodes.get(start))
                );
            }
            // visible-only midpoints
            if (end && !this.items.has(mid) && !visibleOnly.has(mid)) {
                visibleOnly.set(mid,
                    Vec.midpoint(this._nodes.get(start), this._nodes.get(end))
                );
            }
        }
        // remove invisible nodes
        for (const id of this._nodes.keys()) {
            if (!this.items.has(id) && !visibleOnly.has(id)) {
                this._nodes.delete(id);
            }
        }
        // add unsetted visibleOnly nodes
        for (const [id, pos] of visibleOnly.entries()) {
            // Only add visible-only nodes that actually exist in the world
            const item = world.get(id);
            if (!this._nodes.has(id) && id !== null && item) {
                this._nodes.set(id, {
                    x: pos.x, y: pos.y,
                    color: this.colour(id)
                });
                // load icon if item has icon and icon not loaded yet
                if (item.icon && !this._icons.has(id)) {
                    this._load_icon(item);
                }
            }
        }
    }
    /** @type {(world: World) => void} */
    _updateEndpoints(world) {
        this._endpoints.clear();
        for (const [start, mid, end] of this.projections(world)) {
            const startNode = this._nodes.get(start);
            const midNode = this._nodes.get(mid);

            // Ensure nodes exist
            if (!startNode || !midNode) {
                console.warn(`Missing nodes for projection ${start}-${mid}: startNode=${!!startNode}, midNode=${!!midNode}`);
                continue;
            }

            let endpoint;
            let direction;
            if (end && this._nodes.has(end)) {
                const endNode = this._nodes.get(end);
                direction = Vec.sub(midNode, endNode);
                endpoint = Vec.add(
                    endNode, Vec.normalize(direction, nodeRadius + 2 * endpointRadius)
                );
            } else {
                // Calculate antipode when no attachment or attachment node not visible
                direction = Vec.sub(midNode, startNode);
                endpoint = Vec.add(
                    midNode, Vec.normalize(direction, 4 * nodeRadius)
                );
            }
            this._endpoints.set(`${start}-${mid}`, endpoint);
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