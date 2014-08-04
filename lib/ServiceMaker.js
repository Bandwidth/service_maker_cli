"use strict";
let debug     = require("debug")("service_maker_cli:ServiceMaker");
let q         = require("q");
let request   = require("superagent");
let url       = require("url");
let utilities = require("./utilities");

function Client (options) {
  let token = options.token;
  let self = this;
  function* authorizeRequest (apiRequest) {
    if (! token) {
      yield self.login();
    }

    apiRequest.set("Authorization", "token " + token);
  }

  function resolveUrl (endpoint) {
    if (endpoint.match(/^http:\/\//)) {
      return endpoint;
    }

    return url.resolve(options.url, endpoint);
  }

  function handleErrors (response) {
    if (response.statusCode === 403) {
      throw new Error("Invalid access token");
    }
    if (response.statusCode === 400) {
      throw new Error("Invalid parameters");
    }
  }

  this.get = function* (endpoint) {
    let clientRequest = request.get(resolveUrl(endpoint));
    let response;

    yield authorizeRequest(clientRequest);
    response = yield q.ninvoke(clientRequest, "end");
    handleErrors(response);

    return response;
  };

  this.post = function* (endpoint, payload) {
    let clientRequest = request.post(resolveUrl(endpoint)).send(payload);
    let response;

    debug("post '%j' to '%s'", payload, endpoint);
    yield authorizeRequest(clientRequest);
    response = yield q.ninvoke(clientRequest, "end");
    handleErrors(response);

    return response;
  };

  this.login = function* () {
    let clientRequest;
    let response;

    clientRequest = request(url.resolve(options.url, "/token")).auth(options.username, options.password);
    response      = yield q.ninvoke(clientRequest, "end");

    debug("server responded with %d", response.statusCode);
    switch (response.statusCode) {
      case 200:
        token = response.body.token;
        break;
      default:
        throw new Error("Invalid credentials");
    }

    return token;
  };

  this.signup = function* () {
    let clientRequest;
    let response;

    clientRequest = request.post(url.resolve(options.url, "/signup")).send({
      username: options.username,
      password: options.password,
      repeatPassword: options.repeatPassword
    });
    response      = yield q.ninvoke(clientRequest, "end");

    debug("server responded with %d", response.statusCode);
    switch (response.statusCode) {
      case 200:
        token = response.body.token;
        break;
      default:
        throw new Error("Invalid credentials");
    }

    return token;
  };

}

function Services (client) {
  const PROVISIONING_TIMEOUT = 5 * 60 * 1000;   // 5 minutes

  this.create = function* (type, provider, parameters) {
    let provision = yield client.post("/services", { type: type, name: provider, parameters: parameters });
    let job       = yield client.get(provision.body.job.url);
    let start     = Date.now();
    let service;

    while (job.body.status === "PENDING") {
      if (Date.now() - start > PROVISIONING_TIMEOUT) {
        throw new Error("Provisioning timed out");
      }

      yield utilities.wait(1);
      job = yield client.get(provision.body.job.url);
    }

    if (job.body.status === "COMPLETE") {
      service = yield client.get(job.body.service.url);
    }
    else {
      throw new Error("Provisioning failed");
    }

    return service.body;
  };

  this.describe = function* () {
    let response = yield client.get("/services");

    return response.body;
  };
}

function ServiceTypes (client) {
  this.describe = function* () {
    let response = yield client.get("/serviceTypes");

    return response.body;
  };
}

function ServiceMaker (options) {
  let client = new Client(options || {});

  this.login        = client.login.bind(client);
  this.signup        = client.signup.bind(client);
  this.services     = new Services(client);
  this.serviceTypes = new ServiceTypes(client);
}

module.exports = ServiceMaker;
