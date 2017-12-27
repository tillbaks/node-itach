node-itach
==========

Simple Node.js module to send commands to GlobalCache iTach devices. Should handle reconnection (if connection lost), resending (on busyIR), etc.. but not abstract away the iTach API (https://www.globalcache.com/files/docs/API-iTach.pdf).

Note: Only testing with IP2IR device but it should work with any of the itach devices.

Installation
-----

```bash
npm install itach --save
```

Example
-----

```js
var itach = require("itach");

itach.on("connect", async () => {
  console.log("Connected to itach");
  try {
    const result = await itach.send("sendir:..")
  } catch (error) {
    // Some error happened
  }
});

itach.connect({ host: "itach", reconnect: true });
```

API
-----

All commands are enqueued and are only sent when a connection to an itach device is present. The queue is paused if connection is lost and then resumed when connection is restored.

If iTach is already busy sending IR from another connection it will retry every options.retryInterval until options.sendTimeout is reached.

__setOptions(options)__

Changes options

_Arguments_

* `options` - (Mandatory) An options Object
  * `options.host` - (Default: null) Hostname/IP to connect to
  * `options.port` - (Default: 4998) Port to connect to
  * `options.reconnect` - (Default: false) Try to reconnect if connection is lost
  * `options.reconnectInterval` - (Default: 3000) Time (in milliseconds) between reconnection attempts
  * `options.connectionTimeout` - (Default: 3000) Timeout (in milliseconds) when connection attempt is assumed to be failed. error event will be emitted.
  * `options.retryInterval`- (Default: 99) Time (in milliseconds) between resending attempts (when busyIR is received)
  * `options.sendTimeout` - (Default: 500) Time (in milliseconds) after which a sent command will be assumed lost

_Examples_
```js
itach.setOptions({ host: "itachIP2IR", reconnect: true });
```

---------------------------------------

__connect(options)__

Connects to itach device and optionally changes options before connecting.

_Arguments_

* `options` - An options Object (see setOptions method)

_Examples_
```js
itach.connect();
```
```js
itach.connect({ host: "itachIP2IR", reconnect: true });
```

---------------------------------------

__close(options)__

Closes the connection to the itach device. Note: If reconnect is enabled the connection will not stay closed. If you want that you have to pass in { reconnect: false }.
Also note: You can change any options.

_Example_
```js
itach.close();
```
```js
itach.close({ reconnect: false });
```
---------------------------------------

__send(data)__

Sends a itach api command to be executed.

_Arguments_

* `data` - (Mandatory) String containing a itach command (carriage return not required)

_Returns_

A promise that will resolve to the result of the sent command.

_Example_
```js
try {
  const result = await itach.send('sendir,1:1,1,38400,1,1,347,173,22,22,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,1657')
  console.log(result) // completeir...
} catch (error) {
  // handle error
}
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
  // Error occurred
});
```

TODO
-----

*

LINKS
-----
* API: http://www.globalcache.com/files/docs/API-iTach.pdf
