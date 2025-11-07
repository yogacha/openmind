import { CanvasEditor } from "./ui.js";
import { World, Workspace } from "./model.js";
import utils, { Vec } from "./utils.js";



// implement CanvasEditor.handleCanvasMouseDown


export class App extends CanvasEditor {
    handleCanvasMouseDown(event) {
        if (event.button !== 0) return; // Only handle left mouse button
        // update mouse position & selected id
        this.state.interaction.mouse = this._mouse(event);
        const coord = this._canvas2coord(this.state.interaction.mouse);
        this.state.interaction.selectedId = this.workspace.getNodeAtPosition(coord);
        console.log(`select(${this.state.interaction.selectedId})`);

        switch (this.currentMode()) {
            case 'link-light': // selectedEndpoint is setted
                if (this.state.interaction.selectedId) {
                    this.world.addProjection(this.state.interaction.selectedEndpoint,
                        this.state.interaction.selectedId);
                    console.log(`addProjection(${this.state.interaction.selectedEndpoint}, ${this.state.interaction.selectedId})`);
                }
                this.state.interaction.selectedEndpoint = null;
                break;
            case 'link-axis':
                if (this.state.interaction.selectedId && this.state.interaction.anchorId !== this.state.interaction.selectedId) {
                    const value = this.state.interaction.anchorId === this.workspace.xaxis?.id ? coord.x : coord.y;
                    this.world.axes.setValue({
                        axisId: this.state.interaction.anchorId,
                        itemId: this.state.interaction.selectedId,
                        value: value, // TODO: determine value based on range
                    });
                    console.log(`setValue(${this.state.interaction.anchorId}, ${this.state.interaction.selectedId}, ${value})`);
                }
                this.state.interaction.anchorId = null;
                break;
            case 'idle':
                this.state.interaction.selectedEndpoint = this.workspace.getEndpointAtPosition(coord);

                if (this.state.interaction.selectedId) {
                    console.log('Started dragging item:', this.state.interaction.selectedId);
                } else if (this.state.interaction.selectedEndpoint) {
                    console.log('Started dragging endpoint:', this.state.interaction.selectedEndpoint);
                } else {
                    console.log('Started panning the canvas');
                }
                break;
        }
        // Store drag start position
        this.state.interaction.mouseDown = true;
        this.state.interaction.dragStart = { ...this.state.interaction.mouse };
        this.state.interaction.lastCamera = { ...this.state.camera };
    }

    handleCanvasMouseMove(event) {
        this.state.interaction.mouse = this._mouse(event);
        const coord = this._canvas2coord(this.state.interaction.mouse);

        switch (this.currentMode()) {
            case 'attach':
            case 'link-light':
            case 'link-axis':
                // Update cursor for endpoint dragging
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'pan':
                // Update cursor
                this.canvas.style.cursor = 'grabbing';

                // Update camera position based on mouse movement
                const delta = Vec.scale(
                    Vec.sub(this.state.interaction.mouse, this.state.interaction.dragStart),
                    1 / this.state.camera.zoom);

                this.setCamera(
                    this.state.interaction.lastCamera.centerX - delta.x,
                    this.state.interaction.lastCamera.centerY - delta.y,
                    null
                );
                break;
            case 'select': // dragging a node/item
                // Update cursor
                this.canvas.style.cursor = 'move';

                if (this.workspace.xaxis 
                    && this.world.axes.getValue(this.workspace.xaxis.id, this.state.interaction.selectedId) !== undefined) {
                    coord.x = null; // lock x
                }
                if (this.workspace.yaxis
                    && this.world.axes.getValue(this.workspace.yaxis.id, this.state.interaction.selectedId) !== undefined) {
                    coord.y = null; // lock y
                }

                this.workspace.setStyle(this.state.interaction.selectedId, coord.x, coord.y);
                break;
        }
    }

