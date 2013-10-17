var net = require('net'),
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
    };

function iTach(options) {

    var self = this,
        requests = {},
        request_id = 0,
        send_queue, itach, defaults;

    self.is_connected = false;

    defaults = {
        "host": "10.0.0.4",
        "port": 4998,
        "reconnect": true, // Reconnect if disconnected
        "reconnect_sleep": 5000 // Time between reconnection attempts
    };

    options.host = options.host || defaults.host;
    options.port = options.port || defaults.port;
    options.reconnect = options.reconnect || defaults.reconnect;
    options.reconnect_sleep = options.reconnect_sleep || defaults.reconnect_sleep;

    self.connect = function() {

        var connection_properties;

        connection_properties = {
            host: options.host,
            port: options.port
        };

        self.emit("debug", 'Connecting to ' + options.host + ':' + options.port);

        if (typeof itach === 'undefined') {

            itach = net.connect(connection_properties);
            return;
        }
        itach.connect(connection_properties);
        return;
    };
    self.connect();

    itach.on('connect', function() {

        self.is_connected = true;
        self.emit("debug", 'Connected to ' + options.host + ':' + options.port);
        self.emit('connect');
    });

    itach.on('close', function() {

        self.is_connected = false;
        self.emit("debug", 'Disconnected from ' + options.host + ':' + options.port);
        self.emit('close', false);

        if (options.reconnect) {

            setTimeout(self.connect, options.reconnect_sleep);
        }
    });

    itach.on('error', function(err) {

        self.emit('error', err);
    });

    itach.on('data', function(data) {

        var splitted, id, result;

        data = data.toString().replace(/[\n\r]$/, "");

        self.emit("debug", "received data: " + data);

        splitted = data.split(',');
        id = splitted[2];

        if (requests[id] === undefined) {
            self.emit("error", "request_id " + id + " does not exist");
            return;
        }

        // result is true only when completeir received
        result = (splitted[0] === 'completeir');

        if (splitted[0].match(/^ERR/)) {

            self.emit("error", "itach error " + splitted[1] + ": " + ERRORCODES[splitted[1]]);
        }

        if (typeof requests[id].callback === 'function') {

            requests[id].callback({
                'result': result,
                'data': data
            });
        }
        delete requests[id];
    });

    send_queue = async.queue(function(data, callback) {

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
    self.send = function(input, callback) {

        var id = request_id++,
            data, parts, options;

        if (typeof data === 'object') {

            options = input.options || {},
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

        send_queue.push(data, function(res) {

            if (res.result) {

                requests[id] = {
                    'id': id,
                    'data': data,
                    'callback': callback
                };

            }
            else {

                callback({
                    "result": false,
                    "msg": res.msg
                });
            }
        });

    };
}

util.inherits(iTach, events.EventEmitter);

module.exports = function(options) {

    return new iTach(options);
};