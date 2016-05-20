/*jslint node:true white:true */
"use strict";

var net = require("net");
var async = require("async");
var events = require("events");
var itach = new events.EventEmitter();
var config = require("./config");
var socket;

var command_queue = async.queue(function (data, callback) {

  var timeout;

  function onData(data) {

    clearTimeout(timeout);
    callback(
      (data.startsWith("ERR")) ? config.ERRORCODES[data.slice(-4, -1)] : undefined,
      data.slice(0, -1)
    );
  }

  socket.write(data);
  socket.once("data", onData);

  timeout = setTimeout(function () {

    socket.removeListener("data", onData);
    callback(new Error("No response within timeout period."));

  }, config.send_timeout);

}, 1);
command_queue.pause();

itach.close = function close() {
  command_queue.pause();
  socket.destroy();
  if (config.reconnect) {
    setTimeout(itach.connect, config.reconnect_sleep);
  }
};

itach.connect = function connect(new_config) {

  if (typeof new_config === "object") {
    config = Object.assign(config, new_config);
  }

  if (socket === undefined) {

    socket = net.connect({ host: config.host, port: config.port});
    socket.setEncoding("utf8");

    socket.on("connect", function onConnect() {

      itach.emit("connect");
      command_queue.resume();
    });

    socket.on("close", function onClose() {

      command_queue.pause();
      itach.emit("close");
    });

    socket.on("error", function onError(err) {

      command_queue.pause();
      itach.emit("error", new Error(err));
    });

  } else if (socket.remoteAddress === undefined) {

    socket.connect({ host: config.host, port: config.port});
  }
};

itach.enqueue = function enqueue(data, callback) {

  if (!data.endsWith("\r\n")) {
    data = data + "\r\n";
  }
  command_queue.push(data, callback);
};

module.exports = itach;
