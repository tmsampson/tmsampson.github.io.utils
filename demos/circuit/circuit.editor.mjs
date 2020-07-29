// -------------------------------------------------------------------------------------------------------------------------
// Import
import * as circuit from "./js/circuit.mjs";
import * as circuit_render from "./js/circuit.render.mjs";
import * as circuit_utils from "./js/circuit.utils.mjs";

// -------------------------------------------------------------------------------------------------------------------------
// Import canvas renderer
// NOTE: The editor doesn't interface with this directly, but we need to ensure it gets loaded (and registered)
import * as circuit_canvas from "./renderers/circuit.render.canvas.mjs";

// -------------------------------------------------------------------------------------------------------------------------
// External dependencies
const jqueryLib = "third-party/jquery/jquery.js";           // jQuery
const jqueryUILib = "third-party/jquery/jquery-ui.min.js";  // jQuery UI (js)
const jqueryCss = "third-party/jquery/jquery-ui.min.css";   // jQuery UI (css)
const editorCss = "circuit.editor.css";                     // Editor css

// -------------------------------------------------------------------------------------------------------------------------
// Misc
var circuitRoot = "./";

// -------------------------------------------------------------------------------------------------------------------------
// Config
var config = 
{
	gridSnapSpacing: 100,
};

// -------------------------------------------------------------------------------------------------------------------------
// Components
var componentPicker = null, settingsPanel = null;

// -------------------------------------------------------------------------------------------------------------------------
// Data
var workspace = null;
var workspaceRenderer = null;

// -------------------------------------------------------------------------------------------------------------------------
// UI
var canvasContainer = null;
var draggingComponentPickerItem = null;
var draggingComponentPickerItemIcon = null;
var draggingComponent = null;
var draggingComponentOriginalPosition = { };
var isDragging = false;

// -------------------------------------------------------------------------------------------------------------------------
// Init
window.onload = function()
{
	init();
};

// -------------------------------------------------------------------------------------------------------------------------

async function init()
{
	// Load editor dependencies
	if(!await loadDependencies())
	{
		console.error("Editor: Failed to load dependencies");
		return false;
	}

	// Init ciruit
	await circuit.init();

	// Setup component picker
	initComponentPicker();

	// Setup toolbar
	initSettingsPanel();

	// Grab canvas container
	canvasContainer = $("#editor_canvas_container");

	// Make canvas container full-screen
	resizeCanvasContainer();

	// Make sure canvas container resizes with screen
	$(window).resize(() => resizeCanvasContainer());

	// Create workspace for editor
	workspace = circuit.createWorkspace("editor", canvasContainer);
	if(workspace == null)
	{
		console.error("Editor: Workspace creation failed");
		return false;
	}

	// Grab renderer
	workspaceRenderer = circuit_render.getRenderer(workspace);
	if(workspaceRenderer == null)
	{
		console.error("Editor: Failed to find renderer for workspace");
		return false;
	}

	// Setup renderer defaults
	workspaceRenderer.setGridSnapSpacing(100);

	// Bind mouse events
	$(window).on("mouseup", (e) => onWindowMouseUp(e));
	$("#editor_canvas_container canvas").on("mouseup", (e) => onCanvasMouseUp(e));
	$("#editor_canvas_container canvas").on("mousedown", (e) => onCanvasMouseDown(e));
	$(document).on("mousemove", (e) => onMouseMove(e));
	return true;
}

// -------------------------------------------------------------------------------------------------------------------------

function resizeCanvasContainer()
{
	canvasContainer.css("width", window.innerWidth);
	canvasContainer.css("height", window.innerHeight);
}

// -------------------------------------------------------------------------------------------------------------------------

