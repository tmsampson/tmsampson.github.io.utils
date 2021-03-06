// -------------------------------------------------------------------------------------------------------------------------
// Import
import * as circuit_render from "../../js/circuit.render.mjs";

// -------------------------------------------------------------------------------------------------------------------------
// Register
circuit_render.registerComponentWidget({
	name: "power_source",
	displayName: "Power Source",
	description: "'Always On' Power source",
	category: "Basic",
	images:
	{
		"power_source" : { file: "power_source.svg" },
	},
	icon: { file: "power_source_icon.png" },
	version: "1.0.0.0",
	create: () => new PowerSourceWidget()
});

// -------------------------------------------------------------------------------------------------------------------------
// Implementation
class PowerSourceWidget
{
	getRenderImage(component)
	{
		return { image: "power_source", width: 85.8, height: 85.8 };
	}

	getOutputPinPosition(outputPinIndex)
	{
		return { x: 90.09, y: 42.9 };
	}
}

// -------------------------------------------------------------------------------------------------------------------------