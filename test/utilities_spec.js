"use strict";
let expect    = require("chai").expect;
let sinon     = require("sinon");
let utilities = require("../lib/utilities");

describe("The utility function", function () {
  describe("wait", function () {
    let timeoutStub;

    before(function* () {
      timeoutStub = sinon.stub(global, "setTimeout", function (task) {
        process.nextTick(task);
      });

      yield utilities.wait(5);
    });

    after(function () {
      timeoutStub.restore();
    });

    it("yields for a specified number of seconds", function () {
      expect(timeoutStub.calledWithMatch(sinon.match.func, 5000), "timeout").to.be.true;
    });
  });
});
