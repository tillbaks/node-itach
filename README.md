node-itach
==========

Node.js module to send commands to GlobalCache iTach devices. Only testing with IP2IR device but it should work with any of the itach devices.

Installation
-----

```
npm install itach --save
```

Example
-----

```js
var itach = require("itach");

itach.on("connect", function () {
  console.log("Connected to itach");
});

itach.sendir("sendir...", function (err, data) {
  if (!err) {
    //Successfully executed command
  }
});

itach.connect({ host: "10.0.0.4", reconnect: true });
```

API
-----

All commands are enqueued and are only sent when a connection to an itach device is present. The queue is paused if connection is lost and then resumed when connection is restored.

__connect(options)__

Connects to the provided host and sets other config properties.

_Arguments_

* `options` - (Mandatory) An optios Object
  * `options.host` - (Mandatory) Hostname/IP to connect to
  * `options.port` - (Default: 4998) Port to connect to
  * `options.reconnect` - (Default: false) Try to reconnect if connection is lost
  * `options.reconnect_sleep` - (Default: 3000) Time to sleep (in milliseconds) after connection is lost before trying to reconnect

_Example_
```js
itach.connect({ host: "10.0.0.4", reconnect: true });
```

---------------------------------------

__close()__

Closes the connection to the itach device. Note: If reconnect is enabled the connection will not stay closed.

_Example_
```js
itach.close();
```
---------------------------------------

__sendir(data, callback)__

Sends a sendir command to be executed on the itach device.

_Arguments_

* `data` - (Mandatory) String containing a sendir command
* `data` - (Mandatory) Object data
  * `data.module` - (Optional) Module on itach device
  * `data.frequency` - (Optional) Frequency
  * `data.repeat` - (Optional) Repeat
  * `data.offset` - (Optional) Offset
  * `data.ir` - (Mandatory) String containing a sendir command
* `callback` - (Mandatory) Callback function

_Example_
```js
itach.sendir("sendir...", function (err, data) {
  if (!err) {
    //Successfully executed command
  }
});
```
```js
itach.sendir({
  module: "1:3",
  ir: "sendir..."
}, function (err, data) {
  if (!err) {
    //Successfully executed command
  }
});
```

---------------------------------------

__Events__

* `connect` - Connection to itach has been established and commands will now be sent
* `close` - Connection to itach has been closed
* `error` - Some error with the socket connection

_Example_
```js
itach.on("connect", function() {

  // Connection established
});

itach.on("close", function() {

  // Connection closed
});

itach.on("error", function (error) {

  // Error occurred with the connection to itach device
});
```

TODO
-----

* Re-queue commands when busyIR is received from itach device
* Implement additional itach functionality
* Possibility to limit the queue?

LINKS
-----
* API: http://www.globalcache.com/files/docs/API-iTach.pdf
