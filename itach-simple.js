/*jslint node:true white:true */
"use strict";

var net = require("net");
var async = require("async");
var config = require("./config");
var events = require("events");
var emitter = new events.EventEmitter();
var connection;

var command_queue = async.queue(function (data, callback) {

  var timeout, error;

  function onData(data) {

    clearTimeout(timeout);
    error = (data.startsWith("ERR")) ? config.ERRORCODES[data.slice(-4, -1)] : undefined;
    callback(error, data);
  }

  connection.write(data);
  connection.once("data", onData);

  timeout = setTimeout(function () {

    connection.removeListener("data", onData);
    callback(new Error("No response within timeout period."));

  }, config.send_timeout);
}, 1);

command_queue.pause();

function close() {
  command_queue.pause();
  connection.destroy();
}

function connect(new_config) {

  if (typeof new_config === "object") {
    config = Object.assign(config, new_config);
  }

  if (connection === undefined) {

    connection = net.connect({ host: config.host, port: config.port});
    connection.setEncoding("utf8");

    connection.on("connect", function onConnect() {

      emitter.emit("connect");
      command_queue.resume();
    });

    connection.on("close", function onClose() {

      command_queue.pause();
      emitter.emit("close");
    });

    connection.on("error", function onError(err) {

      command_queue.pause();
      emitter.emit("error", new Error(err));
    });

  } else if (connection.remoteAddress === undefined) {

    connection.connect({ host: config.host, port: config.port});
  }
}

function send(data, callback) {

  if (!data.endsWith("\r\n")) {
    data = data + "\r\n";
  }

  command_queue.push(data, callback);
}

module.exports = {
  send: send,
  connect: connect,
  close: close,
  on: function (event, callback) {
    emitter.on(event, callback);
  }
};
