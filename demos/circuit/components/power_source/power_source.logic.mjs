// -------------------------------------------------------------------------------------------------------------------------
// Import
import * as circuit from "../../js/circuit.mjs";

// -------------------------------------------------------------------------------------------------------------------------
// Register
circuit.registerComponent({
	name: "power_source",
	description: "'Always On' Power source",
	version: "1.0.0.0",
	create: () => new PowerSource()
});

// -------------------------------------------------------------------------------------------------------------------------
// Implementation
class PowerSource
{
	constructor()
	{
		this.inputs = [ ];
		this.outputs = [true];
	}

	update()
	{
		this.outputs[0] = true;
	}
}

// -------------------------------------------------------------------------------------------------------------------------