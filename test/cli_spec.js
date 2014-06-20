"use strict";
let auth   = require("koa-basic-auth");
let Config = require("../lib/Config");
let expect = require("chai").expect;
let helper = require("./helper");

describe("The command line client", function () {

  describe("given an unknow command", function () {
    let result;

    before(function* () {
      result = yield helper.run({ arguments : "foo" });
    });

    it("exits with a non-zero status code", function () {
      expect(result.status, "exit code").not.to.equal(0);
    });

    it("displays an error message", function () {
      expect(result.output(), "error message").to.match(/unknown command/i);
    });
  });

  describe("given no command", function () {
    let result;

    before(function* () {
      result = yield helper.run();
    });

    it("exits with a non-zero status code", function () {
      expect(result.status, "exit code").not.to.equal(0);
    });

    it("displays the usage information", function () {
      expect(result.output(), "usage message").to.match(/usage:/i);
    });
  });

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
      let server;
      let result;
      let restore;

      before(function* () {
        server = helper.createServer();
        server.get("/serviceTypes", function* () {
          this.body = [
            { type : "demo" },
            { type : "host" },
            { type : "mail" }
          ];

          this.status = 200;
        });

        yield server.start();
        restore = helper.configure({ token : "atoken", url : server.url });

        result = yield helper.run({ arguments : "types" });
      });

      after(function* () {
        yield server.stop();
        restore();
      });

      it("prints a list of service types", function () {
        let output = result.output();

        expect(output, "header").to.match(/available service types/i);
        expect(output, "demo").to.match(/demo/);
        expect(output, "host").to.match(/host/);
        expect(output, "mail").to.match(/mail/);
      });

      it("exits with a zero status code", function () {
        expect(result, "exit status").to.have.property("status", 0);
      });
    });
  });

  describe("when not authenticated", function () {
    let restore;
    let server;

    before(function* () {
      server = helper.createServer();
      server.use(function* () {
        this.status = 403;
      });

      yield server.start();
      restore = helper.configure({ token : "atoken", url : server.url });
    });

    after(function* () {
      yield server.stop();
      restore();
    });

    describe("listing the available service types", function () {
      let result;

      before(function* () {
        result = yield helper.run({ arguments : "types" });
      });

      it("prints a failure message", function () {
        let output = result.output();

        expect(output, "authentication message").to.match(/unauthorized/i);
        expect(output, "suggestion message").to.match(/maybe try `service-maker login`/);
      });

      it("exits with a non-zero status code", function () {
        expect(result.status, "exit status").not.to.equal(0);
      });
    });
  });
});