    handleCanvasMouseUp(event) {
        // update mouse position & selected id
        this.state.interaction.mouse = this._mouse(event);
        const coord = this._canvas2coord(this.state.interaction.mouse);
        this.state.interaction.selectedId = this.workspace.getNodeAtPosition(coord);
        console.log(`select(${this.state.interaction.selectedId})`);

        switch (this.currentMode()) {
            case 'attach':
                const [startId, midId] = this.state.interaction.selectedEndpoint.split('-');
                if (this.state.interaction.selectedId) {
                    this.addAttachment(startId, midId, this.state.interaction.selectedId);
                } else {
                    // remove attachment
                    this.world.addAttachment(startId, midId, null);
                    console.log('Cleared attachment for endpoint:', this.state.interaction.selectedEndpoint);
                }
                this.state.interaction.selectedEndpoint = null;
                break;
            case 'pan':
                console.log(`setCamera(${this.state.camera.centerX}, ${this.state.camera.centerY})`);
                break;
            case 'select':
                console.log(`moveItem(${this.state.interaction.selectedId}, ${coord.x}, ${coord.y})`);
                // this.state.interaction.selectedId = null;
                break;
        }

        this.state.interaction.mouseDown = false;
        // Change cursor back
        this.canvas.style.cursor = 'grab';

        // Re-render to show endpoint back in original position
    }

    handleCanvasDoubleClick(event) {
        this.state.interaction.mouse = this._mouse(event);
        const coord = this._canvas2coord(this.state.interaction.mouse);
        this.state.interaction.selectedId = this.workspace.getNodeAtPosition(coord);
        this.state.interaction.selectedEndpoint = this.workspace.getEndpointAtPosition(coord);
        this.state.interaction.mouseDown = true; // as if mouse is down, reset after

        switch (this.currentMode()) {
            case 'attach':
                const [startId, midId] = this.state.interaction.selectedEndpoint.split('-');
                if (!this.world.getAttachment(startId, midId)) {
                    this.newItem('material');
                    const itemId = this.workspace.getNodeAtPosition(coord);
                    this.addAttachment(startId, midId, itemId);
                    console.log(`extend ${startId}->${midId} as ${itemId}`);
                    this.state.interaction.selectedEndpoint = null;
                }
                break;
            case 'select':
                if (this.workspace.items.has(this.state.interaction.selectedId)) {
                    this.showInlineTitleEditor();
                } else {
                    const item = this.world.get(this.state.interaction.selectedId);
                    this.workspace.add(item, this.world);
                    console.log(`setAttention(${this.state.interaction.selectedId})`);
                }
                break;
            case 'pan':
                // this.addItem('material');
                break;
        }
        this.state.interaction.mouseDown = false;
    }



    // ===========================================================================
    // Action METHODS
    // ===========================================================================
    newItem(type) {
        const item = this.world.newItem(type);
        const coord = this._canvas2coord(this.state.interaction.mouse);
        // add to attention
        this.workspace.add(item, this.world);
        this.workspace.setStyle(item.id, coord.x, coord.y);

        console.log(`addItem(${item.type}, ${coord.x}, ${coord.y})`);
    }
    deleteSelectedItem() {
        if (!this.state.interaction.selectedId) {
            console.log('No item selected for deletion');
            return;
        }

        const itemId = this.state.interaction.selectedId;
        const item = this.world.get(itemId);

        if (!item) {
            console.warn('Selected item not found in world:', itemId);
            return;
        }

        // Remove from workspace (this should handle nodes cleanup via _updateNodes)
        this.workspace.delete(itemId, this.world);

        // Clear selection
        this.state.interaction.selectedId = null;

        console.log('Deleted item:', itemId, 'Type:', item.type);
    }
    deleteProjection() {
        const [startId, midId] = this.state.interaction.selectedEndpoint.split('-');
        this.world.removeProjection(startId, midId);
        this.state.interaction.selectedEndpoint = null;
    }
    hideSelectedItem() {
        this.workspace.hide(this.state.interaction.selectedId, this.world);
    }
    editSelectedItem() {
        if (!this.state.interaction.selectedId) return;

        const selectedItem = this.world.get(this.state.interaction.selectedId);
        if (!selectedItem) {
            console.warn('Selected item not found in world:', this.state.interaction.selectedId);
            return;
        }

        // Add item to workspace when editing (if not already there)
        this.workspace.add(selectedItem, this.world);

        console.log('Item added to workspace:', selectedItem.id);

        // Show side panel
        this.showEditorPanel(selectedItem);
    }
    addAttachment(startId, midId, id) {
        const old = this.world.getAttachment(startId, midId);
        // (future) remove old attachment
        this.world.addAttachment(startId, midId, id); // add new attachment
        this.workspace.add(this.world.get(id), this.world); // ensure the target node is in the workspace
        console.log(`Changing attachment ${startId}->${midId}->${id} (before: ${old})`);
    }
    toggleLight() {
        const currentStatus = this.workspace.lights.get(this.state.interaction.selectedId);
        if (!currentStatus) {
            console.warn('Light not found for item:', this.state.interaction.selectedId);
            return;
        }
        const newStatus = (currentStatus === 'On') ? 'Off' : 'On';

        this.workspace.setLight(this.state.interaction.selectedId, newStatus, this.world);
    }

