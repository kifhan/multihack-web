/* globals window */

var Y = require('yjs')
require('y-memory')(Y)
require('y-array')(Y)
require('y-map')(Y)
require('y-multihack')(Y)
require('y-text')(Y)

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var Voice

inherits(RemoteManager, EventEmitter)

function RemoteManager (opts) {
  var self = this

  opts = opts || {}
  Voice = opts.voice || null
  opts.wrtc = opts.wrtc || null
  self.roomID = opts.room || 'welcome'
  self.hostname = opts.hostname || 'https://quiet-shelf-57463.herokuapp.com'
  self.nickname = opts.nickname || 'Guest'
  self.id = null
  self.yfs = null
  self.ySelections = null
  self.posFromIndex = function (filePath, index, cb) {
    console.warn('No "remote.posFromIndex" provided. Unable to apply change!')
  }
  self.client = null
  self.voice = null
  self.peers = []
  self.lastSelection = null
  self.replyUpdate = function (filePath, replies, cb) {
    console.warn('No "remote.replyUpdate" provided. Unable to apply change!')
  }
  self.replyLazyUpdate = null
  self.editerBindedObserver = {
    textobserver: null,
    texttarget: null,
    replyobserver: null,
    replytarget: null
  }

  var tokens = {}
  self.mutualExcluse = function (key, f) {
    if (!tokens[key]) {
      tokens[key] = true
      try {
        f()
      } catch (e) {
        delete tokens[key]
        throw new Error(e)
      }
      delete tokens[key]
    }
  }

  Y({
    db: {
      name: 'memory' // Store the CRDT model in browser memory
    },
    connector: {
      name: 'multihack',
      room: self.roomID,
      hostname: self.hostname,
      nickname: self.nickname,
      wrtc: opts.wrtc,
      events: function (event, value) {
        if (event === 'id') {
          self.id = value.id
          self.nop2p = value.nop2p
        } else if (event === 'client') {
          self.client = value
        } else if (event === 'voice') {
          if (Voice) {
            self.voice = new Voice(value.socket, value.client, self.roomID)
          }
        } else if (event === 'peers') {
          self.peers = value.peers
          self.mustForward = value.mustForward
        } else if (event === 'lostPeer') {
          self._onLostPeer(value)
        }
        self.emit(event, value)
      }
    },
    share: {
      selections: 'Array',
      dir_tree: 'Map'
    }
  }).then(function (y) {
    self.y = y
    self.yfs = y.share.dir_tree
    self.ySelections = y.share.selections

    self.ySelections.observe(function (event) {
      event.values.forEach(function (sel) {
        if (sel.id !== self.id || !self.id) {
          self.emit('changeSelection', self.ySelections.toArray().filter(function (sel) {
            return sel.id !== self.id
          }))
        }
      })
    })

    self.yfs.observe(function (event) {
      var filePath = event.name

      if (event.type === 'add') { // create file/folder

        if (event.value instanceof Y.Text.typeDefinition.class) {
          self.emit('createFile', {
            filePath: filePath,
            content: event.value.toString()
          })
        } else if (event.value instanceof Y.Array.typeDefinition.class) {
          var pathdiv = filePath.split('.')
          if (pathdiv[pathdiv.length - 1] === 'replydb') {
            // replydb does not saved on file system.
          }
        } else {
          self.emit('createDir', {
            path: filePath
          })
        }
      } else if (event.type === 'update') {
        // a file with the same name has been added
        self.emit('deleteFile', {
          filePath: filePath
        })
        if (event.value instanceof Y.Text.typeDefinition.class) {
          self.emit('createFile', {
            filePath: filePath,
            content: event.value.toString()
          })
        } else if (event.value instanceof Y.Array.typeDefinition.class) {
          var pathdiv = filePath.split('.')
          if (pathdiv[pathdiv.length - 1] === 'replydb') {
            // replydb does not saved on file system.
          }
        } else {
          self.emit('createDir', {
            filePath: filePath
          })
        }
      } else if (event.type === 'delete') { // delete
        self.emit('deleteFile', {
          filePath: filePath
        })
      }
    })
    self.emit('ready')
  })
}

