const test = require('ava')
const sinon = require('sinon')
const { createQueue } = require('../src/utils')

test('nothing run when paused', t => {
  const taskFunc = sinon.stub().returns(1)
  const q = createQueue(taskFunc)
  const someItem = {}

  q.pause()

  q.push(someItem)
  q.push(someItem)
  q.push(someItem)
  t.true(taskFunc.notCalled)
})

test('runs queued item immediatly', async t => {
  t.plan(3)
  const taskFunc = sinon.stub().returns(1)
  const q = createQueue(taskFunc, 1, 3000)
  const someItem = {}
  const promises = []

  promises[0] = q.push(someItem)
  promises[1] = q.push(someItem)

  t.deepEqual(await Promise.all(promises), [ 1, 1 ])
  t.true(taskFunc.alwaysCalledWith(someItem))
  t.is(taskFunc.callCount, 2)
})

test('runs queued item after being paused', async t => {
  t.plan(3)
  const taskFunc = sinon.stub().returns(1)
  const q = createQueue(taskFunc, 4, 3000)
  const someItem = {}
  const promises = []

  q.pause()

  promises[0] = q.push(someItem)
  promises[1] = q.push(someItem)
  promises[2] = q.push(someItem)
  promises[3] = q.push(someItem)

  q.resume()

  const result = await Promise.all(promises)
  t.deepEqual(result, [ 1, 1, 1, 1 ])
  t.true(taskFunc.alwaysCalledWith(someItem))
  t.is(taskFunc.callCount, 4)
})

test('task times out if not resolved', async t => {
  t.plan(1)
  const taskFunc = sinon.stub().resolves(new Promise(() => {}))
  const q = createQueue(taskFunc)
  const someItem = {}

  await t.throws(q.push(someItem, 1000), Error)
})
