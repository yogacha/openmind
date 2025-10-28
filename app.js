/**
 * Interactive Canvas Editor - Event Management Structure
 * 
 * This file demonstrates common practices for handling many event listeners:
 * 1. Event Delegation - Single listeners for multiple similar elements
 * 2. Modular Organization - Separate concerns into classes/modules
 * 3. State Management - Centralized state with proper updates
 * 4. Event Cleanup - Proper removal of listeners when needed
 */

import { World, Workspace } from './model.js';


class CanvasEditor {
    constructor() {
        // Initialize state
        this.world = new World();
        this.workspace = new Workspace();

        this.state = {       
            /** @type {Map<string, {x: number, y: number, color: string}>} */
            nodes: new Map(),
            camera: { 
                centerX: 0, centerY: 0, zoom: 1 
            },
            interaction: {
                selectedId: null,
                draggedId: null,
                dragStart: { x: 0, y: 0 },
                copiedId: null,
                isPanning: false,
                lastCameraCenterX: 0,
                lastCameraCenterY: 0,
            },
            ui: {
                searchResults: [],
                contextMenuVisible: false,
                modalOpen: false
            }
        };
        
        // Get DOM references
        /** @type {HTMLCanvasElement} */
        this.canvas = document.getElementById('main-canvas');
        
        /** @type {CanvasRenderingContext2D} */
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize the application
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.render();
    }
    
    setupCanvas() {
        // Set up canvas size
        this.resizeCanvas();
        
        // Set initial transform
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    /**
     * COMMON PRACTICE 1: Event Delegation
     * Instead of adding listeners to each element, use delegation on parent containers
     */
    setupEventListeners() {
        // Canvas Events (Primary interaction surface)
        this.setupCanvasEvents();
        
        // UI Control Events (Buttons, inputs, etc.)
        this.setupUIEvents();
        
        // Keyboard Events (Global shortcuts)
        this.setupKeyboardEvents();
        
        // Window Events (Resize, beforeunload, etc.)
        this.setupWindowEvents();
    }
    
    setupCanvasEvents() {
        // Mouse events on canvas
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleCanvasWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleCanvasContextMenu.bind(this));
        this.canvas.addEventListener('dblclick', this.handleCanvasDoubleClick.bind(this));
        
        // Touch events for mobile support
        this.canvas.addEventListener('touchstart', this.handleCanvasTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleCanvasTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleCanvasTouchEnd.bind(this));
    }
    
    /**
     * COMMON PRACTICE 2: Event Delegation for UI Controls
     * Use single listener on parent container instead of individual listeners
     */
    setupUIEvents() {
        // Event delegation for all buttons
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        
        // Context menu delegation
        document.addEventListener('click', this.handleContextMenuClick.bind(this));
        
        // Search functionality
        const searchBar = document.getElementById('search-bar');
        searchBar.addEventListener('input', this.handleSearchInput.bind(this));
        searchBar.addEventListener('focus', this.handleSearchFocus.bind(this));
        searchBar.addEventListener('blur', this.handleSearchBlur.bind(this));
        
        // File input for import
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }
    
    /**
     * COMMON PRACTICE 3: Centralized Keyboard Event Handling
     * Handle all keyboard shortcuts in one place with clear mapping
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    setupWindowEvents() {
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
    
    // ===============================
    // Semantic events
    // ===============================
    setCamera(centerX = null, centerY = null, zoom = null) {
        this.state.camera.centerX = centerX ?? this.state.camera.centerX;
        this.state.camera.centerY = centerY ?? this.state.camera.centerY;
        this.state.camera.zoom = zoom ?? this.state.camera.zoom;
        console.log('setCamera', centerX, centerY, zoom);
        this.render();
    }
    setItemStyle(id, x, y, color) {
        const nodeData = this.state.nodes.get(id);
        nodeData.x = x;
        nodeData.y = y;
        nodeData.color = color;
        this.render();
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    _mouse(event) { // Returns position relative to canvas center
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left - this.canvas.width / 2,
            y: event.clientY - rect.top - this.canvas.height / 2
        };
    }
    _canvas2world(canvasCenterPoint) { // Convert canvas-center coordinates to world coordinates
        return {
            x: this.state.camera.centerX + canvasCenterPoint.x / this.state.camera.zoom,
            y: this.state.camera.centerY + canvasCenterPoint.y / this.state.camera.zoom
        };
    }
    _world2canvas(worldPoint) { // Convert world coordinates to canvas-center coordinates
        return {
            x: (worldPoint.x - this.state.camera.centerX) * this.state.camera.zoom,
            y: (worldPoint.y - this.state.camera.centerY) * this.state.camera.zoom
        };
    }
    /**
     * CANVAS EVENT HANDLERS
     */
    handleCanvasMouseDown(event) {
        if (event.button !== 0) return; // Only handle left mouse button
        
        const mouse = this._mouse(event);
        const worldCoord = this._canvas2world(mouse);
        
        // Check if clicked on an item
        const clickedNodeId = this.getItemIdAtPosition(worldCoord.x, worldCoord.y);
        
        if (clickedNodeId) {
            this.state.interaction.selectedId = clickedNodeId;
            this.state.interaction.draggedId = clickedNodeId;
        } else {
            // Clear selection
            this.state.interaction.selectedId = null;
            
            // Start panning
            this.state.interaction.isPanning = true;
        }
        
        // Store drag start position
        this.state.interaction.dragStart = mouse;
        this.state.interaction.lastCameraCenterX = this.state.camera.centerX;
        this.state.interaction.lastCameraCenterY = this.state.camera.centerY;
        
        this.render();
    }
    
