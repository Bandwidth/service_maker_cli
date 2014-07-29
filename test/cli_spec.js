"use strict";
let auth         = require("koa-basic-auth");
let cli          = require("../lib/cli");
let Config       = require("../lib/Config");
let expect       = require("chai").expect;
let helper       = require("./helper");
let nock         = require("nock");
let ServiceMaker = require("../lib/ServiceMaker");
let sinon        = require("sinon");

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

  describe.skip("when authenticated", function () {
    describe("listing the available service types", function () {
      let output;
      let stub;

      before(function* () {
        let client = new ServiceMaker();

        stub = sinon.stub(client.serviceTypes, "describe", function* () {
          return [ "demo", "host", "mail" ];
        });

        output = yield helper.captureOutput(function* () {
          yield cli.run(
            function () { return client; },
            [ "node", "script", "types" ]
          );
        });
      });

      after(function () {
        stub.restore();
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
      let stub;

      before(function* () {
        let client = new ServiceMaker();

        stub = sinon.stub(client.services, "describe", function* () {
          return [
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
          ];
        });

        output = yield helper.captureOutput(function* () {
          yield cli.run(
            function () { return client; },
            [ "node", "script", "services" ]
          );
        });
      });

      after(function () {
        stub.restore();
      });

      it("prints a list of services", function () {
        expect(output, "header").to.match(/services/i);
        expect(output, "demo service").to.match(/demo/);
        expect(output, "demo service").not.to.match(/url/);
        expect(output, "mail service").to.match(/mail/);
        expect(output, "mail service").not.to.match(/domain/);
      });
    });

    describe("provisioning a service", function () {
      let output;
      let stub;

      before(function* () {
        let client = new ServiceMaker();

        stub = sinon.stub(client.services, "create", function* (type) {
          return {
            type : type,
            data : {
              url : "http://example.com"
            }
          };
        });

        output = yield helper.captureOutput(function* () {
          yield cli.run(
            function () { return client; },
            [ "node", "script", "service-create", "demo" ]
          );
        });
      });

      after(function () {
        stub.restore();
      });

      it("prints a description of the new service", function () {
        expect(output, "service type").to.match(/type\s+\S+\s+demo/i);
        expect(output, "url").to.match(/url\s+\S+\s+http:\/\/example\.com/i);
      });
    });
  });

  describe("when not authenticated", function () {
    const SUGGESTION   = /maybe try `service-maker login`/;
    const UNAUTHORIZED = /unauthorized/i;

    describe("listing the available service types", function () {
      let failure;
      let stub;

      before(function* () {
        let client = new ServiceMaker();

        stub = sinon.stub(client.serviceTypes, "describe", function* () {
          throw new Error("Invalid access token");
        });

        try {
          yield cli.run(
            function () { return client; },
            [ "node", "script", "types" ]
          );
        }
        catch (error) {
          failure = error;
        }
      });

      after(function () {
        stub.restore();
      });

      it("exits with an error", function () {
        expect(failure, "no error").to.be.an.instanceOf(Error);
        expect(failure.message, "error message").to.match(UNAUTHORIZED);
        expect(failure.message, "error message").to.match(SUGGESTION);
      });
    });

    describe("listing the available services" ,function () {
      let failure;
      let stub;

      before(function* () {
        let client = new ServiceMaker();

        stub = sinon.stub(client.services, "describe", function* () {
          throw new Error("Invalid access token");
        });

        try {
          yield cli.run(
            function () { return client; },
            [ "node", "script", "services" ]
          );
        }
        catch (error) {
          failure = error;
        }
      });

      after(function () {
        stub.restore();
      });

      it("exits with an error", function* () {
        expect(failure, "no error").to.be.an.instanceOf(Error);
        expect(failure.message, "error message").to.match(UNAUTHORIZED);
        expect(failure.message, "error message").to.match(SUGGESTION);
      });
    });

    describe("provisioning a service", function () {
      let failure;
      let stub;

      before(function* () {
        let client = new ServiceMaker();

        stub = sinon.stub(client.services, "create", function* () {
          throw new Error("Invalid access token");
        });

        try {
          yield cli.run(
            function () { return client; },
            [ "node", "script", "service-create", "demo" ]
          );
        }
        catch (error) {
          failure = error;
        }
      });

      after(function () {
        stub.restore();
      });

      it("exits with an error", function* () {
        expect(failure, "no error").to.be.an.instanceOf(Error);
        expect(failure.message, "error message").to.match(UNAUTHORIZED);
        expect(failure.message, "error message").to.match(SUGGESTION);
      });
    });
  });
});
