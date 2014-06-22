"use strict";
let debug   = require("debug")("service_maker_cli:ServiceMaker");
let q       = require("q");
let request = require("superagent");
let url     = require("url");
let _       = require("lodash");

function Client (options) {
  let token = options.token;
  let self  = this;

  function* authorizeRequest (apiRequest) {
    if (! token) {
      yield self.login();
    }

    apiRequest.set("Authorization", "token " + token);
  }

  this.get = function* (endpoint) {
    let clientRequest = request.get(url.resolve(options.url, endpoint));
    let response;

    yield authorizeRequest(clientRequest);
    response = yield q.ninvoke(clientRequest, "end");

    if (response.statusCode === 403) {
      throw new Error("Invalid access token");
    }

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

}

function Services (client) {
  this.describe = function* () {
    let response = yield client.get("/services");

    return response.body;
  };
}

function ServiceTypes (client) {
  this.describe = function* () {
    let response = yield client.get("/serviceTypes");

    return _.pluck(response.body, "type");
  };
}

function ServiceMaker (options) {
  let client = new Client(options);

  this.login        = client.login.bind(client);
  this.services     = new Services(client);
  this.serviceTypes = new ServiceTypes(client);
}

module.exports = ServiceMaker;
