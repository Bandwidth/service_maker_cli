"use strict";
let co           = require("co");
let Config       = require("../lib/Config");
let debug        = require("debug")("service_maker_cli:cli");
let path         = require("path");
let program      = require("commander");
let read         = require("read");
let ServiceMaker = require("../lib/ServiceMaker");

const CONFIG_FILE = path.join(process.env.HOME, ".service_maker");

let config = new Config(CONFIG_FILE);

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

let login = co(function* () {
  let username = yield prompt("username");
  let password = yield prompt.password("password");
  let url      = config.get("url", "https://dev-servicemaker.bwrnd.com");
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

program.parse(process.argv);
