"use strict";
let co           = require("co");
let Config       = require("../lib/Config");
let debug        = require("debug")("service_maker_cli:cli");
let path         = require("path");
let program      = require("commander");
let q            = require("q");
let read         = require("read");
let Table        = require("cli-table");
let _            = require("lodash");

function configPath () {
  return path.join(process.env.HOME, ".service_maker");
}

function done (error) {
  program.emit("done", error);
}

function handle (action) {
  return function () {
    var args = Array.prototype.slice.call(arguments);

    args.push(done);
    action.apply(program, args);
  };
}

function handleError (error) {
  let message = error.message;

  debug("Error: %s", error.message);
  if (message.match(/invalid access token/i)) {
    throw new Error("Unauthorized: maybe try `service-maker login`?");
  }
  else {
    throw error;
  }
}

function printTable () {
  let headers = Array.prototype.slice.call(arguments);
  let rows    = headers.pop();
  let table   = new Table({ head : headers });

  _.each(rows, function (row) { table.push(row); });
  console.log(table.toString());
}

function printObject (object) {
  let table = new Table();

  _.each(object, function (value, key) {
    let entry = {};

    entry[key] = value;
    table.push(entry);
  });
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

let createService = co(function* (type) {
  let client = program.client(new Config(configPath()));
  let output = {};
  let service;

  try {
    service = yield client.services.create(type);
  }
  catch (error) {
    handleError(error);
  }

  output.type = service.type;
  _.assign(output, service.data);
  printObject(output);
});

let listServices = co(function* () {
  let client = program.client(new Config(configPath()));
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
  let client = program.client(new Config(configPath));
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
  let config   = new Config(configPath());
  let username = yield prompt("username");
  let password = yield prompt.password("password");
  let token;

  debug("attempting to login");
  let client = program.client(config, { username : username, password : password });

  try {
    token = yield client.login();
  }
  catch (error) {
    debug("Error: %s", error.message);
    throw new Error("Failed to authenticate.");
  }

  config.set("token", token);
  console.log("Successfully authenticated.");
});

program
  .command("login")
  .description("Acquire a new access token.")
  .action(handle(login));

program
  .command("services")
  .description("List the available services.")
  .action(handle(listServices));

program
  .command("service-create <type>")
  .description("Create a new service instance.")
  .action(handle(createService));

program
  .command("types")
  .description("List the available service types.")
  .action(handle(listTypes));

program.on("*", function (command) {
  program.outputHelp();
  throw new Error("Unknown command '" + command + "'.");
});

module.exports = {

  run : function (factory, args) {
    let deferred = q.defer();

    program.client = factory;
    program.once("done", deferred.makeNodeResolver());
    program.parse(args);

    if (program.args.length < 1) {
      program.outputHelp();
      deferred.reject();
    }

    return deferred.promise;
  }

};
