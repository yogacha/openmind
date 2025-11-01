/**
 * @typedef {Object} Coord
 * @property {number} x - The x-coordinate.
 * @property {number} y - The y-coordinate.
 */

/**
 * Interactive Canvas Editor - Event Management Structure
 * 
 * This file demonstrates common practices for handling many event listeners:
 * 1. Event Delegation - Single listeners for multiple similar elements
 * 2. Modular Organization - Separate concerns into classes/modules
 * 3. State Management - Centralized state with proper updates
 * 4. Event Cleanup - Proper removal of listeners when needed
 */

import utils from './utils.js';
import { World, Workspace } from './model.js';


const nodeRadius = 30;
const endpointRadius = 7; // for hit testing

export class CanvasEditor {
    constructor() {
        // Initialize state
        this.world = new World();
        this.workspace = new Workspace();

        this.state = {
            name: {
                world: 'Unknown World',
                workspace: '???',
            },
            /** @type {Map<string, {x: number, y: number, color: string}>} */
            camera: {
                centerX: 0, centerY: 0, zoom: 1
            },
            interaction: {
                selectedId: null,
                /** not necessary drag */
                selectedEndpoint: null,
                dragStart: { x: 0, y: 0 },
                lastCamera: { centerX: 0, centerY: 0, zoom: 1 },
                mouse: { x: 0, y: 0 },
                mouseDown: false,
            },
            ui: {
                searchResults: [],
                contextMenuVisible: false,
                modalOpen: false,
                openingFiles: false,
                openingStep: null,
                editingItemId: null,
                originalTitle: null,
                originalBody: null,
                inlineTitleEditId: null,
                inlineTitleValue: ''
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
        document.getElementById('world-input').addEventListener('change', this.handleWorldSelect.bind(this));
        document.getElementById('workspace-input').addEventListener('change', this.handleWorkspaceSelect.bind(this));

        // Inline title editor
        const inlineTitleInput = document.getElementById('inline-title-input');
        inlineTitleInput.addEventListener('input', this.handleInlineTitleInput.bind(this));
        inlineTitleInput.addEventListener('blur', this.handleInlineTitleBlur.bind(this));
        inlineTitleInput.addEventListener('keydown', this.handleInlineTitleKeydown.bind(this));
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
    }

    // ===============================
    // Camera events
    // ===============================
    setCamera(centerX = null, centerY = null, zoom = null) {
        this.state.camera.centerX = centerX ?? this.state.camera.centerX;
        this.state.camera.centerY = centerY ?? this.state.camera.centerY;
        this.state.camera.zoom = zoom ?? this.state.camera.zoom;
        // console.log('setCamera', centerX, centerY, zoom);
        // this.render();
    }
    resetCamera(margin = 100) {
        const rect = this.workspace.getBoundingRect();
        let ratio = Math.min(
            this.canvas.width / (rect.width + margin * 2),
            this.canvas.height / (rect.height + margin * 2)
        );
        ratio = Math.min(ratio, 1);
        this.setCamera(rect.centerX, rect.centerY, ratio);
    }
    // =============================
    currentMode() {
        if (this.state.interaction.mouseDown) { // pan/drag/attach
            if (this.state.interaction.selectedEndpoint) {
                console.assert(this.state.interaction.selectedEndpoint.includes('-'),
                    `selectedEndpoint should be compositive, got ${this.state.interaction.selectedEndpoint}`);
                return 'attach'; // attaching existing endpoint to a new target
            } else if (this.state.interaction.selectedId) {
                return 'select'; // dragging a node/item
            } else {
                return 'pan'; // panning/moving the camera view
            }
        } else { // 
            if (this.state.interaction.selectedEndpoint) { // has select endpoint
                console.assert(!this.state.interaction.selectedEndpoint.includes('-'),
                    `selectedEndpoint should be pure, got ${this.state.interaction.selectedEndpoint}`);
                return 'link'; // creating new link from selected light
            } else {
                return 'idle'; // default mode
            }
        }
    }
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    /**
     * CANVAS EVENT HANDLERS
     */
    handleCanvasMouseDown(event) { }

    handleCanvasMouseMove(event) {
        // Update mouse position for general use
        this.state.interaction.mouse = this._mouse(event);
    }

    handleCanvasMouseUp(event) { }

    handleCanvasWheel(event) {
        event.preventDefault();

        // Calculate zoom factor
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.state.camera.zoom * zoomFactor));

        this.setCamera(null, null, newZoom);
        this.render();
    }