    handleCanvasMouseMove(event) {
        const mouse = this._mouse(event);
        
        if (this.state.interaction.isPanning) {
            // Update cursor
            this.canvas.style.cursor = 'grabbing';
            
            // Update camera position based on mouse movement
            const deltaX = (mouse.x - this.state.interaction.dragStart.x) / this.state.camera.zoom;
            const deltaY = (mouse.y - this.state.interaction.dragStart.y) / this.state.camera.zoom;
            
            this.setCamera(
                this.state.interaction.lastCameraCenterX - deltaX,
                this.state.interaction.lastCameraCenterY - deltaY,
                null
            );
        } else if (this.state.interaction.draggedId) {
            // Update cursor
            this.canvas.style.cursor = 'move';
            // Update item position
            const worldCoord = this._canvas2world(mouse);
            
            // Update position in the nodes Map
            const nodeData = this.state.nodes.get(this.state.interaction.draggedId);
            
            if (!nodeData) {
                console.warn('nodeData not found for id:', this.state.interaction.draggedId);
                console.log('Available node IDs:', Array.from(this.state.nodes.keys()));
                console.log('draggedNodeId:', this.state.interaction.draggedId);
                return;
            }
            
            nodeData.x = worldCoord.x;
            nodeData.y = worldCoord.y;
            
            this.render();
        }
    }
    
    handleCanvasMouseUp(event) {
        // Clear drag states
        this.state.interaction.isPanning = false;
        this.state.interaction.draggedId = null;
        
        // Change cursor back
        this.canvas.style.cursor = 'grab';
    }
    