function initComponentPicker()
{
	// Setup component picker dialog
	var componentPickerWidth = 300, componentPickerPadding = 30;
	componentPicker = $("#editor_component_picker");
	componentPicker.dialog({ width: componentPickerWidth, closeOnEscape: false, dialogClass: "noclose" });

	// Bind events
	componentPicker.mouseup((e) => { e.preventDefault(); });

	// Set component picker initial position
	$("div[aria-describedby='editor_component_picker']").offset({ top: componentPickerPadding, left: componentPickerPadding });

	// Grab component descriptors and sort by category
	var componentRegistry = circuit.getComponentRegistry();
	var componentDescriptors = Object.values(componentRegistry);
	componentDescriptors.sort((a, b) => (a.category > b.category) ? 1 : ((b.category > a.category) ? -1 : 0));

	// Populate components picker with components
	var currentCategory = "", firstCategory = true;
	for (var i = 0; i < componentDescriptors.length; ++i)
	{
		var componentDescriptor = componentDescriptors[i];

		// Ignore components without a widget
		var widget = componentDescriptor.widget;
		if(widget == null)
		{
			continue;
		}

		// Create category header?
		var widgetDescriptor = widget.descriptor;
		var category = widgetDescriptor.category;
		if(firstCategory || category != currentCategory)
		{
			if(!firstCategory)
			{
				componentPicker.append(`<br/>`);
			}
			componentPicker.append(`<h2>${category}</h2>`);
		}
		firstCategory = false;
		currentCategory = category;

		// Create item html
		var componentName = componentDescriptor.name;
		var componentDisplayName = widgetDescriptor.displayName, componentDescription = widgetDescriptor.description;
		var componentIcon = `${circuitRoot}/components/${componentName}/img/${widgetDescriptor.icon.file}`;
		var componmentPickerItemHtml = "";
		componmentPickerItemHtml += `<div class='editor_component_picker_item'>`;
		componmentPickerItemHtml += `  <div class='icon' style="background-image: url('${componentIcon}')"/>`;
		componmentPickerItemHtml += `  <div class='content'>`;
		componmentPickerItemHtml += `    <h2>${componentDisplayName}</h2>`;
		componmentPickerItemHtml += `    <div class="description">${componentDescription}</div>`;
		componmentPickerItemHtml += `  </div>`;
		componmentPickerItemHtml += `</div>`;
		var componentPickerItem = $(componmentPickerItemHtml);

		// Store component descriptor and icon shortcut in item data
		componentPickerItem.data({ componentDescriptor: componentDescriptor, icon: componentIcon });

		// Register item mouse event
		componentPickerItem.on("mousedown", { item: componentPickerItem }, (e) => onStartDraggingComponentPickerItem(e.data.item, e.pageX, e.pageY));

		// Add item to picker
		componentPicker.append(componentPickerItem);
	}

	// Setup icon to show when dragging component picker items
	draggingComponentPickerItemIcon = $("<div id='editor_component_picker_item_drag_icon'></div>");
	$("body").append(draggingComponentPickerItemIcon);
	return;
}

// -------------------------------------------------------------------------------------------------------------------------

function onMouseMove(e)
{
	// Update dragged component picker item?
	if(draggingComponentPickerItem != null)
	{
		updateDraggingComponentPickerItemIconPosition(e.pageX, e.pageY);
	}

	// Update dragged component
	if(draggingComponent != null)
	{
		updateDraggingComponent(e.pageX, e.pageY);
	}
}

// -------------------------------------------------------------------------------------------------------------------------

function onStartDraggingComponentPickerItem(componentPickerItem, x, y)
{
	var componentName = componentPickerItem.data().componentDescriptor.name;
	draggingComponentPickerItem = componentPickerItem;
	isDragging = true;

	// Show and move icon
	draggingComponentPickerItemIcon.css('background-image', `url('${componentPickerItem.data().icon}')`);
	draggingComponentPickerItemIcon.show();
	updateDraggingComponentPickerItemIconPosition(x, y);

	// Toggle grid visibility?
	if(getEditorSettingValue(EditorSettings.GRID_MODE) == EditorSettings.GRID_MODE_SHOW_WHILST_DRAGGING)
	{
		workspaceRenderer.setGridVisible(true);
	}
}

// -------------------------------------------------------------------------------------------------------------------------

function onCancelDraggingComponentPickerItem()
{
	var componentName = draggingComponentPickerItem.data().componentDescriptor.name;
	draggingComponentPickerItem = null;
	isDragging = false;

	// Toggle grid visibility?
	if(getEditorSettingValue(EditorSettings.GRID_MODE) == EditorSettings.GRID_MODE_SHOW_WHILST_DRAGGING)
	{
		workspaceRenderer.setGridVisible(false);
	}

	// Hide icon
	draggingComponentPickerItemIcon.hide();
}

