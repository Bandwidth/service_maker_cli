"use strict";
let expect       = require("chai").expect;
let nock         = require("nock");
let ServiceMaker = require("../lib/ServiceMaker");

describe("A Service Maker client", function () {
  const ACCESS_TOKEN  = "atokenthingy";
  const AUTHORIZATION = "token " + ACCESS_TOKEN;
  const BASE_URL      = "http://localhost";
  const PASSWORD      = "password";
  const USERNAME      = "username";

  const BASIC_AUTH = "Basic " + (new Buffer(USERNAME + ":" + PASSWORD)).toString("base64");

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
      .matchHeader("Authorization", BASIC_AUTH)
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
        .matchHeader("Authorization", AUTHORIZATION)
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
        expect(types, "service type list").to.have.members([ "demo", "host", "mail" ]);
      });
    });
  });

  describe("with invalid basic credentials", function () {
    let client;

    before(function () {
      nock(BASE_URL).persist()
      .matchHeader("Authorization", BASIC_AUTH)
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
      yield expectFailure(/invalid credentials/i, function* () {
        yield client.login();
      });
    });

    it("fails to list the available service types", function* () {
      yield expectFailure(/invalid credentials/i, function* () {
        yield client.serviceTypes.describe();
      });
    });
  });

  describe("with an invalid access token", function () {
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

      yield expectFailure(/invalid access token/i, function* () {
        yield client.serviceTypes.describe();
      });
    });
  });
});