RemoteManager.prototype.setObserver = function (filePath, targetstr) {
  var self = this
  setTimeout(function() {
    console.log('observer setting: ' + filePath + ' ' + targetstr);
    if(self.editerBindedObserver[targetstr + 'observer']) self.editerBindedObserver[targetstr + 'target'].unobserve(self.editerBindedObserver[targetstr + 'observer'])
    if(targetstr === 'text') self.editerBindedObserver[targetstr + 'observer'] = self._onYTextAdd.bind(self, filePath)
    else if(targetstr === 'reply') self.editerBindedObserver[targetstr + 'observer'] = self._onReplyAdd.bind(self, filePath)
    else return
    self.editerBindedObserver[targetstr + 'target'] = self.yfs.get(filePath)
    self.editerBindedObserver[targetstr + 'target'].observe(self.editerBindedObserver[targetstr + 'observer'])
  },100)
}

RemoteManager.prototype.getContent = function (filePath) {
  var self = this
  return self.yfs.get(filePath).toString()
}

RemoteManager.prototype.getReplyContent = function (filePath) {
  var self = this
  var yreplies = self.yfs.get(filePath)
  var replies = []
  if (typeof yreplies === 'undefined') return replies
  for (var i = 0; i < yreplies.toArray().length; i++) {
    var reply = yreplies.get(i)
    var robj = {
      user_id: reply.get('user_id'),
      user_name: reply.get('user_name'),
      user_picture: reply.get('user_picture'),
      reply_id: reply.get('reply_id'),
      insert_time: reply.get('insert_time'),
      level: reply.get('level'),
      order: reply.get('order'),
      line_num: reply.get('line_num'),
      content: reply.get('content')
    }
    replies.push(robj)
    console.log('getReplyContent: '+ JSON.stringify(robj));
  }
  return replies
}

RemoteManager.prototype.createFile = function (filePath, contents) {
  var self = this
  var pathdiv = filePath.split('.')
  if (pathdiv[pathdiv.length - 1] === 'ymap') {
    self.yfs.set(filePath, Y.Map)
    // TODO: make a file type for richtext, trello board, etc.
  } else {
    self.yfs.set(filePath + '.replydb', Y.Array)
    self.yfs.set(filePath, Y.Text)
    insertChunked(self.yfs.get(filePath), 0, contents || '')
  }
}

RemoteManager.prototype.createDir = function (filePath, contents) {
  var self = this
  self.yfs.set(filePath, 'DIR')
}

function insertChunked (ytext, start, str) {
  var i = start
  var CHUNK_SIZE = 60000
  chunkString(str, CHUNK_SIZE).forEach(function (chunk) {
    ytext.insert(i, chunk)
    i += chunk.length
  })
}

function chunkString (str, size) {
  var numChunks = Math.ceil(str.length / size), chunks = new Array(numChunks)

  for (var i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }

  return chunks
}

RemoteManager.prototype.replaceFile = function (oldPath, newPath) {
  var self = this
  self.yfs.set(newPath + '.replydb', self.yfs.get(oldPath + '.replydb'))
  self.yfs.set(newPath, self.yfs.get(oldPath))
}
RemoteManager.prototype.deleteFile = function (filePath) {
  var self = this
  self.yfs.delete(filePath)
  self.yfs.delete(filePath + '.replydb')
}

RemoteManager.prototype.changeFile = function (filePath, delta) {
  var self = this
  self.mutualExcluse(filePath, function () {
    var ytext = self.yfs.get(filePath)
    if (!ytext) return

    // apply the delta to the ytext instance
    var start = delta.start

    // apply the delete operation first
    if (delta.removed.length > 0) {
      var delLength = 0
      for (var j = 0; j < delta.removed.length; j++) {
        delLength += delta.removed[j].length
      }
      // "enter" is also a character in our case
      delLength += delta.removed.length - 1
      ytext.delete(start, delLength)
    }

    // apply insert operation
    insertChunked(ytext, start, delta.text.join('\n'))
  })
}