// -------------------------------------------------------------------------------------------------------------------------

function onFinishDraggingComponentPickerItem(x, y)
{
	var componentDescriptor = draggingComponentPickerItem.data().componentDescriptor;
	var componentName = componentDescriptor.name;
	draggingComponentPickerItem = null;
	isDragging = false;

	// Toggle grid visibility?
	if(getEditorSettingValue(EditorSettings.GRID_MODE) == EditorSettings.GRID_MODE_SHOW_WHILST_DRAGGING)
	{
		workspaceRenderer.setGridVisible(false);
	}

	// Hide icon
	draggingComponentPickerItemIcon.hide("puff", { percent: 150 }, 300);

	// Get cursor view position
	var cursorPositionView = cursorPositionToViewPosition(x, y);

	// Perform view --> workspace position mapping
	var workspacePosition = workspaceRenderer.viewPositionToWorkspacePosition(cursorPositionView);

	// Add component to workspace
	workspace.addComponent(componentDescriptor, { position: workspacePosition });
}

// -------------------------------------------------------------------------------------------------------------------------

function updateDraggingComponentPickerItemIconPosition(x, y)
{
	// Get cursor view position
	var cursorPositionView = cursorPositionToViewPosition(x, y);

	// Move dragged icon
	var iconWidth = draggingComponentPickerItemIcon.width();
	var iconHeight = draggingComponentPickerItemIcon.height();
	draggingComponentPickerItemIcon.css("left", cursorPositionView.x  - (iconWidth * 0.5));
	draggingComponentPickerItemIcon.css("top", cursorPositionView.y - (iconHeight * 0.5));
}

// -------------------------------------------------------------------------------------------------------------------------

function onStartDraggingComponent(component, x, y)
{
	// Store dragged component
	draggingComponentOriginalPosition = workspace.getComponentPosition(component);
	draggingComponent = component;
}

// -------------------------------------------------------------------------------------------------------------------------

function updateDraggingComponent(x, y)
{
	// Move dragged component
	var cursorPostionWorkspace = cursorPositionToWorkspacePosition(x, y);
	workspace.setComponentPosition(draggingComponent, cursorPostionWorkspace);
}

// -------------------------------------------------------------------------------------------------------------------------

function onCancelDraggingComponent(x, y)
{
	// Put component back where it was before we started moving it
	workspace.setComponentPosition(draggingComponent, draggingComponentOriginalPosition);

	// Clear dragged component
	draggingComponent = null;
}

// -------------------------------------------------------------------------------------------------------------------------

function onFinishDraggingComponent(x, y)
{
	// Clear dragged component
	draggingComponent = null;
}

// -------------------------------------------------------------------------------------------------------------------------

function cursorPositionToWorkspacePosition(x, y)
{
	var cursorPostionView = cursorPositionToViewPosition(x, y);
	return workspaceRenderer.viewPositionToWorkspacePosition(cursorPostionView);
}

// -------------------------------------------------------------------------------------------------------------------------

function cursorPositionToViewPosition(x, y)
{
	var cursorPostionView = { x: x, y: y };
	if(getEditorSettingValue(EditorSettings.GRID_SNAP) == EditorSettings.GRID_SNAP_ENABLED)
	{	
		var cursorPositionWorkspace = workspaceRenderer.viewPositionToWorkspacePosition(cursorPostionView);
		var cursorPositionWorkspaceSnapped = snapPositionToGrid(cursorPositionWorkspace);
		var cursorPositionViewSnapped = workspaceRenderer.workspacePositionToViewPosition(cursorPositionWorkspaceSnapped);
		return cursorPositionViewSnapped;
	}
	else
	{
		return cursorPostionView;
	}
}

// -------------------------------------------------------------------------------------------------------------------------

function onWindowMouseUp()
{
	// Cancel dragged component picker item
	if(draggingComponentPickerItem != null)
	{
		onCancelDraggingComponentPickerItem();
	}

	// Cancel dragged component
	if(draggingComponent != null)
	{
		onCancelDraggingComponent();
	}
}

// -------------------------------------------------------------------------------------------------------------------------

function onCanvasMouseUp(e)
{
	// Finish dragging component picker item?
	if(draggingComponentPickerItem != null)
	{
		onFinishDraggingComponentPickerItem(e.pageX, e.pageY);
	}

	// Finish dragging component?
	if(draggingComponent != null)
	{
		onFinishDraggingComponent(e.pageX, e.pageY);
	}
}

