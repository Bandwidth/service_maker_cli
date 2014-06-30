"use strict";
let auth   = require("koa-basic-auth");
let cli    = require("../lib/cli");
let Config = require("../lib/Config");
let expect = require("chai").expect;
let helper = require("./helper");
let nock   = require("nock");

describe("The command line client", function () {

  describe("executing successfully", function () {
    let result;

    before(function* () {
      result = yield helper.run({ arguments : "--help" });
    });

    it("exits with a zero status code", function () {
      expect(result, "bad exit code").to.have.property("status", 0);
    });
  });

  describe("given an unknown command", function () {
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

});

describe("The command line library", function () {

  before(function () {
    nock.disableNetConnect();
  });

  after(function () {
    nock.enableNetConnect();
  });

  describe("when authenticated", function () {
    let restoreConfig;

    before(function () {
      restoreConfig = helper.configure({ token : "atoken" });
    });

    after(function () {
      restoreConfig();
    });

    describe("listing the available service types", function () {
      let output;

      before(function* () {
        let request = nock(cli.defaultUrl)
        .get("/serviceTypes")
        .reply(
          200,
          [
            { type : "demo" },
            { type : "host" },
            { type : "mail" }
          ]
        );

        output = yield helper.captureOutput(function* () {
          yield cli.run([ "node", "script", "types" ]);
        });
        request.done();
      });

      it("prints a list of service types", function () {
        expect(output, "header").to.match(/service types/i);
        expect(output, "demo").to.match(/demo/);
        expect(output, "host").to.match(/host/);
        expect(output, "mail").to.match(/mail/);
      });
    });

    describe("listing the available services", function () {
      let output;

      before(function* () {
        let request = nock(cli.defaultUrl)
        .get("/services")
        .reply(
          200,
          [
            {
              type : "demo",
              data : {
                url : "http://example.com"
              }
            },
            {
              type : "mail",
              data : {
                domain : "example.com"
              }
            }
          ]
        );

        output = yield helper.captureOutput(function* () {
          yield cli.run([ "node", "script", "services" ]);
        });
        request.done();
      });

      it("prints a list of services", function () {
        expect(output, "header").to.match(/services/i);
        expect(output, "demo service").to.match(/demo/);
        expect(output, "demo service").not.to.match(/url/);
        expect(output, "mail service").to.match(/mail/);
        expect(output, "mail service").not.to.match(/domain/);
      });
    });
  });

  describe("when not authenticated", function () {
    const SUGGESTION   = /maybe try `service-maker login`/;
    const UNAUTHORIZED = /unauthorized/i;

    let restoreConfig;

    before(function* () {
      restoreConfig = helper.configure({ token : "atoken" });
    });

    after(function* () {
      restoreConfig();
    });

    describe("listing the available service types", function () {
      let failure;

      before(function* () {
        let request = nock(cli.defaultUrl)
        .get("/serviceTypes")
        .reply(403);

        try {
          yield cli.run([ "node", "script", "types" ]);
        }
        catch (error) {
          failure = error;
        }

        request.done();
      });

      it("exits with an error", function () {
        expect(failure, "no error").to.be.an.instanceOf(Error);
        expect(failure.message, "error message").to.match(UNAUTHORIZED);
        expect(failure.message, "error message").to.match(SUGGESTION);
      });
    });

    describe("listing the available services" ,function () {
      let failure;

      before(function* () {
        let request = nock(cli.defaultUrl)
        .get("/services")
        .reply(403);

        try {
          yield cli.run([ "node", "script", "services" ]);
        }
        catch (error) {
          failure = error;
        }

        request.done();
      });

      it("exits with an error", function* () {
        expect(failure, "no error").to.be.an.instanceOf(Error);
        expect(failure.message, "error message").to.match(UNAUTHORIZED);
        expect(failure.message, "error message").to.match(SUGGESTION);
      });
    });
  });
});
