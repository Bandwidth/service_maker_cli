"use strict";
let fs     = require("fs");
let http   = require("http");
let koa    = require("koa");
let path   = require("path");
let q      = require("q");
let router = require("koa-router");
let spawn  = require("child_process").spawn;
let stream = require("stream");

const client = path.join(__dirname, "..", "bin", "cli.js");

function CaptureStream () {
  let buffer = [];

  stream.Writable.call(this);

  this._write = function (chunk, encoding, done) {
    buffer.push(chunk.toString());
    done();
  };

  this.toString = function () {
    return buffer.join("");
  };
}

CaptureStream.prototype = Object.create(stream.Writable.prototype);

module.exports = {

  configFile : path.join(__dirname, ".service_maker"),

  configure : function (options) {
    let file = this.configFile;
    let home = process.env.HOME;

    process.env.HOME = __dirname;
    fs.writeFileSync(file, JSON.stringify(options));

    return function () {
      try {
        fs.unlinkSync(file);
      }
      catch (error) {
        // Do nothing.
      }

      process.env.HOME = home;
    };
  },

  createServer : function () {
    let app    = koa();
    let server;

    app.use(router(app));

    app.start = function* () {
      server = http.createServer(app.callback());
      yield server.listen.bind(server, 0);
      app.url = "http://localhost:" + server.address().port + "/";
    };

    app.stop = function* () {
      yield server.close.bind(server);
      delete app.url;
    };

    return app;
  },

  run : function* (options) {
    let deferred = q.defer();
    let node     = process.execPath;
    let nodeArgs = process.execArgv.concat(client, options.arguments);

    let stdout  = new CaptureStream();
    let child   = spawn(node, nodeArgs, { stdio : "pipe" });
    let prompts = Array.isArray(options.prompts) ? options.prompts.slice() : [];
    let result  = Object.create(null);

    result.output = stdout.toString.bind(stdout);

    child.stderr.pipe(stdout);
    child.stdout.pipe(stdout);

    // Check for prompts to the user and simulate user input.
    child.stdout.on("data", function () {
      let buffer = stdout.toString();

      for (let i = 0; i < prompts.length; i++) {
        if (buffer.match(prompts[i].pattern)) {
          child.stdin.write(prompts[i].value + "\n");
          prompts.splice(i, 1);

          if (prompts.length === 0) {
            child.stdin.end();
          }
          break;
        }
      }
    });

    child.on("close", deferred.resolve.bind(deferred));
    child.on("error", deferred.reject.bind(deferred));
    result.status = yield deferred.promise;

    return result;
  }

};
