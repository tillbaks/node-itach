/**
 * Rejects a passed promise if it hasn't completed in time
 *
 * @return a promise that will be rejected when the timeout is reached otherwise the result of the passed promise
 */
const timeoutPromise = ({promise, timeout, error}) => {
  let timer = null

  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(reject, timeout, error)
      return timer
    }),
    promise.then((value) => {
      clearTimeout(timer)
      return value
    })
  ])
}

const createQueue = (taskFunc, concurrency = 1) => {
  const queue = []
  let active = 0
  let paused = false

  const run = async function () {
    if (paused || active >= concurrency || queue.length < 1) {
      return
    }
    active += 1
    const queueItem = queue.shift()
    try {
      if (queueItem.timeout) {
        queueItem.resolve(timeoutPromise({
          promise: taskFunc(queueItem.task),
          timeout: queueItem.timeout,
          error: new Error('QueueTaskTimeout: Task failed to complete before timeout was reached.')
        }))
      } else {
        queueItem.resolve(taskFunc(queueItem.task))
      }
    } catch (error) {
      queueItem.reject(error)
    } finally {
      active -= 1
      run()
    }
  }

  return {
    push: (task, timeout) => new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject, timeout })
      run()
    }),
    pause: () => {
      paused = true
    },
    resume: () => {
      paused = false
      run()
    }
  }
}

module.exports = { createQueue }
