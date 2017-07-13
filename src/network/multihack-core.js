var debug = require('debug')('MH:core')

var Y = require('yjs')
require('y-memory')(Y)
require('y-array')(Y)
require('y-map')(Y)
// require('./websockets-client')(Y)
require('./y-multihack')(Y)
require('y-text')(Y)
require('y-richtext')(Y)

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var util = require('../filesystem/util')
var Voice

inherits(RemoteManager, EventEmitter)

function RemoteManager (opts) {
  var self = this

  opts = opts || {}
  Voice = opts.voice || null
  opts.wrtc = opts.wrtc || null
  self.roomID = opts.room || 'welcome'
  self.hostname = opts.hostname || 'http://localhost:8080'
  self.nickname = opts.nickname || 'Guest'
  self.id = null
  self.yfs = null
  self.ySelections = null
  self.posFromIndex = function (filePath, index, cb) {
    throw Error('No "remote.posFromIndex" provided. Unable to apply change!')
  }
  self.client = null
  self.voice = null
  self.peers = []
  self.lastSelection = null
  self.replyUpdate = function (filePath, replies, cb) {
    throw Error('No "remote.replyUpdate" provided. Unable to apply change!')
  }
  self.replyLazyUpdate = null
  self.bindedObservers = {}

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
  self.onceReady = function (f) {
    if (!self.yfs) {
      self.once('ready', function () {
        f()
      })
    } else {
      f()
    }
  }

  Y({
    db: {
      name: 'memory' // Store the CRDT model in browser memory
    },
    connector: {
      name: 'multihack',
      // name: 'websockets-client',
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

    debug('load yfs: '+JSON.stringify(self.yfs.keys()))
    self.yfs.keys().forEach(function(path) {
      self.fileoperation('add', path, self.yfs.get(path))      
    })

    self.yfs.observe(function (event) {
      self.fileoperation(event.type, event.name, event.value)
    })

    self.ySelections.observe(function (event) {
      event.values.forEach(function (sel) {
        if (sel.id !== self.id || !self.id) {
          self.emit('changeSelection', self.ySelections.toArray().filter(function (sel) {
            return sel.id !== self.id
          }))
        }
      })
    })

    self.emit('ready')
  })
}
RemoteManager.prototype.fileoperation = function (optype, filePath, content) {
  var self = this
  if (optype === 'add' || optype === 'update') { // create file/folder
    if (optype === 'update') { // delete old file, when a file with the same name has been added
      self.emit('deleteFile', { filePath: filePath })
    }
    var filetype = util.findFileType(filePath)
    if (filetype === 'text') {
      self.emit('createFile', {
        filePath: filePath,
        content: content.toString()
      })
    } else if (filetype === 'image') {
      self.emit('createFile', {
        filePath: filePath,
        content: content
      })
    } else if (filetype === 'quilljs') {
      self.emit('createFile', {
        filePath: filePath,
        content: content.toDelta()
      })
    } else if (filetype === 'replydb') {
      // replydb does not saved on FileSystem.
    } else if(content === 'directory') {
      self.emit('createDir', {
        path: filePath
      })
    } else if (filetype === 'unknown') {
      self.emit('createFile', {
        filePath: filePath,
        content: content
      })
      // TODO: think about what to do with unknown file type
    }
  } else if (optype === 'delete') { // delete
    self.emit('deleteFile', {
      filePath: filePath
    })
  }
}
RemoteManager.prototype.onObserver = function (filePath) {
  var self = this
  setTimeout(function() {
    debug('observer setting: ' + filePath);
    if(self.bindedObservers[filePath]) self.offObserver(filePath)
    if(util.findFileType(filePath) === 'text') {
      self.bindedObservers[filePath] = self._onYTextAdd.bind(self, filePath)
    } else if(util.findFileType(filePath) === 'replydb') {
      self.bindedObservers[filePath] = self._onReplyAdd.bind(self, filePath)
    } else if(util.findFileType(filePath) === 'quilljs') {
      self.bindedObservers[filePath] = self._onYRichtextAdd.bind(self, filePath)
    } else return
    self.bindedObservers[filePath + 'target'] = self.yfs.get(filePath)
    debug('observe: '+ typeof self.bindedObservers[filePath + 'target'])
    self.bindedObservers[filePath + 'target'].observe(self.bindedObservers[filePath])
  },100)
}
RemoteManager.prototype.offObserver = function (filePath) {
  var self = this
  self.bindedObservers[filePath + 'target'].unobserve(self.bindedObservers[filePath])
  delete self.bindedObservers[filePath + 'target']
  delete self.bindedObservers[filePath]
}
RemoteManager.prototype.getContent = function (filePath) {
  var self = this
  if(util.findFileType(filePath) === 'text') 
    return self.yfs.get(filePath).toString()
  else if(util.findFileType(filePath) === 'quilljs') 
    return self.yfs.get(filePath).toDelta()
  else return self.yfs.get(filePath)
}

RemoteManager.prototype.getReplyContent = function (filePath) {
  var self = this
  var yreplies = self.yfs.get(filePath)
  var replies = []
  if (!yreplies) return replies
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
    debug('getReplyContent: '+ JSON.stringify(robj));
  }
  return replies
}

