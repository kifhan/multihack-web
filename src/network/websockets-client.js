/* global Y, global */
var Y = require('yjs')
var define = global.define
global.define = null
var io = require('socket.io-client')
// redefine global.define
global.define = define

class Connector extends Y.AbstractConnector {
  constructor (y, options) {
    if (options === undefined) {
      throw new Error('Options must not be undefined!')
    }
    if (options.room == null) {
      throw new Error('You must define a room name!')
    }
    options = Y.utils.copyObject(options)
    options.role = 'slave'
    options.forwardToSyncingClients = options.forwardToSyncingClients || false
    options.preferUntransformed = true
    super(y, options)
    var self = this
    if (!(self instanceof Connector)) return new Connector(y, opts)

    this.options = options
    options.hostname = options.hostname || 'https://yjs.dbis.rwth-aachen.de:5072'
    var socket = options.socket || io(options.hostname)
    this.socket = socket

    this._onConnect = function joinRoom () {
      socket.emit('joinRoom', options.room)
      self.userJoined('server', 'master')
    }

    socket.on('connect', this._onConnect)
    if (socket.connected) {
      this._onConnect()
    } else {
      socket.connect()
    }

    this._onyjsSocketMessage = function (message) {
      if (message.type != null) {
        if (message.type === 'sync done') {
          var userId = socket.id
          if (socket._yjs_connection_counter == null) {
            socket._yjs_connection_counter = 1
          } else {
            userId += socket._yjs_connection_counter++
          }
          self.setUserId(userId)
        }
        if (message.room === options.room) {
          self.receiveMessage('server', message)
        }
      }
    }
    socket.on('yjsSocketMessage', this._onyjsSocketMessage)

    this._onDisconnect = function (peer) {
      Y.AbstractConnector.prototype.disconnect.call(self)
    }
    socket.on('disconnect', this._onDisconnect)
  }
}
Connector.prototype.disconnect = function () {
  this.socket.emit('leaveRoom', this.options.room)
  if (!this.options.socket) {
    this.socket.disconnect()
  }
}
Connector.prototype.destroy = function () {
  this.disconnect()
  this.socket.off('disconnect', this._onDisconnect)
  this.socket.off('yjsSocketMessage', this._onyjsSocketMessage)
  this.socket.off('connect', this._onConnect)
  if (!this.options.socket) {
    this.socket.destroy()
  }
  this.socket = null
}
Connector.prototype.reconnect = function () {
  this.socket.connect()
}
Connector.prototype.send = function (uid, message) {
  message.room = this.options.room
  this.socket.emit('yjsSocketMessage', message)
}
Connector.prototype.broadcast = function (message) {
  message.room = this.options.room
  this.socket.emit('yjsSocketMessage', message)
}
Connector.prototype.isDisconnected = function () {
  return this.socket.disconnected
}

function extend (Y) {
  Y.extend('websockets-client', Connector)
}
module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}