RemoteManager.prototype.changeReply = function (filePath, optype, opval) {
  var self = this
  self.mutualExcluse(filePath, function () {
    var replydb = self.yfs.get(filePath)
    if (optype === 'insert') {
      var ridx = replydb.toArray().length
      replydb.push([Y.Map])
      var reply = replydb.get(ridx)
      reply.set('user_id', opval.user_id)
      reply.set('user_name', opval.user_name)
      reply.set('user_picture', opval.user_picture)
      reply.set('reply_id', opval.reply_id)
      reply.set('insert_time', opval.insert_time)
      reply.set('level', opval.level)
      reply.set('order', opval.order)
      reply.set('line_num', opval.line_num)
      reply.set('content', opval.content)
      console.log('reply sent by you: ' + replydb.get(ridx).keys())
    } else if (optype === 'delete') {
      for (var i = 0; i < replydb.toArray().length; i++) {
        if (replydb.get(i).get('reply_id') === opval.reply_id) {
          replydb.delete(i, 1)
          break
        }
      }
    } else if (optype === 'update') {
      for (var i = 0; i < replydb.toArray().length; i++) {
        var reply = replydb.get(i)
        if (reply.get('reply_id') === opval.reply_id) {
          if (typeof opval.line_num !== 'undefined') reply.set('line_num', opval.line_num)
          if (typeof opval.user_name !== 'undefined') reply.set('user_name', opval.user_name)
          if (typeof opval.user_picture !== 'undefined') reply.set('user_picture', opval.user_picture)
          if (typeof opval.content !== 'undefined') reply.set('content', opval.content)
          break
        }
      }
    }
  })
}

RemoteManager.prototype.changeSelection = function (data) {
  var self = this
  // remove our last select first
  if (self.lastSelection !== null) {
    self.ySelections.toArray().forEach(function (a, i) {
      if (a.tracker === self.lastSelection) {
        self.ySelections.delete(i)
      }
    })
  }
  data.id = self.id
  data.tracker = Math.random()
  self.lastSelection = data.tracker
  self.ySelections.push([data])
}

RemoteManager.prototype._onYTextAdd = function (filePath, event) {
  var self = this
  self.mutualExcluse(filePath, function () {
    self.posFromIndex(filePath, event.index, function (from) {
      if (event.type === 'insert') {
        self.emit('changeFile', {
          filePath: filePath,
          change: {
            from: from,
            to: from,
            text: event.values.join('')
          }
        })
      } else if (event.type === 'delete') {
        self.posFromIndex(filePath, event.index + event.length, function (to) {
          self.emit('changeFile', {
            filePath: filePath,
            change: {
              from: from,
              to: to,
              text: ''
            }
          })
        })
      }
    })

    // reply line_num update
    if (self.replyLazyUpdate) {
      clearTimeout(self.replyLazyUpdate)
      self.replyLazyUpdate = null
    }
    self.replyLazyUpdate = setTimeout(function () {
      self.replyUpdate(filePath + '.replydb', self.yfs.get(filePath + '.replydb'), function (replies) {
        for (var i = 0; i < replies.length; i++) {
          var reply = replies[i]
          self.changeReply(filePath + '.replydb', 'update', reply)
        }
      })
    }, 100)
  })
}

RemoteManager.prototype._onReplyAdd = function (filePath, event) {
  var self = this
  self.mutualExcluse(filePath, function () {
    console.log('sync: got reply')
    if (event.type === 'insert') {
      self.emit('changeReply', {
        filePath: filePath,
        type: 'insert',
        replies: event.values
      })
      console.log('sync: reply added!')
    } else if (event.type === 'delete') {
      self.emit('changeReply', {
        filePath: filePath,
        type: 'delete',
        replies: event.values
      })
    // observeDeep doesn't work.
    // TODO: reply y-map update function
    // } else if (event.type === 'update') { // only fires on Y-Map
    //   self.emit('changeReply', {
    //     filePath: filePath,
    //     type: 'update',
    //     name: event.name,
    //     value: event.value
    //   })
    }
  })
}
RemoteManager.prototype._onLostPeer = function (peer) {
  var self = this
  self.ySelections.toArray().forEach(function (sel, i) {
    if (sel.id === peer.id) {
      self.ySelections.delete(i)
    }
  })
}

RemoteManager.prototype.destroy = function () {
  var self = this
  // TODO: Add a proper destroy function in simple-signal
  self.peers.forEach(function (peer) {
    peer.destroy()
  })
  self.peers = []
  self.client = null
  self.voice = null
  self.id = null
  self.yfs = null
  // TODO: destroy yfs recursively


  self.ySelections = null
  self.posFromIndex = null
  self.lastSelection = null
}

module.exports = RemoteManager
