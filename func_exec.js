/*jslint node:true white:true */
"use strict";

var jobs = [];
var skip_time = 0;
var sleep_time = 0;
var state = 'stopped';

function exec() {
  var job;
  if (jobs.length < 1 || state !== "waiting") {
    return;
  }
  job = jobs.shift();
  if (skip_time > 0 && Date.now() >= job.added + skip_time) {
    exec();
    return;
  }
  state = "executing";
  job.func(function job_callback() {
    if (state === "executing") {
      state = "waiting";
      setTimeout(exec, sleep_time);
    }
  });
}

function add(func) {
  jobs.push({func: func, added: Date.now()});
  exec();
}

function start() {
  if (state !== "stopped") {
    return;
  }
  state = "waiting";
  exec();
}

function stop() {
  state = "stopped";
}

function parse_time(time) {

  if (typeof time === "number") {
    return time;
  }
  if (typeof time === "string") {
    return (time.endsWith("ms")) ? parseFloat(time) : parseFloat(time) * 1000;
  }
  return 0;
}

module.exports = function func_exec(object) {
  if (typeof object === "object") {
    skip_time = parse_time(object.skip_time);
    sleep_time = parse_time(object.sleep_time);
  }

  return {
    add: add,
    start: start,
    stop: stop
  };
};
