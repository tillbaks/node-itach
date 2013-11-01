/*jslint node:true*/
"use strict";
var self, itach, send_queue, config,
    net = require('net'),
    dgram = require('dgram'),
    util = require('util'),
    async = require('async'),
    events = require('events'),
    ERRORCODES = {
        '001': 'Invalid command. Command not found.',
        '002': 'Invalid module address (does not exist).',
        '003': 'Invalid connector address (does not exist).',
        '004': 'Invalid ID value.',
        '005': 'Invalid frequency value.',
        '006': 'Invalid repeat value.',
        '007': 'Invalid offset value.',
        '008': 'Invalid pulse count.',
        '009': 'Invalid pulse data.',
        '010': 'Uneven amount of <on|off> statements.',
        '011': 'No carriage return found.',
        '012': 'Repeat count exceeded.',
        '013': 'IR command sent to input connector.',
        '014': 'Blaster command sent to non-blaster connector.',
        '015': 'No carriage return before buffer full.',
        '016': 'No carriage return.',
        '017': 'Bad command syntax.',
        '018': 'Sensor command sent to non-input connector.',
        '019': 'Repeated IR transmission failure.',
        '020': 'Above designated IR <on|off> pair limit.',
        '021': 'Symbol odd boundary.',
        '022': 'Undefined symbol.',
        '023': 'Unknown option.',
        '024': 'Invalid baud rate setting.',
        '025': 'Invalid flow control setting.',
        '026': 'Invalid parity setting.',
        '027': 'Settings are locked'
    },
    requests = {},
    request_id = 0;

module.exports = self = new events.EventEmitter();

self.is_connected = false;

config = {
    port: 4998,
    reconnect: false,       // Reconnect if disconnected
    reconnect_sleep: 5      // Time in seconds between reconnection attempts
};

self.close = self.disconnect = function () {

    if (self.is_connected) {
        itach.destroy();
    }
};

self.connect = function (options) {

    var connection_properties;

    if (typeof options !== 'undefined') {
        if (typeof options.host !== 'undefined') { config.host = options.host; }
        if (typeof options.port !== 'undefined') { config.port = options.port; }
        if (typeof options.reconnect !== 'undefined') { config.reconnect = options.reconnect; }
        if (typeof options.reconnect_sleep !== 'undefined') { config.reconnect_sleep = options.reconnect_sleep; }
    }

    // If no host is configured we connect to the first device to answer
    if (typeof config.host === 'undefined' || config.host === '') {
        self.discover(function (hosts) {
            if (hosts.length > 0) {
                config.host = hosts[0].host;
                self.connect();
            }
            return;
        });
        return;
    }

    connection_properties = {
        host: config.host,
        port: config.port
    };

    self.emit("debug", 'Connecting to ' + config.host + ':' + config.port);

    if (typeof itach === 'undefined') {
        itach = net.connect(connection_properties);
    } else {
        itach.connect(connection_properties);
    }

    itach.on('connect', function () {

        self.is_connected = true;
        self.emit("debug", 'Connected to ' + config.host + ':' + config.port);
        self.emit('connect');
    });

    itach.on('close', function () {

        self.is_connected = false;
        self.emit("debug", 'Disconnected from ' + config.host + ':' + config.port);
        self.emit('close', false);

        if (config.reconnect) {

            setTimeout(self.connect, config.reconnect_sleep * 1000);
        }
    });

    itach.on('error', function (err) {

        self.emit('error', err);
    });

    itach.on('data', function (data) {

        var parts, id, result;

        data = data.toString().replace(/[\n\r]$/, "");

        self.emit("debug", "received data: " + data);

        parts = data.split(',');
        id = parts[2];

        if (requests[id] === undefined) {
            self.emit("error", "request_id " + id + " does not exist");
            return;
        }

        // result is true only when completeir received
        result = (parts[0] === 'completeir');

        if (parts[0].match(/^ERR/)) {

            self.emit("error", "itach error " + parts[1] + ": " + ERRORCODES[parts[1]]);
        }

        if (typeof requests[id].callback === 'function') {

            requests[id].callback({
                'result': result,
                'data': data
            });
        }
        delete requests[id];
    });

};

self.discover = function () {

    var timeout_timer, already_inserted, devices, timeout, callback, server,
        options = {},
        result = [],
        args = Array.prototype.slice.call(arguments),
        argv = args.length;

    if (argv === 1 && typeof args[0] === 'function') {
        callback = args[0];
    } else if (argv === 2 && typeof args[1] === 'function') {
        options = args[0];
        callback = args[1];
    } else {
        return false;
    }

    devices = options.devices || 1;
    timeout = options.timeout || 60;

    function close() {
        server.close();
        self.emit("debug", util.format("Discovered following hosts on network: %j", result));
        callback(result);
    }

    server = dgram.createSocket("udp4");

    server.bind(9131, function () {
        server.addMembership('239.255.250.250');
        timeout_timer = setTimeout(close, timeout * 1000);
    });

    server.on("message", function (packet, rinfo) {
        var part, parts, p, rtn = {};

        if (rinfo.port === 9131) {

            // Check if this host has already been inserted
            if (result.length > 0) {
                already_inserted = result.filter(function (host) {
                    return rinfo.address === host.host;
                });
                if (already_inserted.length > 0) { return; }
            }

            // Convert returned data to json
            parts = packet.toString().split(/><-|<-|>/);
            if (parts.length < 9) { return; }
            for (part in parts) {
                if (parts[part].indexOf('=') !== -1) {
                    p = parts[part].split('=');
                    rtn[p[0]] = p[1];
                }
            }

            rtn.host = rinfo.address;
            rtn.port = 4998;

            result.push(rtn);

            devices -= 1;
            if (devices < 1) {
                clearTimeout(timeout_timer);
                close();
            }
        }
    });
};

send_queue = async.queue(function (data, callback) {

    if (self.is_connected) {

        self.emit("debug", 'data sent: ' + data);
        itach.write(data + "\r\n");
        if (typeof callback === 'function') {
            callback({
                "result": true,
                "msg": ""
            });
        }
        return;
    }

    self.emit("error", "Not connected - Can not send data");
    self.emit("debug", data);
    if (typeof callback === 'function') {
        callback({
            "result": false,
            "msg": ""
        });
    }
    return;

}, 1);

/*
The allmighty send function
----------------------------------
input can be string:
    input = "Just a global cache ir code string"
or object:
    input.ir = "Just a global cache ir code string"
    input.options.module = "change the module the ir string that is sent out from"
    input.options.repeat = "change the repeat value in the ir string that is sent"

callback will be called when response is received
*/
self.send = function (input, callback) {

    var id, data, parts, options;

    request_id += 1;
    id = request_id;

    if (typeof input === 'object') {

        options = input.options || {};
        data = input.ir;

    } else {

        data = input;
    }

    parts = data.split(',');

    if (typeof options.module !== 'undefined') {
        parts[1] = '1:' + options.module;
    }
    parts[2] = id; // Add ID to keep track of return message
    if (typeof options.repeat !== 'undefined') {
        parts[4] = options.repeat;
    }
    data = parts.join(',');

    send_queue.push(data, function (res) {

        if (res.result) {

            requests[id] = {
                'id': id,
                'data': data,
                'callback': callback
            };

        } else {

            callback({
                "result": false,
                "msg": res.msg
            });
        }
    });

};