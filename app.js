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
        this.state.interaction.selectedId = this.workspace.getNodeAtPosition(coord)
        console.log(`select(${this.state.interaction.selectedId})`);
        
        switch (this.currentMode()) {
            case 'link': // selectedEndpoint is setted
                if (this.state.interaction.selectedId) {
                    this.world.addProjection(this.state.interaction.selectedEndpoint, 
                        this.state.interaction.selectedId)
                    console.log(`addProjection(${this.state.interaction.selectedEndpoint}, ${this.state.interaction.selectedId})`);
                }
                this.state.interaction.selectedEndpoint = null;
            case 'idle':
                this.state.interaction.selectedEndpoint = this.workspace.getEndpointAtPosition(coord);
        
                if (this.state.interaction.selectedId) {
                    console.log('Started dragging item:', this.state.interaction.selectedId);
                } else if (this.state.interaction.selectedEndpoint) {
                    console.log('Started dragging endpoint:', this.state.interaction.selectedEndpoint);
                } else {
                    console.log('Started panning the canvas');
                }
        }
        // Store drag start position
        this.state.interaction.mouseDown = true;
        this.state.interaction.dragStart = { ...this.state.interaction.mouse };
        this.state.interaction.lastCamera = { ...this.state.camera };

        this.render();
    }

    handleCanvasMouseMove(event) {
        this.state.interaction.mouse = this._mouse(event);
        const coord = this._canvas2coord(this.state.interaction.mouse);

        switch (this.currentMode()) {
        case 'attach':
        case 'link':
            // Update cursor for endpoint dragging
            this.canvas.style.cursor = 'crosshair';
            this.render();
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
            this.render();
            break;
        case 'drag': // dragging a node/item
            // Update cursor
            this.canvas.style.cursor = 'move';

            const id = this.state.interaction.selectedId;
            this.workspace.setStyle(id, coord.x, coord.y)
            this.render();
            break;
        }
    }

    handleCanvasMouseUp(event) {
        // update mouse position & selected id
        this.state.interaction.mouse = this._mouse(event);
        const coord = this._canvas2coord(this.state.interaction.mouse);
        this.state.interaction.selectedId = this.workspace.getNodeAtPosition(coord)
        console.log(`select(${this.state.interaction.selectedId})`);

        switch (this.currentMode()) {
            case 'attach':
                const [startId, midId] = this.state.interaction.selectedEndpoint.split('-');
                if (this.state.interaction.selectedId) {
                    this.addAttachment(startId, midId, this.state.interaction.selectedId);
                    console.log(`addAttachment(${startId}, ${midId}, ${this.state.interaction.selectedId})`);
                } else {
                    console.log('give up adding attachment - no target selected');
                }
                this.state.interaction.selectedEndpoint = null;
                break;
            case 'pan':
                console.log(`setCamera(${this.state.camera.centerX}, ${this.state.camera.centerY})`);
                break;
            case 'drag':
                console.log(`moveItem(${this.state.interaction.selectedId}, ${coord.x}, ${coord.y})`);
                // this.state.interaction.selectedId = null;
                break;
        }

        this.state.interaction.mouseDown = false;
        // Change cursor back
        this.canvas.style.cursor = 'grab';
        
        // Re-render to show endpoint back in original position
        this.render();
    }
    // 
    
    handleGlobalClick(event) {
        const target = event.target;

        // Route to specific handlers based on element attributes/classes
        if (target.classList.contains('control-btn')) {
            this.handleControlButton(target, event);
        } else if (target.classList.contains('close-btn')) {
            this.handleCloseButton(target, event);
        } else if (target.id === 'search-dropdown') {
            this.handleSearchItemClick(target, event);
        } else if (!target.closest('.modal, .context-menu, .side-panel')) {
            // Click outside modals/menus - close them
            // Save editor changes if panel is open
            if (this.state.ui.editingItemId) {
                this.saveItemChanges();
            } else {
                this.closeAllPopups();
            }
        }
    }



    // ===========================================================================
    // Action METHODS
    // ===========================================================================
    addItem(x, y, type) {
        const item = this.world.newItem(type);
        // add to attention
        this.workspace.add(item, this.world);
        this.workspace.setStyle(item.id, x, y);

        this.render();
        console.log('Added ' + type + ':', item.id);
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
        
        // Re-render to show changes
        this.render();
        
        console.log('Deleted item:', itemId, 'Type:', item.type);
    }
    hideSelectedItem() {
        this.workspace.hide(this.state.interaction.selectedId, this.world);
        this.render();
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
        
        // Re-render to show any newly added nodes
        this.render();

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
        // TODO: Toggle light on/off status
    }
    saveItemChanges() {
        if (!this.state.ui.editingItemId) return;

        const item = this.world.get(this.state.ui.editingItemId);
        if (!item) {
            console.warn('Item to save not found:', this.state.ui.editingItemId);
            return;
        }

        const titleInput = document.getElementById('item-title-input');
        const bodyInput = document.getElementById('item-body-input');

        // Update item data
        item.title = titleInput.value.trim() || 'Untitled';
        item.body = bodyInput.value;

        // Re-render to show updated title
        this.render();
        
        // Hide panel
        this.hideEditorPanel();
        
        console.log('Saved changes for item:', item.id);
    }


    // ============================================================================
    // File 
    // ============================================================================
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
        this.render();

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
        const worldFilename = 'world.json';
        const workspaceInput = document.getElementById('workspace-input');
        const workspaceFilename = workspaceInput.files.length > 0 ? workspaceInput.files[0].name : 'workspace.json';

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
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
