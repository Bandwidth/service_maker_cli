"use strict";
let cli          = require("../lib/cli");
let co           = require("co");
let ServiceMaker = require("../lib/ServiceMaker");

const DEFAULT_URL = "https://dev-servicemaker.bwrnd.com";

function clientFactory (config, options) {
  options = Object.create(options) || {};

  options.url = options.url || config.get("url", DEFAULT_URL);
  if (!("username" in options) && !("password" in options)) {
    options.token = config.get("token");
  }

  return new ServiceMaker(options);
}

co(function* () {
  try {
    yield cli.run(clientFactory, process.argv);
  }
  catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
