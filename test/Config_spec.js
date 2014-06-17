"use strict";
let Config = require("../lib/Config");
let expect = require("chai").expect;
let fs     = require("fs");
let path   = require("path");

describe("A client configuration", function () {
  const TEST_FILE = path.join(__dirname, "test.json");

  describe("using an existing file", function () {
    let config;

    beforeEach(function () {
      fs.writeFileSync(TEST_FILE, JSON.stringify({  key : "value" }));
      config = new Config(TEST_FILE);
    });

    afterEach(function () {
      fs.unlinkSync(TEST_FILE);
    });

    describe("reading an existing key", function () {
      let value;

      beforeEach(function () {
        value = config.get("key");
      });

      it("returns the key value", function () {
        expect(value, "value").to.equal("value");
      });
    });

    describe("reading an existing key with a default value", function () {
      let value;

      beforeEach(function () {
        value = config.get("key", "default");
      });

      it("returns the key value", function () {
        expect(value, "value").to.equal("value");
      });
    });

    describe("reading a non-existant key", function () {
      let value;

      beforeEach(function () {
        value = config.get("foo");
      });

      it("returns 'undefined'", function () {
        expect(value, "value").to.be.undefined;
      });
    });

    describe("reading a non-existant key with a default value", function () {
      let value;

      beforeEach(function () {
        value = config.get("foo", "bar");
      });

      it("returns the default value", function () {
        expect(value, "value").to.equal("bar");
      });
    });

    describe("setting a key", function () {
      let value;

      beforeEach(function () {
        config.set("key", "bar");
        value = config.get("key");
      });

      it("updates the value", function () {
        expect(value, "value").to.equal("bar");
      });
    });
  });

  describe("using a non-existant file", function () {
    let config;

    beforeEach(function () {
      config = new Config(TEST_FILE);
    });

    afterEach(function () {
      try {
        fs.unlinkSync(TEST_FILE);
      }
      catch (error) {
        // Do nothing
      }
    });

    describe("reading a key", function () {
      let value;

      beforeEach(function () {
        value = config.get("foo");
      });

      it("returns 'undefined'", function () {
        expect(value, "value").to.be.undefined;
      });

      it("does not create the file", function () {
        expect(fs.existsSync(TEST_FILE), "file exists").to.be.false;
      });
    });

    describe("setting a key", function () {
      let value;

      beforeEach(function () {
        config.set("foo", "bar");
        value = config.get("foo");
      });

      it("creates the file", function () {
        expect(fs.existsSync(TEST_FILE), "file does not exist").to.be.true;
      });

      it("sets the key value", function () {
        expect(value, "value").to.equal("bar");
      });
    });
  });
});