    handleCanvasWheel(event) {
        event.preventDefault();

        // Calculate zoom factor
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.state.camera.zoom * zoomFactor));
        
        this.setCamera(null, null, newZoom);
    }
    
    handleCanvasContextMenu(event) {
        event.preventDefault();
        const mouse = this._mouse(event);
        // Convert to world coordinates
        const worldCoord = this._canvas2world(mouse);
        
        // Check if right-clicked on an item
        const clickedNodeId = this.getItemIdAtPosition(worldCoord.x, worldCoord.y);
        
        if (clickedNodeId) {
            // Show item context menu
            this.showItemContextMenu(event.clientX, event.clientY, clickedNodeId);
        } else {
            // Show canvas context menu
            this.showCanvasContextMenu(event.clientX, event.clientY);
        }
    }
    
    handleCanvasDoubleClick(event) {
        // TODO: Handle double-click actions
        // - Edit item title (if item clicked)
        // - Add to attention (if visible-only item)
    }
    
    handleCanvasTouchStart(event) {
        // TODO: Handle touch start (mobile support)
    }
    
    handleCanvasTouchMove(event) {
        // TODO: Handle touch move (mobile support)
    }
    
    handleCanvasTouchEnd(event) {
        // TODO: Handle touch end (mobile support)
    }
    
    /**
     * COMMON PRACTICE 4: Global Click Handler with Event Delegation
     * Single handler that routes to appropriate actions based on target
     */
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
            this.closeAllPopups();
        }
    }
    
    handleControlButton(button, event) {
        const buttonId = button.id;
        
        switch (buttonId) {
            case 'help-btn':
                this.showHelpModal();
                break;
            // Add more button handlers as needed
        }
    }
    
    handleCloseButton(button, event) {
        // TODO: Close appropriate modal/panel/menu
    }
    
    /**
     * CONTEXT MENU EVENT DELEGATION
     */
    handleContextMenuClick(event) {
        if (!event.target.classList.contains('menu-item')) return;
        
        const action = event.target.getAttribute('data-action');
        this.executeContextAction(action, event);
    }
    
    executeContextAction(action, event) {
        const mouse = this._mouse(event);
        const worldCoord = this._canvas2world(mouse);

        switch (action) {
            case 'add-light':
                this.addLight(worldCoord.x, worldCoord.y);
                break;
            case 'add-material':
                this.addMaterial(worldCoord.x, worldCoord.y);
                break;
            case 'paste':
                this.pasteItem(worldCoord.x, worldCoord.y);
                break;
            case 'copy':
                this.copySelectedItem();
                break;
            case 'delete':
                this.deleteSelectedItem();
                break;
            case 'attention-off':
                this.removeFromAttention();
                break;
            case 'change-color':
                this.changeItemColor();
                break;
            case 'unlink':
                this.unlinkFromShadow();
                break;
        }
        
        this.hideContextMenu();
    }
    
    /**
     * SEARCH EVENT HANDLERS
     */
    handleSearchInput(event) {
        const query = event.target.value;
        // TODO: Filter items and show dropdown
    }
    
    handleSearchFocus(event) {
        // TODO: Show search dropdown if there are results
    }
    
    handleSearchBlur(event) {
        // TODO: Hide search dropdown (with delay for click handling)
    }
    
    handleSearchItemClick(event) {
        // TODO: Add selected item to canvas/attention
    }
    
    /**
     * COMMON PRACTICE 5: Centralized Keyboard Shortcut Mapping
     */
    handleKeyDown(event) {
        // Check for modifier keys and create shortcut string
        const shortcut = this.getShortcutString(event);
        
        // Route to appropriate handlers
        switch (shortcut) {
            case 'ctrl+s':
                event.preventDefault();
                this.saveWorkspace();
                break;
            case 'ctrl+o':
                event.preventDefault();
                document.getElementById('file-input').click();
                break;
            case 'delete':
                if (this.state.interaction.selectedId) {
                    this.deleteSelectedItem();
                }
                break;
            case 'enter':
                if (this.state.interaction.selectedId) {
                    this.editSelectedItem();
                }
                break;
            case 'escape':
                this.cancelCurrentOperation();
                break;
            case 'l':
                const selectedItem = this.state.interaction.selectedId ? 
                    this.world.getItem(this.state.interaction.selectedId) : null;
                if (selectedItem?.type === 'light') {
                    this.toggleLight();
                }
                break;
        }
    }
    
    handleKeyUp(event) {
        // TODO: Handle key releases if needed
    }
    
    getShortcutString(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        parts.push(event.key.toLowerCase());
        return parts.join('+');
    }
    
    /**
     * FILE HANDLING
     */
    handleFileSelect(event) {
        const files = event.target.files;
        if (files.length > 0) {
            const file = files[0];
            const fileName = file.name;
            
            // Update page title with the file name (remove .workspace.json extension for cleaner display)
            const displayName = fileName.replace(/\.workspace\.json$/i, '');
            document.title = displayName + ' - Interactive Canvas Editor';
            
            console.log('Selected file:', fileName);
            console.log('Updated page title to:', displayName);
            
            // TODO: Process file content (load workspace data)
        }
    }
    
    /**
     * WINDOW EVENT HANDLERS
     */
    handleWindowResize(event) {
        this.resizeCanvas();
        this.render();
    }
    
    handleBeforeUnload(event) {
        // TODO: Warn about unsaved changes if any
    }
    
    // ============================================================================
    // ACTION METHODS (TO BE IMPLEMENTED)
    // ============================================================================
    
    addLight(x, y) {
        // Add to world data
        const item = this.world.addItem('light');
        // add to attention
        this.workspace.add(item.id, 'light');
        // add node style
        this.state.nodes.set(item.id, { x, y, color: '#ffeb3b' });

        this.render();
        console.log('Added light:', item.id);
    }
    
    addMaterial(x, y) {
        // Add to world data
        const item = this.world.addItem('material');
        // add to attention
        this.workspace.add(item.id, 'material');
        // add node style
        this.state.nodes.set(item.id, { x, y, color: '#ffffff' });
        
        this.render();
        console.log('Added material:', item.id);
    }
    
    pasteItem(x, y) {
        // TODO: Paste copied item
    }
    
    copySelectedItem() {
        // TODO: Copy selected item to clipboard state
    }
    
    deleteSelectedItem() {
        // TODO: Remove selected item from world
    }
    
    removeFromAttention() {
        // TODO: Remove item from attention (make visible-only)
    }
    
    changeItemColor() {
        // TODO: Show color picker for light items
    }
    
    unlinkFromShadow() {
        // TODO: Unlink material from shadow
    }
    
    editSelectedItem() {
        // TODO: Open side panel for content editing
    }
    
    toggleLight() {
        // TODO: Toggle light on/off status
    }
    
    saveWorkspace() {
        // TODO: Save current state to files
        console.log('Workspace saved!');
    }
    
    showHelpModal() {
        // TODO: Display help modal
    }
    
    cancelCurrentOperation() {
        // TODO: Cancel any ongoing operation (editing, dragging, etc.)
    }
    
    closeAllPopups() {
        // Hide context menus
        document.getElementById('canvas-context-menu').classList.add('hidden');
        document.getElementById('item-context-menu').classList.add('hidden');
        
        // Hide modals
        document.getElementById('help-modal').classList.add('hidden');
        
        // Hide search dropdown
        document.getElementById('search-dropdown').classList.add('hidden');
        
        this.state.ui.contextMenuVisible = false;
        this.state.ui.modalOpen = false;
    }
    
    hideContextMenu() {
        document.getElementById('canvas-context-menu').classList.add('hidden');
        document.getElementById('item-context-menu').classList.add('hidden');
        this.state.ui.contextMenuVisible = false;
    }
    
    showCanvasContextMenu(x, y) {
        const menu = document.getElementById('canvas-context-menu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');
        this.state.ui.contextMenuVisible = true;
    }
    
    showItemContextMenu(x, y, id) {
        const menu = document.getElementById('item-context-menu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');
        this.state.ui.contextMenuVisible = true;
        this.state.interaction.selectedId = id;
    }
    
    getItemIdAtPosition(worldX, worldY) {
        const radius = 30; // Item radius
        for (const [id, node] of this.state.nodes.entries()) {
            const distance = Math.sqrt(
                Math.pow(worldX - node.x, 2) + Math.pow(worldY - node.y, 2)
            );
            if (distance <= radius) {
                return id
            }
        }
        return null;
    }
    
    generateId() {
        return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * RENDERING
     * Main render method that redraws the entire canvas
     * @returns {void}
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context
        this.ctx.save();
        
        // Apply camera transform: translate to center, scale, then offset by camera center
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.state.camera.zoom, this.state.camera.zoom);
        this.ctx.translate(-this.state.camera.centerX, -this.state.camera.centerY);
        
        // Draw items
        this.drawItems();
        
        // Restore context
        this.ctx.restore();
        
    }
    
    /**
     * Draws all items (lights and materials) on the canvas
     * @returns {void}
     */
    drawItems() {
        for (const id of this.state.nodes.keys()) {
            this.drawItem(id);
        }
    }
    
    /**
     * Draws a single item (light or material) with selection ring if selected
     * @param {Object} info - The item to draw
     * @param {string} info.type - 'light' or 'material'
     * @param {number} info.x - X coordinate
     * @param {number} info.y - Y coordinate
     * @param {string} info.title - Display title
     * @param {string} [info.color] - Color for light items
     * @returns {void}
     */
    drawItem(id) {
        const info = {
            id: id,
            ...this.world.getItem(id),
            ...this.state.nodes.get(id)
        };
        const radius = 30;
        
        this.ctx.beginPath();
        this.ctx.arc(info.x, info.y, radius, 0, 2 * Math.PI);
        
        if (info.type === 'light') {
            // Light: filled circle with color
            // this.ctx.fillStyle = item.color || '#ffeb3b';
            this.ctx.fillStyle = '#ffeb3b';
            this.ctx.fill();
        } else {
            // Material: white fill with border
            this.ctx.fillStyle = 'white';
            this.ctx.fill();
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2 / this.state.camera.zoom;
            this.ctx.stroke();
        }
        
        // Draw title
        this.ctx.fillStyle = info.type === 'light' ? 'black' : '#333';
        this.ctx.font = `${14 / this.state.camera.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(info.title, info.x, info.y);
        
        // Draw selection ring if selected
        if (this.state.interaction.selectedId === info.id) {
            this.ctx.beginPath();
            this.ctx.arc(info.x, info.y, radius + 5, 0, 2 * Math.PI);
            this.ctx.strokeStyle = '#007acc';
            this.ctx.lineWidth = 2 / this.state.camera.zoom;
            this.ctx.setLineDash([5 / this.state.camera.zoom, 5 / this.state.camera.zoom]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }    
    /**
     * COMMON PRACTICE 6: Cleanup Method
     * Important for preventing memory leaks when destroying the instance
     */
    destroy() {
        // Remove all event listeners
        this.canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
        // ... remove all other listeners
        
        // Clear any intervals/timeouts
        // Clean up any other resources
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
    window.canvasEditor = new CanvasEditor();
});

/**
 * COMMON PRACTICES DEMONSTRATED:
 * 
 * 1. EVENT DELEGATION: Single listeners on parent elements instead of many individual listeners
 * 2. MODULAR ORGANIZATION: Separate methods for different event types and actions
 * 3. CENTRALIZED STATE: All application state in one place for easy management
 * 4. KEYBOARD SHORTCUT MAPPING: Clear, extensible system for keyboard shortcuts
 * 5. PERFORMANCE OPTIMIZATION: Debounce/throttle for frequent events
 * 6. CLEANUP: Proper event listener removal for memory management
 * 7. SEPARATION OF CONCERNS: Event handling separate from business logic
 * 8. CONSISTENT NAMING: Clear, descriptive method names following conventions
 */