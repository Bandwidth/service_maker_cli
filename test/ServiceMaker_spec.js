"use strict";
let expect       = require("chai").expect;
let nock         = require("nock");
let ServiceMaker = require("../lib/ServiceMaker");
let sinon        = require("sinon");
let url          = require("url");
let utilities    = require("../lib/utilities");

describe("A Service Maker client", function () {
  const ACCESS_TOKEN  = "atokenthingy";
  const AUTHORIZATION = "token " + ACCESS_TOKEN;
  const BASE_URL      = "http://localhost";
  const PASSWORD      = "password";
  const USERNAME      = "username";

  //const BASIC_AUTH = "Basic " + (new Buffer(USERNAME + ":" + PASSWORD)).toString("base64");

  const INVALID_ACCESS_TOKEN = /invalid access token/i;
  const INVALID_CREDENTIALS  = /invalid credentials/i;

  function* expectFailure (message, generator) {
    let failure;

    try {
      yield generator;
    } catch (error) {
      failure = error;
    }

    expect(failure, "no error").to.exist;
    expect(failure, "error type").to.be.an.instanceOf(Error);
    expect(failure.message, "error message").to.match(message);
  }

  before(function () {
    nock.disableNetConnect();
  });

  after(function () {
    nock.enableNetConnect();
  });

  describe("with a valid configuration", function () {
    let client;

    before(function* () {
      nock(BASE_URL).persist()
      //.matchHeader("Authorization", BASIC_AUTH)
      .get("/token")
      .reply(200, { token : ACCESS_TOKEN });

      client = new ServiceMaker({
        password : PASSWORD,
        url      : BASE_URL,
        username : USERNAME
      });
    });

    after(function () {
      nock.cleanAll();
    });

    describe("manually logging in", function () {
      let token;

      before(function* () {
        token = yield client.login();
      });

      it("returns an access token", function () {
        expect(token, "wrong token").to.equal(ACCESS_TOKEN);
      });
    });

    describe("listing all available service types", function () {
      let types;

      before(function* () {
        let request = nock(BASE_URL)
        //.matchHeader("Authorization", AUTHORIZATION)
        .get("/serviceTypes")
        .reply(
          200,
          [
            { type : "demo" },
            { type : "host" },
            { type : "mail" }
          ]
        );
        types = yield client.serviceTypes.describe();
        request.done();
      });

      it("returns a list of service types", function () {
        expect(types, "number of service types").to.have.length(3);
        expect(types.map(function(t){return t.type;}), "service type list").to.have.members([ "demo", "host", "mail" ]);
      });
    });

    describe("listing the available services", function () {
      let services = [
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

      let result;

      before(function* () {
        let request = nock(BASE_URL)
        //.matchHeader("Authorization", AUTHORIZATION)
        .get("/services")
        .reply(200, services);

        result = yield client.services.describe();
        request.done();
      });

      it("returns a list of services", function () {
        expect(result, "service list").to.deep.equal(services);
      });
    });

    describe("provisioning a service", function () {
      const JOB_ID   = "ajob";
      const JOB_PATH = "/jobs/" + JOB_ID;
      const JOB_URL  = url.resolve(BASE_URL, JOB_PATH);

      const SERVICE_ID   = "aservice";
      const SERVICE_PATH = "/services/" + SERVICE_ID;
      const SERVICE_URL  = url.resolve(BASE_URL, SERVICE_PATH);

      function jobRequest (status) {
        let job = { status : status };

        if (status === "COMPLETE") {
          job.service = {
            id  : SERVICE_ID,
            url : SERVICE_URL
          };
        }

        return nock(BASE_URL)
        //.matchHeader("Authorization", AUTHORIZATION)
        .get(JOB_PATH)
        .reply(200, { status : "PENDING" })
        .get(JOB_PATH)
        .reply(200, job);
      }

      function provisionRequest () {
        return nock(BASE_URL)
        //.matchHeader("Authorization", AUTHORIZATION)
        .post("/services", { type : "demo" })
        .reply(
          202,
          {
            job : {
              id  : JOB_ID,
              url : JOB_URL
            }
          }
        );
      }

      describe("without error", function () {
        let result;
        let waitStub;

        before(function* () {
          let job       = jobRequest("COMPLETE");
          let provision = provisionRequest();

          let service = nock(BASE_URL)
          //.matchHeader("Authorization", AUTHORIZATION)
          .get(SERVICE_PATH)
          .reply(
            200,
            {
              type : "demo",
              data : {
                url : "http://example.com"
              }
            }
          );

          waitStub = sinon.stub(utilities, "wait", function* () {});
          result   = yield client.services.create("demo");
          job.done();
          provision.done();
          service.done();
        });

        after(function () {
          waitStub.restore();
        });

        it("returns a description of the service", function () {
          expect(result, "type").to.have.property("type", "demo");
          expect(result, "data").to.have.property("data");
          expect(result.data, "url").to.have.property("url", "http://example.com");
        });
      });

      describe("with an error", function () {
        let failure;
        let waitStub;

        before(function* () {
          let job       = jobRequest("ERROR");
          let provision = provisionRequest();

          waitStub = sinon.stub(utilities, "wait", function* () {});

          try {
            yield client.services.create("demo");
          }
          catch (error) {
            failure = error;
          }

          job.done();
          provision.done();
        });

        after(function () {
          waitStub.restore();
        });

        it("fails", function () {
          expect(failure, "no error").to.be.an.instanceOf(Error);
          expect(failure.message, "error message").to.match(/provisioning failed/i);
        });
      });

      describe("that takes too long", function () {
        let failure;
        let nowStub;
        let waitStub;

        before(function* () {
          let job       = jobRequest("PENDING");
          let provision = provisionRequest();
          let start     = Date.now();

          waitStub = sinon.stub(utilities, "wait", function* () {
            nowStub = sinon.stub(Date, "now").returns(start + 10 * 60 * 10000);
          });

          try {
            yield client.services.create("demo");
          }
          catch (error) {
            failure = error;
          }

          job.done();
          provision.done();
        });

        after(function () {
          nowStub.restore();
          waitStub.restore();
        });

        it("times out", function () {
          expect(failure, "no error").to.be.an.instanceOf(Error);
          expect(failure.message, "error message").to.match(/timed out/i);
        });
      });
    });
  });

  describe.skip("with invalid basic credentials", function () {
    let client;

    before(function () {
      nock(BASE_URL).persist()
      //.matchHeader("Authorization", BASIC_AUTH)
      .get("/token")
      .reply(403);

      client = new ServiceMaker({
        password : PASSWORD,
        url      : BASE_URL,
        username : USERNAME
      });
    });

    after(function () {
      nock.cleanAll();
    });

    it("fails to manually login", function* () {
      yield expectFailure(INVALID_CREDENTIALS, function* () {
        yield client.login();
      });
    });

    it("fails to list the available service types", function* () {
      yield expectFailure(INVALID_CREDENTIALS, function* () {
        yield client.serviceTypes.describe();
      });
    });

    it("fails to list the available services", function* () {
      yield expectFailure(INVALID_CREDENTIALS, function* () {
        yield client.services.describe();
      });
    });

    it("fails to provision a service", function* () {
      yield expectFailure(INVALID_CREDENTIALS, function* () {
        yield client.services.create("demo");
      });
    });
  });

  describe.skip("with an invalid access token", function () {
    let client;
    let request;

    before(function () {
      request = nock(BASE_URL).matchHeader("Authorization", AUTHORIZATION);

      client = new ServiceMaker({
        token : ACCESS_TOKEN,
        url   : BASE_URL
      });
    });

    after(function () {
      request.done();
    });

    it("fails to list the available service types", function* () {
      request = request.get("/serviceTypes").reply(403);

      yield expectFailure(INVALID_ACCESS_TOKEN, function* () {
        yield client.serviceTypes.describe();
      });
    });

    it("fails to list the available services", function* () {
      request = request.get("/services").reply(403);

      yield expectFailure(INVALID_ACCESS_TOKEN, function* () {
        yield client.services.describe();
      });
    });

    it("fails to provision a service", function* () {
      request = request.post("/services").reply(403);

      yield expectFailure(INVALID_ACCESS_TOKEN, function* () {
        yield client.services.create("demo");
      });
    });
  });
});