// -------------------------------------------------------------------------------------------------------------------------

function onCanvasMouseDown(e)
{
	var componentUnderCursor = workspaceRenderer.getComponentUnderCursor();
	if(componentUnderCursor != null)
	{
		onStartDraggingComponent(componentUnderCursor, e.pageX, e.pageY);
	}
}

// -------------------------------------------------------------------------------------------------------------------------
// Misc
function snapPositionToGrid(workspacePosition)
{
	var spacing = workspaceRenderer.getGridSnapSpacing();
	var gridX = Math.round(workspacePosition.x / spacing), gridY = Math.round(workspacePosition.y / spacing);
	return { x: (gridX * spacing), y: (gridY * spacing) };
}

// -------------------------------------------------------------------------------------------------------------------------
// Settings panel
function initSettingsPanel()
{
	settingsPanel = $("#editor_settings");
	var settingsPanelWidth = 480, settingsPanelHeight = 234, settingsPanelPadding = 30;
	var windowWidth = $(window).width();
	settingsPanel.dialog({ width: settingsPanelWidth, height:settingsPanelHeight, closeOnEscape: false, dialogClass: "noclose" });

	// Position at top right
	$("div[aria-describedby='editor_settings']").offset({ top: settingsPanelPadding, left: windowWidth - settingsPanelWidth - settingsPanelPadding });

	// Setup radio elements
	$("#editor_settings input").checkboxradio({ icon: false });

	// Bind setting change events
	bindSettingChangedEvent(EditorSettings.GRID_MODE);
}

// -------------------------------------------------------------------------------------------------------------------------

function bindSettingChangedEvent(settingName)
{
	$(`#editor_settings input[name=${settingName}]`).change(function() { onSettingChanged(settingName, this.value) });
}

// -------------------------------------------------------------------------------------------------------------------------

function onSettingChanged(settingName, newValue)
{
	switch(settingName)
	{
		case EditorSettings.GRID_MODE:
		{
			switch(newValue)
			{
				case EditorSettings.GRID_MODE_SHOW: { workspaceRenderer.setGridVisible(true); break; }
				case EditorSettings.GRID_MODE_SHOW_WHILST_DRAGGING: { workspaceRenderer.setGridVisible(isDragging); }
				case EditorSettings.GRID_MODE_HIDE: { workspaceRenderer.setGridVisible(false); }
			}
			break;
		}
	}
}

// -------------------------------------------------------------------------------------------------------------------------

function getEditorSettingValue(settingName)
{
	return $(`#editor_settings input[name=${settingName}]:checked`).val();
}

// -------------------------------------------------------------------------------------------------------------------------
// Settings enum
// -------------------------------------------------------------------------------------------------------------------------
// NOTE: These should match the values in the html
const EditorSettings =
{
	// Grid mode
	GRID_MODE: "editor_settings_grid_mode",
	GRID_MODE_SHOW: "show",
	GRID_MODE_SHOW_WHILST_DRAGGING: "show_whilst_dragging",
	GRID_MODE_HIDE: "hide",

	// Grid snap
	GRID_SNAP: "editor_settings_gridsnap",
	GRID_SNAP_ENABLED: "enabled",
	GRID_SNAP_DISABLED: "disabled",
};

// -------------------------------------------------------------------------------------------------------------------------
// Dependencies
async function loadDependencies()
{
	// Load jquery dynamically (cannot currently be imported as ES module)
	if(!await circuit_utils.loadScript(jqueryLib))
	{
		console.error("Failed to load jQuery");
		return false;
	}

	// Load jqueryUI dynamically (cannot currently be imported as ES module)
	if(!await circuit_utils.loadScript(jqueryUILib))
	{
		console.error("Failed to load jQuery UI");
		return false;
	}

	// Load jQuery UI stylesheet
	$("head").append(`<link rel="stylesheet" type="text/css" href="${jqueryCss}">`);

	// Load editor stylesheet
	$("head").append(`<link rel="stylesheet" type="text/css" href="${editorCss}">`);

	// All dependencies loaded
	return true;
}

// -------------------------------------------------------------------------------------------------------------------------