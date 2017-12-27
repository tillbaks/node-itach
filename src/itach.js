const net = require('net')
const { EventEmitter } = require('events')
const itach = new EventEmitter()
const { options, ERRORCODES } = require('./config')
const { createQueue } = require('./utils')
let socket

const queue = createQueue((data) =>
  new Promise((resolve, reject) => {
    socket.removeAllListeners('data')
    socket.on('data', (response) => {
      if (response.startsWith('ERR_')) {
        const errorCode = response.slice(-4, -1)
        reject(new Error(ERRORCODES[errorCode]))
      } else if (response.startsWith('busyIR')) {
        setTimeout(() => socket.write(data), options.retryInterval)
      } else {
        resolve(response.slice(0, -1))
      }
    })
    socket.write(data)
  }), 1)

queue.pause()

itach.setOptions = (opts) => {
  if (opts === undefined) return
  Object.entries(opts).forEach(([ key, value ]) => {
    options[key] = value
  })
}

itach.close = (opts) => {
  itach.setOptions(opts)
  queue.pause()
  socket.destroy()
  if (options.reconnect) {
    setTimeout(itach.connect, options.reconnectInterval)
  }
}

itach.connect = (opts) => {
  itach.setOptions(opts)

  const connectionTimeout = setTimeout(() => {
    setImmediate(() => socket.destroy('Connection timeout.'))
  }, options.connectionTimeout)

  if (socket === undefined) {
    socket = net.connect({ host: options.host, port: options.port })
    socket.setEncoding('utf8')

    socket.on('connect', () => {
      clearTimeout(connectionTimeout)
      queue.resume()
      itach.emit('connect')
    })

    socket.on('close', () => {
      queue.pause()
      itach.emit('close')
    })

    socket.on('error', (error) => {
      queue.pause()
      itach.emit('error', new Error(error))
    })
  } else if (socket.remoteAddress === undefined) {
    socket.connect({ host: options.host, port: options.port })
  }
}

itach.send = (data) => {
  return queue.push(data.includes('\r') ? data : data + '\r', options.sendTimeout)
}

module.exports = itach