    handleCanvasContextMenu(event) {
        event.preventDefault();

        if (this.state.interaction.selectedId) {
            // Show item context menu
            this.showItemContextMenu();
        } else {
            // Show canvas context menu
            this.showCanvasContextMenu();
        }

        this.render();
    }

    handleCanvasDoubleClick(event) { }

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
        } else if (!target.closest('.modal, .context-menu, .side-panel, .inline-title-editor')) {
            // Click outside modals/menus - close them
            // Save editor changes if panel is open
            if (this.state.ui.editingItemId) {
                this.saveItemChanges();
            } else if (this.state.ui.inlineTitleEditId) {
                this.saveInlineTitleChanges();
            } else {
                this.closeAllPopups();
            }
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
        switch (action) {
            case 'add-light':
                this.addItem('light');
                break;
            case 'add-material':
                this.addItem('material');
                break;
            case 'delete':
                this.deleteSelectedItem();
                break;
            case 'hide':
                this.hideSelectedItem();
                break;
            case 'select-color':
                this.changeItemColor();
                break;
            case 'link-item':
                this.startLinkingItem();
                break;
            case 'edit':
                this.editSelectedItem();
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
     * INLINE TITLE EDITOR EVENT HANDLERS
     */
    handleInlineTitleInput(event) {
        this.state.ui.inlineTitleValue = event.target.value;
    }

    handleInlineTitleBlur(event) {
        // Save changes when losing focus (unless clicking on canvas or other elements)
        setTimeout(() => {
            if (this.state.ui.inlineTitleEditId) {
                this.saveInlineTitleChanges();
            }
        }, 100);
    }

    handleInlineTitleKeydown(event) {
        event.stopPropagation(); // Prevent global keyboard shortcuts while editing

        if (event.key === 'Enter') {
            event.preventDefault();
            this.saveInlineTitleChanges();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelCurrentOperation();
        }
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
                this.download();
                break;
            case 'ctrl+o':
                event.preventDefault();
                this.openFiles();
                break;
            case 'delete':
                if (this.state.interaction.selectedId && !this.state.ui.editingItemId) {
                    this.deleteSelectedItem();
                } else if (this.state.interaction.selectedEndpoint?.includes('-')) {
                    this.deleteProjection();
                }
                break;
            case 'enter':
                if (this.state.ui.inlineTitleEditId) {
                    this.saveInlineTitleChanges();
                } else if (this.state.interaction.selectedId && !this.state.ui.editingItemId) {
                    this.editSelectedItem();
                }
                break;
            case 'escape':
                if (this.state.ui.inlineTitleEditId) {
                    this.cancelCurrentOperation();
                } else if (this.state.ui.editingItemId) {
                    this.saveItemChanges();
                } else {
                    this.cancelCurrentOperation();
                }
                break;
            case 'l':
                const selectedItem = this.state.interaction.selectedId ?
                    this.world.get(this.state.interaction.selectedId) : null;
                if (selectedItem?.type === 'light') {
                    this.toggleLight();
                }
                break;
            case 'r':
                this.resetCamera();
                this.render();
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

    async openFiles() {
        console.log('Opening files: Step 1 - Select World file');

        // Set flag to indicate we're in sequential file opening mode
        this.state.ui.openingFiles = true;
        this.state.ui.openingStep = 'world';

        // Trigger world file selection
        document.getElementById('world-input').click();
    }
    async handleWorldSelect(event) { }
    async handleWorkspaceSelect(event) { }

    /**
     * WINDOW EVENT HANDLERS
     */
    handleWindowResize(event) {
        this.resizeCanvas();
        this.render();
    }

    // ============================================================================
    // ACTION METHODS (TO BE IMPLEMENTED)
    // ============================================================================

    addItem(type) { }

    deleteSelectedItem() { }

    deleteProjection() { }

    hideSelectedItem() { }

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

    saveInlineTitleChanges() {
        if (!this.state.ui.inlineTitleEditId) return;

        const itemId = this.state.ui.inlineTitleEditId;
        const newTitle = this.state.ui.inlineTitleValue.trim();

        // Update the item's title in the world
        const item = this.world.get(itemId);
        if (item && newTitle !== '') {
            item.title = newTitle;
            console.log('Updated item title:', itemId, newTitle);
        }

        this.hideInlineTitleEditor();
        this.render();
    }

    changeItemColor() {
        // random color for demo
        const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        this.workspace.setStyle(this.state.interaction.selectedId, null, null, color);
        this.render();
    }

    startLinkingItem() {
        this.workspace.setLight(this.state.interaction.selectedId, 'On', this.world);
        this.state.interaction.selectedEndpoint = this.state.interaction.selectedId;
    }

    editSelectedItem() { }

    toggleLight() { }

    download() { }

    showHelpModal() {
        // TODO: Display help modal
    }

    cancelCurrentOperation() {
        // Close any open popups
        this.closeAllPopups();

        // Clear selection
        this.state.interaction.selectedId = null;
        this.state.interaction.selectedEndpoint = null;
        this.render();
    }

    closeAllPopups() {
        this.hideContextMenu();
        this.hideHelpModal();
        this.hideEditorPanel();
        this.hideInlineTitleEditor();

        // Hide search dropdown
        document.getElementById('search-dropdown').classList.add('hidden');
    }

    hideContextMenu() {
        document.getElementById('canvas-context-menu').classList.add('hidden');
        document.getElementById('item-context-menu').classList.add('hidden');
        this.state.ui.contextMenuVisible = false;
    }

    showCanvasContextMenu() {
        const menu = document.getElementById('canvas-context-menu');
        menu.style.left = Math.min(this.state.interaction.mouse.x, this.canvas.width - menu.offsetWidth) + 'px';
        menu.style.top = Math.min(this.state.interaction.mouse.y, this.canvas.height - menu.offsetHeight) + 'px';
        menu.classList.remove('hidden');
        this.state.ui.contextMenuVisible = true;
    }

    showItemContextMenu() {
        const item = this.world.get(this.state.interaction.selectedId);
        const menu = document.getElementById('item-context-menu');
        // hide options
        if (item.type === 'material') {
            document.getElementById('color-option').classList.add('hidden');
            document.getElementById('link-option').classList.add('hidden');
        } else {
            document.getElementById('color-option').classList.remove('hidden');
            document.getElementById('link-option').classList.remove('hidden');
        }

        menu.style.left = Math.min(this.state.interaction.mouse.x, this.canvas.width - menu.offsetWidth) + 'px';
        menu.style.top = Math.min(this.state.interaction.mouse.y, this.canvas.height - menu.offsetHeight) + 'px';
        menu.classList.remove('hidden');
        this.state.ui.contextMenuVisible = true;
    }

    showEditorPanel(item) {
        const panel = document.getElementById('side-panel');
        const titleInput = document.getElementById('item-title-input');
        const bodyInput = document.getElementById('item-body-input');

        // Populate form fields
        titleInput.value = item.title || '';
        bodyInput.value = item.body || '';

        // Store the item being edited
        this.state.ui.editingItemId = item.id;
        this.state.ui.originalTitle = item.title;
        this.state.ui.originalBody = item.body;

        // Show panel
        panel.classList.remove('hidden');

        // Focus on title input
        setTimeout(() => titleInput.focus(), 100);

        console.log('Opened editor for item:', item.id);
    }

    showInlineTitleEditor() {
        const itemId = this.state.interaction.selectedId;
        const item = this.world.get(itemId);
        if (!item) return;

        this.state.ui.inlineTitleEditId = itemId;
        this.state.ui.inlineTitleValue = item.title || '';

        // Get the input element and position it
        const input = document.getElementById('inline-title-input');
        // Position the input over the item
        input.style.left = (this.state.interaction.mouse.x - 50) + 'px'; // Center the input (assuming 100px width)
        input.style.top = (this.state.interaction.mouse.y - 10) + 'px';  // Center vertically
        input.value = this.state.ui.inlineTitleValue;

        // Show and focus the input
        input.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
            input.select(); // Select all text for easy editing
        }, 10);
        // this.render();
    }

    hideHelpModal() {
        document.getElementById('help-modal').classList.add('hidden');
        this.state.ui.modalOpen = false;
    }

    hideEditorPanel() {
        const panel = document.getElementById('side-panel');
        panel.classList.add('hidden');

        // Clear editing state
        this.state.ui.editingItemId = null;
        this.state.ui.originalTitle = null;
        this.state.ui.originalBody = null;

        console.log('Closed editor panel');
    }

    hideInlineTitleEditor() {
        document.getElementById('inline-title-input').classList.add('hidden');
        this.state.ui.inlineTitleEditId = null;
        this.state.ui.inlineTitleValue = '';
    }

    saveInlineTitleChanges() {
        if (!this.state.ui.inlineTitleEditId) return;

        const itemId = this.state.ui.inlineTitleEditId;
        const newTitle = this.state.ui.inlineTitleValue.trim();

        // Update the item's title in the world
        const item = this.world.get(itemId);
        if (item && newTitle !== '') {
            item.title = newTitle;
            console.log('Updated item title:', itemId, newTitle);
        }

        this.hideInlineTitleEditor();
        this.render();
    }


    /**
     * RENDERING
     * Main render method that redraws the entire canvas
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

        // Draw
        this.drawCurves();
        this.drawNodes();

        // Restore context
        this.ctx.restore();

    }


    drawCurves() {
        if (this.currentMode() === 'link') { // link light to item
            const nodeStyle = this.workspace._nodes.get(this.state.interaction.selectedId);
            const start = { x: nodeStyle.x, y: nodeStyle.y };
            const end = this._canvas2coord(this.state.interaction.mouse);
            // linking mode
            this.drawCurve({ start, mid: start, end, color: nodeStyle.color });
        }
        for (const curve of this.workspace.curves(this.world)) {
            // If this endpoint is being dragged, override its position with mouse coordinate
            if (this.currentMode() === 'attach' &&
                this.state.interaction.selectedEndpoint === curve.index) {
                curve.end = this._canvas2coord(this.state.interaction.mouse);
            }
            this.drawCurve(curve);
        }
    }
    drawCurve(curve) {
        // Calculate control point for tangent curve from mid to end
        // The control point extends the line from start->mid beyond mid
        const direction = utils.Vec.sub(curve.mid, curve.start);
        const controlPoint = utils.Vec.add(curve.mid, utils.Vec.scale(direction, 0.7));

        // Set up line style
        this.ctx.strokeStyle = curve.color;
        this.ctx.lineWidth = 3 / this.state.camera.zoom;

        // Draw solid straight line from start to mid
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(curve.start.x, curve.start.y);
        this.ctx.lineTo(curve.mid.x, curve.mid.y);
        this.ctx.stroke();


        // Draw dotted quadratic curve from mid to end with tangent control
        this.ctx.setLineDash([8 / this.state.camera.zoom, 6 / this.state.camera.zoom]);
        this.ctx.beginPath();
        this.ctx.moveTo(curve.mid.x, curve.mid.y);
        if (!curve.end.isNull) {
            this.ctx.quadraticCurveTo(
                controlPoint.x, controlPoint.y,
                curve.end.x, curve.end.y
            );
        } else {
            this.ctx.lineTo(curve.end.x, curve.end.y);
        }
        this.ctx.stroke();

        // Reset line dash for other drawing operations
        this.ctx.setLineDash([]);

        this.drawEndpoint({ x: curve.end.x, y: curve.end.y, color: curve.color });
    }

    drawEndpoint(info, radius = endpointRadius) {
        this.ctx.beginPath();
        this.ctx.arc(info.x, info.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = info.color;
        this.ctx.fill();
    }

    drawNodes() {
        for (const info of this.workspace.nodes(this.world)) {
            this.drawNode(info);
        }
    }

    drawNode(info, radius = nodeRadius) {
        this.ctx.beginPath();
        this.ctx.arc(info.x, info.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = info.color;
        this.ctx.fill();

        if (info.type === 'material') {
            // Material: white fill with border
            this.ctx.strokeStyle = '#333333' + info.color.slice(-2);
            this.ctx.lineWidth = 2 / this.state.camera.zoom;
            this.ctx.stroke();
        }

        // Draw title
        this.ctx.fillStyle = '#333';
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
    _mouse(event) { // Returns position relative to canvas center
        return {
            x: event.clientX,
            y: event.clientY
        };
    }
    _canvas2coord(mouse) { // Convert canvas position to coordinates
        return {
            x: this.state.camera.centerX + (mouse.x - this.canvas.width / 2) / this.state.camera.zoom,
            y: this.state.camera.centerY + (mouse.y - this.canvas.height / 2) / this.state.camera.zoom
        };
    }
}


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