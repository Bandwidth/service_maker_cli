"use strict";
let cli = require("../lib/cli");
let co  = require("co");

co(function* () {
	try {
		yield cli.run(process.argv);
	}
	catch (error) {
		console.error(error.message);
		process.exit(1);
	}
})();
