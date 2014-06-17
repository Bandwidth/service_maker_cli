"use strict";
let api          = require("..");
let expect       = require("chai").expect;
let ServiceMaker = require("../lib/ServiceMaker");

describe("The Service Maker library", function () {
  it("exposes the ServiceMaker API", function () {
    expect(api, "API object").to.equal(ServiceMaker);
  });
});

