var Y = require('yjs')
var define = global.define
global.define = null
var Io = require('socket.io-client')
global.define = define
var SimpleSignalClient = require('simple-signal-client')
var Throttle = require('stream-throttle').Throttle
var Wire = require('multihack-wire')
var getBrowserRTC = require('get-browser-rtc')

class Connector extends Y.AbstractConnector {
  constructor (y, options) {
    options = options || {}
    options = Y.utils.copyObject(options)
    options.role = 'slave'
    options.debug = true
    options.forwardToSyncingClients = options.forwardToSyncingClients || false
    // options.preferUntransformed = true
    super(y, options)
    var self = this
    if (!(self instanceof Connector)) return new Connector(y, options)

    self.options = options
    self.room = options.room || 'welcome'
    self.wrtc = options.wrtc || null
    self.hostname = options.hostname
    self.nickname = options.nickname
    self.events = options.events || function (event, value) {}
    self.socketID = null
    self.queue = []
    self.peers = []
    self.socket = new Io(self.hostname)

    self._setupSocket()
    self.nop2p = true
    // if (!getBrowserRTC()) {
    //   console.log('No WebRTC support: turn it to socket client.')
    //   self.nop2p = true
    // } else {
    //   self.nop2p = false
    //   self._setupP2P()
    // }
    // self.peers = []
    // self.events('peers', { peers: self.peers })
  }
}

Connector.prototype._setupSocket = function () {
  var self = this

  self.socket.on('connect', function () {
    console.log('connected to socket server!')
    self.socket.emit('joinRoom', { room: self.room, nickname: self.nickname, nop2p: self.nop2p })
    self.userJoined('server', 'master')
  })

  self.socket.on('yjsSocketMessage', function (message, id) {
    if (message.type != null) {
      if (message.type === 'sync done') {
        self.socketID = self.socket.id
        self.setUserId(self.socketID)
        self.events('id', {
          id: self.socketID,
          nop2p: self.nop2p
        })
      }
      if (message.room === self.room) self.receiveMessage('server', message)
    }
  })

  self.socket.on('peer-join', function (data) {
    if (!self.nop2p && !data.nop2p) return // will connect p2p

    var fakePeer = { // This is socket client, to show them in client list, we made fakepeer.
      metadata: {
        nickname: data.nickname
      },
      id: data.id,
      nop2p: data.nop2p
    }
    self.peers.push(fakePeer)

    self._onGotPeer(fakePeer)
  })

  self.socket.on('peer-leave', function (data) {
    if (!self.nop2p && !data.nop2p) return // will disconnect p2p

    for (var i = 0; i < self.peers.length; i++) {
      if (self.peers[i].id === data.id) {
        self._onLostPeer(self.peers[i])
        self.peers.splice(i, 1)
        break
      }
    }
  })

  self.socket.on('disconnect', function (peer) {
    Y.AbstractConnector.prototype.disconnect.call(self)
  })
}

Connector.prototype._setupP2P = function (room, nickname) {
  var self = this

  self._client = new SimpleSignalClient(self.socket, {
    room: self.room
  })
  self.events('client', self._client)

  self._client.on('ready', function (peerIDs) {
    self.events('voice', {
      client: self._client,
      socket: self.socket
    })

    // if (!self.socketID) {
    //   self.setUserId(self._client.id)
    //   self.socketID = self._client.id
    //   self.events('id', {
    //     id: self.socketID,
    //     nop2p: self.nop2p
    //   })
    // }
    peerIDs = peerIDs || []
    for (var i = 0; i < peerIDs.length; i++) {
      if (peerIDs[i] === self._client.id) continue
      self._client.connect(peerIDs[i], {
        wrtc: self.wrtc,
        reconnectTimer: 100
      }, {
        nickname: self.nickname
      })
    }
  })

  self._client.on('request', function (request) {
    if (request.metadata.voice) return
    request.accept({
      wrtc: self.wrtc,
      reconnectTimer: 100
    }, {
      nickname: self.nickname
    })
  })

  self._client.on('peer', function (peer) {
    if (peer.metadata.voice) return
    peer.metadata.nickname = peer.metadata.nickname || 'Guest'

    // throttle outgoing
    var throttle = new Throttle({rate: 300 * 1000, chunksize: 15 * 1000})
    peer.wire = new Wire()
    peer.originalSend = peer.send
    peer.send = function (chunk) {
      try {
        peer.originalSend(chunk)
      } catch (e) {
        peer.send(chunk)
      }
    }

    peer.pipe(peer.wire).pipe(throttle).pipe(peer)

    self.peers.push(peer)

    peer.wire.on('yjs', function (message) {
      if (peer.connected) {
        self.receiveMessage(peer.id, message)
      } else {
        if (!peer.destroyed) {
          self.queue.push({
            id: peer.id,
            message: message
          })
        }
      }
    })

    peer.on('connect', function () {
      self._onGotPeer(peer)
      self.queue.forEach(function (a) {
        if (a.id === peer.id) {
          self.receiveMessage(a.id, a.message)
        }
      })
    })

    peer.on('close', function () {
      console.warn('connection to peer closed')
      self._destroyPeer(peer)
    })
  })
}

Connector.prototype._destroyPeer = function (peer) {
  var self = this

  for (var i = 0; i < self.peers.length; i++) {
    if (self.peers[i].id === peer.id) {
      self.peers.splice(i, 1)
      break
    }
  }
  peer.destroy()
  self._onLostPeer(peer)
}

Connector.prototype._onGotPeer = function (peer) {
  var self = this

  self.events('peers', {
    peers: self.peers
  })
  self.events('gotPeer', peer)
  self.userJoined(peer.id, 'master')
}

Connector.prototype._onLostPeer = function (peer) {
  var self = this

  self.events('peers', {
    peers: self.peers
  })
  self.events('lostPeer', peer)
  self.userLeft(peer.id)
}

Connector.prototype.disconnect = function () {
  var self = this
  self.socket.emit('leaveRoom', self.room)
  self.socket.disconnect()
}

Connector.prototype.destroy = function () {
  var self = this
  this.disconnect()

  // destroy p2p connection
  for (var i = 0; i < self.peers.length; i++) {
    if (self.peers[i].nop2p || self.nop2p) self.peers[i] = null
    else self.peers[i].destroy()
  }

  self.voice = null
  self._client = null
  self.nop2p = null
  self.peers = []
  self.events('peers', {
    peers: self.peers
  })
  self._handlers = null

  if (!this.options.socket) {
    this.socket.destroy()
  }
  this.socket = null
}

Connector.prototype.reconnect = function () {
  var self = this
  self.socket.connect()
}

// only yjs should call this!
Connector.prototype.send = function (id, message) {
  var self = this
  message.room = self.room
  console.log('client send to one')

  self.socket.emit('yjsSocketMessage', message, id)
  if (self.nop2p) return
  for (var i = 0; i < self.peers.length; i++) {
    if (self.peers[i].id !== id) continue
    if (!self.peers[i].nop2p) {
      self.peers[i].wire.yjs(message)
    }
    break
  }
}

Connector.prototype.broadcast = function (message) {
  var self = this
  message.room = self.room
  self.socket.emit('yjsSocketMessage', message)
  if (self.nop2p) return
  for (var i = 0; i < self.peers.length; i++) {
    if (!self.peers[i].nop2p) {
      self.peers[i].wire.yjs(message)
    }
  }
}

Connector.prototype.isDisconnected = function () {
  return this.socket.disconnected
}

function extend (Y) {
  Y.extend('multihack', Connector)
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}
