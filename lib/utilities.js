"use strict";
let debug = require("debug")("service_maker_cli:utilities");

module.exports = {

  wait : function* (seconds) {
    debug("waiting %d seconds", seconds);
    yield function (done) {
      setTimeout(done, seconds * 1000);
    };
  }

};