    // ============================================================================
    // File 
    // ============================================================================
    async loadDefaultFiles() {
        try {
            // Load world file
            const worldResponse = await fetch('./content/openmind101/hello.world.json');
            if (!worldResponse.ok) throw new Error('World file not found');
            
            const worldContent = await worldResponse.text();
            this.world = World.fromObject(JSON.parse(worldContent));
            this.state.name.world = 'hello';
            console.log('Loaded default world: hello');

            // Load workspace file
            const workspaceResponse = await fetch('./content/openmind101/hello.workspace.json');
            if (!workspaceResponse.ok) throw new Error('Workspace file not found');
            
            const workspaceContent = await workspaceResponse.text();
            this.workspace = Workspace.fromObject(JSON.parse(workspaceContent));
            this.state.name.workspace = 'hello';
            
            document.title = 'hello - world';
            
            this.workspace.initializeNodes(this.world);
            this.resetCamera();
            
            console.log('Loaded default workspace: hello');
        } catch (error) {
            console.error('Error loading default files:', error);
            throw error;
        }
    }

    async handleWorldSelect(event) {
        const files = event.target.files;
        const file = files[0];

        if (!file) {
            // User cancelled world selection
            if (this.state.ui.openingFiles) {
                console.log('World file selection cancelled - aborting file opening');
                this.state.ui.openingFiles = false;
                this.state.ui.openingStep = null;
            }
            return;
        }

        this.state.name.world = file.name.replace(/\.world\.json$/i, '') || 'Unknown World';
        const content = await file.text();
        this.world = World.fromObject(JSON.parse(content));
        console.log('Loaded world:', this.state.name.world);

        // If we're in sequential opening mode, automatically proceed to workspace
        if (this.state.ui.openingFiles && this.state.ui.openingStep === 'world') {
            console.log('Opening files: Step 2 - Select Workspace file');
            this.state.ui.openingStep = 'workspace';

            // Small delay to ensure world dialog is fully closed
            setTimeout(() => {
                document.getElementById('workspace-input').click();
            }, 100);
        }
    }
    async handleWorkspaceSelect(event) {
        const files = event.target.files;
        const file = files[0];

        if (!file) {
            // User cancelled workspace selection
            if (this.state.ui.openingFiles) {
                console.log('Workspace file selection cancelled - aborting file opening');
                this.state.ui.openingFiles = false;
                this.state.ui.openingStep = null;
            }
            return;
        }

        this.state.name.workspace = file.name.replace(/\.workspace\.json$/i, '') || '???';

        document.title = this.state.name.workspace + ' for ' + this.state.name.world + ' - Canvas Editor';

        console.log('Loaded workspace:', file.name);

        const content = await file.text();
        this.workspace = Workspace.fromObject(JSON.parse(content));

        this.workspace.initializeNodes(this.world);
        this.resetCamera();

        // Complete the sequential file opening process
        if (this.state.ui.openingFiles && this.state.ui.openingStep === 'workspace') {
            console.log('File opening completed successfully');
            this.state.ui.openingFiles = false;
            this.state.ui.openingStep = null;
        }
    }
    download() {
        // Prepare data for saving
        const workspaceText = JSON.stringify(this.workspace.toObject(), null, 2);
        const worldText = JSON.stringify(this.world.toObject(), null, 2);

        // Determine filenames
        const worldInput = document.getElementById('world-input');
        const workspaceInput = document.getElementById('workspace-input');
        const worldFilename = worldInput.files.length > 0 ? worldInput.files[0].name : 'haha.world.json';
        const workspaceFilename = workspaceInput.files.length > 0 ? workspaceInput.files[0].name : 'haha.workspace.json';

        utils.downloadJSONFile(worldFilename, worldText);
        utils.downloadJSONFile(workspaceFilename, workspaceText);

        console.log('Workspace saved!');
    }
}


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * COMMON PRACTICE 7: Debounce for Performance
 * Use for events that fire frequently (resize, scroll, input)
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * COMMON PRACTICE 8: Throttle for Performance
 * Use for events that need regular updates but not every frame
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new App();
    
    // Load default files on startup
    try {
        // await window.app.loadDefaultFiles();
    } catch (error) {
        console.warn('Could not load default files:', error);
    }
});
