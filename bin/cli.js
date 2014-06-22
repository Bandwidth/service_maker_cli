"use strict";
let co           = require("co");
let Config       = require("../lib/Config");
let debug        = require("debug")("service_maker_cli:cli");
let path         = require("path");
let program      = require("commander");
let read         = require("read");
let ServiceMaker = require("../lib/ServiceMaker");
let Table        = require("cli-table");
let _            = require("lodash");

const CONFIG_FILE = path.join(process.env.HOME, ".service_maker");
const DEFAULT_URL = "https://dev-servicemaker.bwrnd.com";

let config = new Config(CONFIG_FILE);

function createClient () {
  let token = config.get("token");
  let url   = config.get("url", DEFAULT_URL);

  return new ServiceMaker({ token : token, url : url });
}

function handleError (error) {
  let message = error.message;

  if (message.match(/invalid access token/i)) {
    console.error("Unauthorized: maybe try `service-maker login`?");
    process.exit(1);
  }
}

function printTable () {
  let headers = Array.prototype.slice.call(arguments);
  let rows    = headers.pop();
  let table   = new Table({ head : headers });

  _.each(rows, function (row) { table.push(row); });
  console.log(table.toString());
}

function* prompt (message, silent) {
  let result = yield read.bind(
    null,
    {
      prompt  : message + ": ",
      replace : "*",
      silent  : silent
    }
  );

  return result[0];
}

prompt.password = function* (message) {
  return yield prompt(message, true);
};

let listServices = co(function* () {
  let client = createClient();
  let services;

  try {
    services = yield client.services.describe();
  }
  catch (error) {
    handleError(error);
  }

  services = _.pluck(services, "type");
  services = _.map(services, function (service) { return [ service ]; });
  printTable("services", services);
});

let listTypes = co(function* () {
  let client = createClient();
  let types;

  try {
    types = yield client.serviceTypes.describe();
  }
  catch (error) {
    handleError(error);
  }

  types = _.map(types, function (type) { return [ type ]; });
  printTable("service types", types);
});

let login = co(function* () {
  let username = yield prompt("username");
  let password = yield prompt.password("password");
  let url      = config.get("url", DEFAULT_URL);
  let token;

  debug("attempting to login to '%s'", url);
  let client = new ServiceMaker({
    username : username,
    password : password,
    url      : url
  });

  try {
    token = yield client.login();
  }
  catch (error) {
    console.error("Failed to authenticate.");
    process.exit(1);
  }

  config.set("token", token);
  console.log("Successfully authenticated.");
});

program
  .command("login")
  .description("Acquire a new access token.")
  .action(login);

program
  .command("services")
  .description("List the available services.")
  .action(listServices);

program
  .command("types")
  .description("List the available service types.")
  .action(listTypes);

program.on("*", function (command) {
  console.error("Unknown command '%s'.", command);
  program.outputHelp();
  process.exit(1);
});

program.parse(process.argv);

if (program.args.length < 1) {
  program.outputHelp();
  process.exit(1);
}
