"use strict";
let auth   = require("koa-basic-auth");
let Config = require("../lib/Config");
let expect = require("chai").expect;
let helper = require("./helper");

describe("The command line client", function () {

  describe("logging in", function () {
    let server;

    before(function* () {
      server = helper.createServer();
      server.get("/token", auth({ name : "username", pass : "password" }), function* () {
        this.body   = { token : "atokenthingy" };
        this.status = 200;
      });

      yield server.start();
    });

    after(function* () {
      yield server.stop();
    });

    describe("with valid credentials", function () {
      let result;
      let restore;

      before(function* () {
        restore = helper.configure({ url : server.url });

        result = yield helper.run({
          arguments : "login",
          prompts   : [
            { pattern : /username: $/, value : "username" },
            { pattern : /password: $/, value : "password" }
          ]
        });
      });

      after(function () {
        restore();
      });

      it("creates a user token in the config file", function () {
        let config = new Config(helper.configFile);

        expect(config.get("token"), "token value").to.equal("atokenthingy");
      });

      it("prints a success message", function () {
        expect(result.output(), "output").to.match(/Successfully authenticated./);
      });

      it("exits with a zero status code", function () {
        expect(result, "exit status").to.have.property("status", 0);
      });
    });

    describe("with invalid credentials", function () {
      let result;
      let restore;

      before(function* () {
        restore = helper.configure({ url : server.url });

        result = yield helper.run({
          arguments : "login",
          prompts   : [
            { pattern : /username: $/, value : "bad" },
            { pattern : /password: $/, value : "credentials" }
          ]
        });
      });

      after(function () {
        restore();
      });

      it("does not update the config file", function () {
        let config = new Config(helper.configFile);

        expect(config.get("token"), "token value").not.to.exist;
      });

      it("prints a failure message", function () {
        expect(result.output(), "output").to.match(/Failed to authenticate./);
      });

      it("exits with a non-zero status code", function () {
        expect(result.status, "exit status").not.to.equal(0);
      });
    });
  });

  describe("when authenticated", function () {
    describe("listing the available service types", function () {
      it("prints a list of service types");

      it("exits with a zero status code");
    });
  });

  describe("when not authenticated", function () {
    describe("listing the available service types", function () {
      it("prints a failure message");

      it("exits with a non-zero status code");
    });
  });
});
