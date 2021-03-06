"use strict";
let fs = require("fs");

function Config (filePath) {
  function readFile () {
    let config = Object.create(null);

    try {
      config = JSON.parse(fs.readFileSync(filePath));
    }
    catch (error) {
      // Do nothing.
    }

    return config;
  }

  function writeFile (contents) {
    fs.writeFileSync(filePath, JSON.stringify(contents));
  }

  this.get = function (key, defaultValue) {
    let config = readFile();

    return key in config ? config[key] : defaultValue;
  };

  this.set = function (key, value) {
    let config = readFile();

    config[key] = value;
    writeFile(config);
  };
}

module.exports = Config;
