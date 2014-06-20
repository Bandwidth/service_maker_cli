"use strict";
let co           = require("co");
let Config       = require("../lib/Config");
let debug        = require("debug")("service_maker_cli:cli");
let path         = require("path");
let program      = require("commander");
let read         = require("read");
let ServiceMaker = require("../lib/ServiceMaker");
let _            = require("lodash");

const CONFIG_FILE = path.join(process.env.HOME, ".service_maker");
const DEFAULT_URL = "https://dev-servicemaker.bwrnd.com";

let config = new Config(CONFIG_FILE);

function printList (header, list) {
  console.log("\n%s:", header);
  console.log((new Array(header.length + 2)).join("="));

  _.each(list, function (item) {
    console.log(" * %s", item);
  });

  console.log();
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

let listTypes = co(function* () {
  let token  = config.get("token");
  let url    = config.get("url", DEFAULT_URL);

  let client = new ServiceMaker({ token : token, url : url });
  let types;

  try {
    types = yield client.serviceTypes.describe();
  }
  catch (error) {
    console.error("Unauthorized: maybe try `service-maker login`?");
    process.exit(1);
  }

  printList("Available service types", types);
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
