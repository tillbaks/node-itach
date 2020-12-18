const test = require("ava");
const sinon = require("sinon");
const itach = require("../");

test.beforeEach.cb((t) => {
  itach.setOptions({
    host: "192.168.1.25",
    port: 4998,
    reconnect: true,
    reconnectSleep: 1000,
    sendTimeout: 500,
    retryInterval: 99,
    connectionTimeout: 3000,
  });
  t.deepEqual(itach.eventNames(), []);
  itach.on("error", console.log);
  t.end();
});

test.afterEach.cb((t) => {
  itach.close({ reconnect: false });
  setTimeout(() => {
    itach.removeAllListeners();
    t.end();
  }, 1000);
});

test.serial.cb("can connect to itach device", (t) => {
  t.plan(1);

  const connectFunc = sinon.spy();

  itach.on("connect", connectFunc);

  itach.connect();

  setTimeout(() => {
    t.is(connectFunc.callCount, 1);
    t.end();
  }, 10000);
});

test.serial.cb("connection times out", (t) => {
  t.plan(3);

  const connectFunc = sinon.spy();
  const errorFunc = sinon.spy();

  itach.on("connect", connectFunc);
  itach.on("error", errorFunc);

  itach.connect({
    host: "192.168.1.222",
    connectionTimeout: 100,
    reconnect: false,
  });

  setTimeout(() => {
    t.is(connectFunc.callCount, 0);
    t.is(errorFunc.callCount, 1);
    t.is(errorFunc.getCall(0).args[0].message, "Connection timeout.");
    t.end();
  }, 10000);
});

test.serial.cb("reconnects after connection times out", (t) => {
  t.plan(3);

  const connectFunc = sinon.spy();
  const errorFunc = sinon.spy();

  itach.on("connect", connectFunc);
  itach.on("error", errorFunc);

  itach.connect({ host: "192.168.1.222", connectionTimeout: 100 });

  setTimeout(() => {
    t.is(connectFunc.callCount, 0);
    t.assert(errorFunc.callCount > 2);
    t.is(errorFunc.getCall(0).args[0].message, "Connection timeout.");
    t.end();
  }, 10000);
});

test.serial.cb("sending sendir commands", (t) => {
  t.plan(1);

  itach.connect();

  itach.on("connect", async () => {
    const result = await itach.send(
      "sendir,1:1,1,38400,1,1,347,173,22,22,22,65,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,22,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,1657"
    );
    t.is(result, "completeir,1:1,1");
    t.end();
  });
});

test.serial.cb("error when sending invalid sendir commands", (t) => {
  t.plan(2);

  itach.connect();

  itach.on("connect", async () => {
    const error = await t.throwsAsync(itach.send("sendir:"), {
      instanceOf: Error,
    });
    t.is(error.message, "Invalid command. Command not found.");
    t.end();
  });
});

// @TODO: this test is not possible on live device since response is too fast and will never actually time out
test.serial.cb.skip("error when sendtimeout reached", (t) => {
  t.plan(2);

  itach.connect({ sendTimeout: 1 });

  itach.on("connect", async () => {
    const error = await t.throws(itach.send("getdevices"), Error);
    t.is(
      error.message,
      "QueueTaskTimeout: Task failed to complete before timeout was reached."
    );
    t.end();
  });
});
