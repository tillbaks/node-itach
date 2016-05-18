/*jslint node:true white:true */
"use strict";

var net = require('net');
var async = require('async');
var config = require('./config');
var events = require('events');
var emitter = new events.EventEmitter();
var connection;

function log(type, message) {
  emitter.emit(type, message);
}

var command_queue = async.queue(function (data, callback) {

  var timeout, onData;

  onData = function onData(data) {

    clearTimeout(timeout);
    callback(undefined, data.replace(/[\n\r]$/, ""));
  };

  connection.write(data + "\r\n");
  connection.once("data", onData);

  timeout = setTimeout(function () {

    var error = new Error("No response received from server within timeout for command: " + data);
    connection.removeListener("data", onData);
    log("error", error);
    callback(error);

  }, config.send_timeout);
}, 1);

command_queue.pause();

function close() {
  command_queue.pause();
  connection.destroy();
}

function connect(object) {

  if (typeof object === "object") {
    Object.keys(object).forEach(function (key) {
      config[key] = object[key];
    });
  }

  if (connection === undefined) {

    log("debug","Connecting to " + config.host + ":" + config.port);

    connection = net.connect({ host: config.host, port: config.port});
    connection.setEncoding('utf8');

    connection.on('connect', function onConnect() {

      log("debug","Connected to " + config.host + ":" + config.port + " successfully");
      emitter.emit("connect");
      command_queue.resume();
    });

    connection.on('close', function onClose() {

      log("debug","Connection to " + config.host + ":" + config.port + " closed");
      command_queue.pause();
      emitter.emit("close");
    });

    connection.on('error', function onError(err) {

      command_queue.pause();
      log('error', new Error(err));
    });

  } else if (connection.remoteAddress === undefined) {

    log("debug","Re-connecting to " + config.host + ":" + config.port);

    connection.connect({ host: config.host, port: config.port});
  }
}

function send(data, callback) {

  log("debug", 'Queueing data to be sent: ' + data);

  command_queue.push(data, callback);
}

emitter.send = send;
emitter.connect = connect;
emitter.close = close;
module.exports = emitter;
