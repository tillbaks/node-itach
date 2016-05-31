"use strict";

var itach = require("./itach-core.js");
var config = require("./config");
/*
itach.get_NET;
itach.getdevices;
itach.getversion;
itach.setstate;
itach.set_IR;
itach.get_IR;
itach.stopir;
itach.getstate;
itach.get_IRL;
itach.stop_IRL;
*/
itach.sendir = function sendir(data, callback) {

  var parts;

  if (typeof data === "string") {
    return itach.enqueue(data, callback);
  }

  parts = data.ir.split(',');

  parts[0] = "sendir";
  if (data.module !== undefined) {
    parts[1] = data.module;
  }
  parts[2] = 666;
  if (data.frequency !== undefined) {
    parts[3] = data.frequency;
  }
  if (data.repeat !== undefined) {
    parts[4] = data.repeat;
  }
  if (data.offset !== undefined) {
    parts[5] = data.offset;
  }
  data = parts.join(',');

  itach.enqueue(data, callback);
};

module.exports = itach;