RemoteManager.prototype.createFile = function (filePath, content) {
  var self = this
  self.onceReady(function () {
    content = content || ''
    var filetype = util.findFileType(filePath)    
    if (filetype === 'image') {
      self.yfs.set(filePath, content)
    } else if (filetype === 'text') {
      self.yfs.set(filePath + '.replydb', Y.Array)
      self.yfs.set(filePath, Y.Text)
      insertChunked(self.yfs.get(filePath), 0, content)
    } else if (filetype === 'quilljs') {
      self.yfs.set(filePath + '.replydb', Y.Array)
      self.yfs.set(filePath, Y.Richtext)
      //insertChunked(self.yfs.get(filePath), 0, content)
    } else {
      self.yfs.set(filePath, content)      
    }
  })
}

RemoteManager.prototype.createDir = function (filePath, content) {
  var self = this
  self.onceReady(function () {
    self.yfs.set(filePath, 'directory')
  })
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
  self.onceReady(function () {
    self.yfs.set(newPath, self.yfs.get(oldPath))
    self.yfs.delete(oldPath)
    if(self.yfs.get(oldPath + '.replydb')) {
      self.yfs.set(newPath + '.replydb', self.yfs.get(oldPath + '.replydb'))
      self.yfs.delete(oldPath + '.replydb')   
    }  
  })
}
RemoteManager.prototype.deleteFile = function (filePath) {
  var self = this
  self.onceReady(function () {
    self.yfs.delete(filePath)
    if(self.yfs.get(filePath + '.replydb')) self.yfs.delete(filePath + '.replydb')
  })
}

RemoteManager.prototype.changeFile = function (filePath, delta) {
  var self = this
  self.onceReady(function () {
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
  })
}

RemoteManager.prototype.changeReply = function (filePath, optype, opval) {
  var self = this
  self.onceReady(function () {
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
        debug('reply sent by you: ' + replydb.get(ridx).keys())
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
  })
}

RemoteManager.prototype.changeSelection = function (data) {
  var self = this
  self.onceReady(function () {
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
  })
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
    debug('sync: got reply')
    if (event.type === 'insert') {
      self.emit('changeReply', {
        filePath: filePath,
        type: 'insert',
        replies: event.values
      })
      debug('sync: reply added!')
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
    //   })q
    }
  })
}

RemoteManager.prototype._onYRichtextAdd = function (filePath, event) {
  var self = this
  self.mutualExcluse(filePath, function () {
    // bindQuill을 사용하는 동안은 할 일이 없다. 추적용
    debug('Richtext event recieved: '+ JSON.stringify(event))
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
