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
    request_id = 0,
    queue;

module.exports = self = new events.EventEmitter();

self.is_connected = false;

config = {
    port: 4998,
    send_delay: 100,        // Delay between transmitting IR so we don't get too many busyIR responses
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
        config.host = options.host || config.host;
        config.port = options.port || config.port;
        config.reconnect = options.reconnect || config.reconnect;
        config.reconnect_sleep = options.reconnect_sleep || config.reconnect_sleep;
        config.send_delay = options.send_delay || config.send_delay;
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

        queue = new MessageQueue({
            send_delay: config.send_delay
        });

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

        if (parts[0] === 'completeir') {
            queue.onComplete(id);
        }

        if (parts[0] === 'busyIR') {

            // This shound not happen if this script is the only device connected to the itach
            return;

        } else if (parts[0].match(/^ERR/)) {

            self.emit("error", "itach error " + parts[1] + ": " + ERRORCODES[parts[1]]);
            queue.onError();
        }
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
        callback(false, result);
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

    var id, data, parts, options = {};

    request_id += 1;
    id = request_id;

    if (typeof input === 'object') {

        options = input.options || options;
        data = input.ir;

    } else {

        options = {};
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

    // Add message to the queue
    queue.push({
        'id': id,
        'data': data,
        'callback': callback
    });
};

function MessageQueue (options) {

    var q = {},
        message_queue = [],
        is_transmitting = 0;

    // Remove message from queue with this id
    function queueRemove (id, index) {

        id = parseInt(id, 10);
        if (id === is_transmitting) {

            is_transmitting = 0;
        }

        if (index) {

            message_queue.splice(index, 1);

        } else {

            message_queue.forEach(function (item, index, message_queue) {
                if (item.id === id) {
                    message_queue.splice(index, 1);
                }
            });
        }
    }

    // Remove a few seconds old queue items since it should not take that long to get a response
    function queueRemoveOld () {
        var queue_items = message_queue.length;

        message_queue.forEach(function (item, index, message_queue) {
            if (item.added < Date.now() - (4 * 1000)) {
                queueRemove(item.id, index);
                queue_items -= 1;
            }
        });

        queueSend();
        if (queue_items > 0) {
            setTimeout(queueRemoveOld, config.send_delay);
        }
    }

    // Sends first message in queue
    function queueSend () {

        if (self.is_connected && is_transmitting === 0 && message_queue.length > 0) {

            var obj = message_queue.shift();
            is_transmitting = obj.id;
            self.emit("debug", 'sending data: ' + obj.data);
            
            itach.write(obj.data + "\r\n");
            obj.callback(false);
        }
        return;
    }

    // Call this when completedir is received
    q.onComplete = function (id) {

        // Delay is required if you want to be able to send multiple commands quickly one after the other
        setTimeout(function () {
            queueRemove(id);
            queueSend();
        }, options.send_delay);
    }

    // Call this when error is received
    q.onError = function () {
        queueRemoveOld();
    }

    // Add message to queue
    q.push = function (obj) {
        obj.added = Date.now();
        message_queue.push(obj);

        queueSend();
    }

    return q;
}