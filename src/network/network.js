var debug = require('debug')('MH:core')

var Y = require('yjs')
require('y-memory')(Y)
require('y-array')(Y)
require('y-map')(Y)
require('./y-multihack')(Y)
require('y-text')(Y)
require('y-richtext')(Y)

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var util = require('../filesystem/util')
var Voice

inherits(NetworkManager, EventEmitter)

function NetworkManager (opts) {
  var self = this

  opts = opts || {}
  Voice = opts.voice || null
  opts.wrtc = opts.wrtc || null
  self.roomID = opts.room || 'welcome'
  self.hostname = opts.hostname || 'http://localhost:8080'
  self.nickname = opts.nickname || 'Guest'
  self.id = null
  self.yFSIndex = null
  self.yFSNodes = null
  self.ySelections = null
  self.client = null
  self.voice = null
  self.peers = []
  self.lastSelection = null
  self.replyLazyUpdate = null
  self.observedInstances = {}

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
    if (!self.yFSIndex) {
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
      filesystem_index: 'Map',
      filesystem_nodes: 'Map'
    }
  }).then(function (y) {
    self.y = y
    self.yFSIndex = y.share.filesystem_index
    self.yFSNodes = y.share.filesystem_nodes
    self.ySelections = y.share.selections

    // init File System from network.
    self.yFSIndex.keys().forEach(function (key) {
      var node = self.yFSIndex.get(key)
      debug('load yFSIndex: ' + JSON.stringify(node))
      self.fileOperation('add', node)
    })

    // set observe on File System
    self.yFSIndex.observe(function (event) {
      self.mutualExcluse(event.value.contentID, function () {
        debug('give me everything: ' + event.value.name)
        self.fileOperation(event.type, event.value)
      })
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

NetworkManager.prototype.getFileMetaByPath = function (filepath) {
  var self = this
  var returnNode = null
  self.yFSIndex.keys().forEach(function (key) {
    var node = self.yFSIndex.get(key)
    if (filepath === (node.parentPath + '/' + node.name)) returnNode = node
  })
  return returnNode
}
NetworkManager.prototype.getFileMetaByContentID = function (contentID) {
  var self = this
  var returnNode = null
  self.yFSIndex.keys().forEach(function (key) {
    var node = self.yFSIndex.get(key)
    if (contentID === node.contentID) returnNode = node
  })
  return returnNode
}
NetworkManager.prototype.getFileByPath = function (filepath) {
  var self = this
  var returnNode = null
  self.yFSIndex.keys().forEach(function (key) {
    var node = self.yFSIndex.get(key)
    if (filepath === (node.parentPath + '/' + node.name)) returnNode = self.yFSNodes.get(node.contentID)
  })
  return returnNode
}
NetworkManager.prototype.getFileByContentID = function (contentID) {
  var self = this
  return self.yFSNodes.get(contentID)
}

NetworkManager.prototype.fileOperation = function (optype, node) {
  var self = this
  if (optype === 'add') { // create file/folder
    if (node.type === util.DIRECTORY_TYPE) {
      self.emit('createDir', {
        name: node.name,
        type: node.type,
        contentID: node.contentID,
        parentPath: node.parentPath
      })
    } else {
      self.emit('createFile', {
        name: node.name,
        type: node.type,
        contentID: node.contentID,
        replydbID: node.replydbID,
        parentPath: node.parentPath
      })
    }
  } else if (optype === 'update') { // update file or dir
    if (node.type === util.DIRECTORY_TYPE) {
      self.emit('updateDir', {
        name: node.name,
        type: node.type,
        contentID: node.contentID,
        parentPath: node.parentPath
      })
    } else {
      self.emit('updateFile', {
        name: node.name,
        type: node.type,
        contentID: node.contentID,
        replydbID: node.replydbID,
        parentPath: node.parentPath
      })
    }
  } else if (optype === 'delete') { // delete file or dir
    self.emit('deleteFile', {
      filePath: node.parentPath + '/' + node.name
    })
  }
}
// TODO: remove it when bindCodeMirror works fine.
// observer for Y-Text data
// NetworkManager.prototype.onObserver = function (contentID, type) {
//   var self = this
//   setTimeout(function () {
//     debug('observer setting: ' + contentID)
//     if (self.observedInstances[contentID]) self.offObserver(contentID)
//     if (type === 'text') {
//       self.observedInstances[contentID] = self._onYTextAdd.bind(self, contentID)
//     } else if (type === 'replydb') {
//       self.observedInstances[contentID] = self._onReplyAdd.bind(self, contentID)
//     } else if (type === 'quilljs') {
//       self.observedInstances[contentID] = self._onYRichtextAdd.bind(self, contentID)
//     } else return
//     self.observedInstances[contentID + 'target'] = self.yFSNodes.get(contentID)
//     debug('observe: ' + typeof self.observedInstances[contentID + 'target'])
//     self.observedInstances[contentID + 'target'].observe(self.observedInstances[contentID])
//   }, 100)
// }
// NetworkManager.prototype.offObserver = function (contentID) {
//   var self = this
//   self.observedInstances[contentID + 'target'].unobserve(self.observedInstances[contentID])
//   delete self.observedInstances[contentID + 'target']
//   delete self.observedInstances[contentID]
// }
NetworkManager.prototype.getContent = function (contentID, type) {
  var self = this
  if (type === 'text') return self.getFileByContentID(contentID).toString()
  else if (type === 'quilljs') return self.getFileByContentID(contentID).toDelta()
  else return self.getFileByContentID(contentID)
}

NetworkManager.prototype.getReplyContent = function (contentID) {
  var self = this
  var yreplies = self.getFileByContentID(contentID)
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
    debug('getReplyContent: ' + JSON.stringify(robj))
  }
  return replies
}

NetworkManager.prototype.createFile = function (parentPath, filename, filetype, content) {
  var self = this
  self.onceReady(function () {
    var contentID = util.randomStr()
    self.mutualExcluse(contentID, function () {
      // create file
      var replydbID = null
      if (filetype === 'text') { // text handled by codemirror
        replydbID = util.randomStr()
        self.yFSNodes.set(contentID, Y.Text)
        self.yFSNodes.set(replydbID, Y.Array)
        if (content) insertChunked(self.getFileByContentID(contentID), 0, content)
      } else if (filetype === 'quilljs') {
        replydbID = util.randomStr()
        self.yFSNodes.set(contentID, Y.Richtext)
        // TODO: insert reply on Richtext
        // self.yFSNodes.set(replydbID, Y.Array)
        // TODO: insert content on richtext
        // if (content) {
        //   var delta = new Delta([{ insert: content }])
        //   self.getFileByContentID(contentID).applyDelta(delta)
        // }
      } else { // image, binary, etc.
        self.yFSNodes.set(contentID, content)
      }

      // create index
      self.yFSIndex.set(contentID, {
        name: filename,
        type: filetype,
        contentID: contentID,
        replydbID: replydbID,
        parentPath: parentPath
      })
    })
  })
}
NetworkManager.prototype.createDir = function (parentPath, filename) {
  var self = this
  self.onceReady(function () {
    var contentID = util.randomStr()
    self.mutualExcluse(contentID, function () {
      // create index
      self.yFSIndex.set(contentID, {
        name: filename,
        type: util.DIRECTORY_TYPE,
        contentID: contentID,
        parentPath: parentPath
      })
    })
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
  var numChunks = Math.ceil(str.length / size)
  var chunks = new Array(numChunks)

  for (var i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }

  return chunks
}

NetworkManager.prototype.renameFile = function (contentID, newName) {
  // rename file and directory
  var self = this
  self.onceReady(function () {
    self.mutualExcluse(contentID, function () {
      var node = self.getFileMetaByContentID(contentID)
      if (node) {
        if (!newName || node.name === newName) return
        var oldname = node.name
        node.name = newName
        self.yFSIndex.set(contentID, node)
        if (node.type === util.DIRECTORY_TYPE) {
          var yfsikeys = self.yFSIndex.keys()
          self.renameSubNodes(yfsikeys, node.parentPath + '/' + oldname, node.parentPath + '/' + node.name)
        }
      }
    })
  })
}
NetworkManager.prototype.renameSubNodes = function (yfsikeys, oldParentPath, parentPath) {
  var self = this
  for (var j = 0; j < yfsikeys.length; j++) {
    var node = self.getFileMetaByContentID(yfsikeys[j])
    self.mutualExcluse(node.contentID, function () {
      if (node.parentPath === oldParentPath) {
        node.parentPath = parentPath
        self.yFSIndex.set(node.contentID, node)
        if (node.type === util.DIRECTORY_TYPE) {
          self.renameSubNodes(yfsikeys, oldParentPath + '/' + node.name, node.parentPath + '/' + node.name)
        }
      }
    })
  }
}

NetworkManager.prototype.deleteFile = function (contentID) {
  var self = this
  self.onceReady(function () {
    self.mutualExcluse(contentID, function () {
      var node = self.getFileMetaByContentID(contentID)
      if (node.type === util.DIRECTORY_TYPE) {
        var yfsikeys = self.yFSIndex.keys()
        self.deleteSubNodes(yfsikeys, node.parentPath + '/' + node.name)
      }
      if (self.getFileByContentID(contentID)) self.yFSNodes.delete(contentID)
      if (node.replydbID) self.yFSNodes.delete(node.replydbID)
      self.yFSIndex.delete(contentID)
    })
  })
}
NetworkManager.prototype.deleteSubNodes = function (yfsikeys, parentPath) {
  var self = this
  for (var j = 0; j < yfsikeys.length; j++) {
    var node = self.getFileMetaByContentID(yfsikeys[j])
    self.mutualExcluse(node.contentID, function () {
      if (node.parentPath === parentPath) {
        if (node.type === util.DIRECTORY_TYPE) {
          self.deleteSubNodes(yfsikeys, node.parentPath + '/' + node.name)
        }
        if (self.getFileByContentID(node.contentID)) self.yFSNodes.delete(node.contentID)
        if (node.replydbID) self.yFSNodes.delete(node.replydbID)
        self.yFSIndex.delete(node.contentID)
      }
    })
  }
}

// TODO: delete after finish testing bindCodeMirror method
// NetworkManager.prototype.changeTextFile = function (contentID, delta) {
//   var self = this
//   self.onceReady(function () {
//     self.mutualExcluse(contentID, function () {
//       var ytext = self.getFileByContentID(contentID)
//       if (!ytext) return
//
//       // apply the delta to the ytext instance
//       var start = delta.start
//
//       // apply the delete operation first
//       if (delta.removed.length > 0) {
//         var delLength = 0
//         for (var j = 0; j < delta.removed.length; j++) {
//           delLength += delta.removed[j].length
//         }
//         // "enter" is also a character in our case
//         delLength += delta.removed.length - 1
//         ytext.delete(start, delLength)
//       }
//
//       // apply insert operation
//       insertChunked(ytext, start, delta.text.join('\n'))
//     })
//   })
// }

NetworkManager.prototype.changeSelection = function (data) {
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

// CodeMirror implementation..
NetworkManager.prototype.unbindCodeMirror = function (contentID) {
  var self = this
  var ytext = self.getFileByContentID(contentID)
  var binding = self.observedInstances[contentID]
  if (binding) {
    ytext.unobserve(binding.yCallback)
    binding.editor.off('changes', binding.editorCallback)
    self.getFileByContentID(binding.replydbID).unobserve(binding.yReplyCallback)
    binding.editor.removeListener('changeReply', binding.editorCallback)
    delete self.observedInstances[contentID]
  }
}

NetworkManager.prototype.bindCodeMirror = function (contentID, editorInstance, replydbID, replyInstance) {
  var self = this
  // this function makes sure that either the
  // codemirror event is executed, or the yjs observer is executed
  var token = true
  function mutualExcluse (f) {
    if (token) {
      token = false
      try {
        f()
      } catch (e) {
        token = true
        throw new Error(e)
      }
      token = true
    }
  }

  var ytext = self.getFileByContentID(contentID)
  editorInstance.setValue(ytext.toString())

  var yreply = self.getFileByContentID(replydbID)

  function codeMirrorCallback (cm, deltas) {
    mutualExcluse(function () {
      for (var i = 0; i < deltas.length; i++) {
        var delta = deltas[i]
        var start = editorInstance.indexFromPos(delta.from)
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
        // ytext.insert(start, delta.text.join('\n'))
        insertChunked(ytext, start, delta.text.join('\n'))
      }

      // update reply line num
      replyInstance.updateLineChange(cm, yreply)
    })
  }
  editorInstance.on('changes', codeMirrorCallback)

  function yCallback (event) {
    mutualExcluse(function () {
      let from = editorInstance.posFromIndex(event.index)
      if (event.type === 'insert') {
        let to = from
        editorInstance.replaceRange(event.values.join(''), from, to)
      } else if (event.type === 'delete') {
        let to = editorInstance.posFromIndex(event.index + event.length)
        editorInstance.replaceRange('', from, to)
      }
    })
  }
  ytext.observe(yCallback)

  // set Reply on CodeMirror
  replyInstance.setReplies(replydbID, editorInstance, self.getReplyContent(replydbID))
  // yReplyCallback({type: 'insert', values: yreply.toArray()})

  function replyCallback (contentID, optype, opval) {
    self.onceReady(function () {
      mutualExcluse(function () {
        var replydb = self.getFileByContentID(contentID)
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
          for (var j = 0; j < replydb.toArray().length; j++) {
            reply = replydb.get(j)
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
  replyInstance.on('changeReply', replyCallback)

  function yReplyCallback (event) {
    mutualExcluse(function () {
      debug('sync: got reply')

      if (event.type === 'insert') {
        setTimeout(function () {
          for (var i = 0; i < event.values.length; i++) {
            var reply = event.values[i]
            replyInstance.addReply({
              user_id: reply.get('user_id'),
              user_name: reply.get('user_name'),
              user_picture: reply.get('user_picture'),
              reply_id: reply.get('reply_id'),
              insert_time: reply.get('insert_time'),
              level: reply.get('level'),
              order: reply.get('order'),
              line_num: reply.get('line_num'),
              content: reply.get('content')
            })
          }
        }, 50)
      } else if (event.type === 'delete') {
        for (var i = 0; i < event.values.length; i++) {
          var reply = event.values[i]
          replyInstance.removeReply({
            reply_id: reply.get('reply_id')
          })
        }
      // } else if (event.type === 'update') {
        // TODO: add reply content update feature
        // maybe use observe deep
      }
    })
  }
  yreply.observe(yReplyCallback)

  self.observedInstances[contentID] = {
    editor: editorInstance,
    yCallback: yCallback,
    editorCallback: codeMirrorCallback,
    replydbID: replydbID,
    yReplyCallback: yReplyCallback,
    replyCallback: replyCallback
  }
}

NetworkManager.prototype.unbindQuill = function (contentID) {
  var self = this
  var yrichtext = self.getFileByContentID(contentID)
  var binding = self.observedInstances[contentID]
  if (binding) {
    yrichtext.unobserve(binding.yCallback)
    binding.editor.off('text-change', binding.editorCallback)
    delete self.observedInstances[contentID]
  }
}
NetworkManager.prototype.bindQuill = function (contentID, quill) {
  var self = this
  // this function makes sure that either the
  // quill event is executed, or the yjs observer is executed
  var token = true
  function mutualExcluse (f) {
    if (token) {
      token = false
      try {
        f()
      } catch (e) {
        quill.update()
        token = true
        throw new Error(e)
      }
      quill.update()
      token = true
    }
  }

  var yrichtext = self.getFileByContentID(contentID)
  quill.setContents(yrichtext.toDelta())
  quill.update()

  function quillCallback (delta) {
    mutualExcluse(function () {
      yrichtext.applyDelta(delta, quill)
    })
  }
  // TODO: Investigate if 'editor-change' is more appropriate!
  quill.on('text-change', quillCallback)

  function compareAttributes (a, b) {
    return a === b || (a == null && b == null) || (a != null && b != null && a.constructor === Array && a[0] === b[0] && a[1] === b[1])
    /* the same as..
    if (typeof a === 'string' || a == null) return a === b || a == null && b == null // consider undefined
    else return a[0] === b[0] && a[1] === b[1]
    */
  }

  function yCallback (event) {
    mutualExcluse(function () {
      var v // helper variable
      var curSel // helper variable (current selection)
      if (event.type === 'insert') {
        var valuePointer = 0
        while (valuePointer < event.values.length) {
          var vals = []
          while (valuePointer < event.values.length && event.values[valuePointer].constructor !== Array) {
            vals.push(event.values[valuePointer])
            valuePointer++
          }
          if (vals.length > 0) { // insert new content (text and embed)
            var position = 0
            var insertSel = {}
            for (var l = 0; l < event.index; l++) {
              v = yrichtext._content[l].val
              if (v.constructor !== Array) {
                position++
              } else {
                insertSel[v[0]] = v[1]
              }
            }
            // consider the case (this is markup): "hi *you*" & insert "d" at position 3
            // Quill may implicitely make "d" bold (dunno if thats true). Yjs, however, expects d not to be bold.
            // So we check future attributes and explicitely set them, if neccessary
            l = event.index + event.length
            while (l < yrichtext._content.length) {
              v = yrichtext._content[l].val
              if (v.constructor === Array) {
                if (!insertSel.hasOwnProperty(v[0])) {
                  insertSel[v[0]] = null
                }
              } else {
                break
              }
              l++
            }
            // TODO: you definitely should exchange null with the new "false" approach..
            // Then remove the following! :
            for (var name in insertSel) {
              if (insertSel[name] == null) {
                insertSel[name] = false
              }
            }
            if (yrichtext.length === position + vals.length && vals[vals.length - 1] !== '\n') {
              // always make sure that the last character is enter!
              var end = ['\n']
              var sel = {}
              // now we remove all selections
              for (name in insertSel) {
                if (insertSel[name] !== false) {
                  end.unshift([name, false])
                  sel[name] = false
                }
              }
              Y.Array.typeDefinition.class.prototype.insert.call(yrichtext, position + vals.length, end)
              // format attributes before pushing to quill!
              quill.insertText(position, '\n', yrichtext._formatAttributesForQuill(sel))
            }
            // create delta from vals
            var delta = []
            if (position > 0) {
              delta.push({ retain: position })
            }
            var currText = []
            vals.forEach(function (v) {
              if (typeof v === 'string') {
                currText.push(v)
              } else {
                if (currText.length > 0) {
                  delta.push({
                    insert: currText.join(''),
                    attributes: insertSel
                  })
                  currText = []
                }
                delta.push({
                  insert: v,
                  attributes: insertSel
                })
              }
            })
            if (currText.length > 0) {
              delta.push({
                insert: currText.join(''),
                attributes: insertSel
              })
            }
            // format attributes before pushing to quill!
            delta.forEach(d => {
              if (d.attributes != null && Object.keys(d.attributes).length > 0) {
                d.attributes = yrichtext._formatAttributesForQuill(d.attributes)
              } else {
                delete d.attributes
              }
            })
            quill.updateContents(delta)
            // quill.insertText(position, vals.join(''), insertSel)
          } else { // Array (selection)
            // a new selection is created
            // find left selection that matches newSel[0]
            curSel = null
            var newSel = event.values[valuePointer++] // get selection, increment counter
            // denotes the start position of the selection
            // (without the selection objects)
            var selectionStart = 0
            for (var j = event.index + valuePointer - 2/* -1 for index, -1 for incremented valuePointer */; j >= 0; j--) {
              v = yrichtext._content[j].val
              if (v.constructor === Array) {
                // check if v matches newSel
                if (newSel[0] === v[0]) { // compare names
                  // found a selection
                  // update curSel and go to next step
                  curSel = v[1]
                  break
                }
              } else {
                selectionStart++
              }
            }
            // make sure to decrement j, so we correctly compute selectionStart
            for (; j >= 0; j--) {
              v = yrichtext._content[j].val
              if (v.constructor !== Array) {
                selectionStart++
              }
            }
            // either a selection was found {then curSel was updated}, or not (then curSel = null)
            if (compareAttributes(newSel[1], curSel)) {
              // both are the same. not necessary to do anything
              continue
            }
            // now find out the range over which newSel has to be created
            var selectionEnd = selectionStart
            for (var k = event.index + valuePointer/* -1 for incremented valuePointer, +1 for algorithm */; k < yrichtext._content.length; k++) {
              v = yrichtext._content[k].val
              if (v.constructor === Array) {
                if (v[0] === newSel[0]) { // compare names
                  // found another selection with same attr name
                  break
                }
              } else {
                selectionEnd++
              }
            }
            // create a selection from selectionStart to selectionEnd
            if (selectionStart !== selectionEnd) {
              // format attributes before pushing to quill!!
              var format = {}
              format[newSel[0]] = newSel[1] == null ? false : newSel[1]
              format = yrichtext._formatAttributesForQuill(format)
              if (newSel[0] === '_block') {
                var removeFormat = {}
                yrichtext._quillBlockFormats.forEach((f) => { removeFormat[f] = false })
                quill.formatText(selectionStart, selectionEnd - selectionStart, removeFormat)
              }
              quill.formatText(selectionStart, selectionEnd - selectionStart, format)
            }
          }
        }
      } else if (event.type === 'delete') {
        // sanitize events
        var myEvents = []
        for (var i = 0, _i = 0; i < event.length; i++) {
          if (event.values[i].constructor === Array) {
            if (i !== _i) {
              myEvents.push({
                type: 'text',
                length: i - _i,
                index: event.index
              })
            }
            _i = i + 1
            myEvents.push({
              type: 'selection',
              val: event.values[i],
              index: event.index
            })
          }
        }
        if (i !== _i) {
          myEvents.push({
            type: 'text',
            length: i - _i,
            index: event.index
          })
        }
        // ending sanitizing.. start brainfuck
        myEvents.forEach(function (event) {
          if (event.type === 'text') {
            var pos = 0
            for (var u = 0; u < event.index; u++) {
              v = yrichtext._content[u].val
              if (v.constructor !== Array) {
                pos++
              }
            }
            quill.deleteText(pos, event.length)
          } else {
            curSel = null
            var from = 0
            var x
            for (x = event.index - 1; x >= 0; x--) {
              v = yrichtext._content[x].val
              if (v.constructor === Array) {
                if (v[0] === event.val[0]) { // compare names
                  curSel = v[1]
                  break
                }
              } else {
                from++
              }
            }
            for (; x >= 0; x--) {
              v = yrichtext._content[x].val
              if (v.constructor !== Array) {
                from++
              }
            }
            var to = from
            for (x = event.index; x < yrichtext._content.length; x++) {
              v = yrichtext._content[x].val
              if (v.constructor === Array) {
                if (v[0] === event.val[0]) { // compare names
                  break
                }
              } else {
                to++
              }
            }
            if (!compareAttributes(curSel, event.val[1]) && from !== to) {
              // format attributes before pushing to quill!!
              var format = {}
              format[event.val[0]] = curSel == null ? false : curSel
              format = yrichtext._formatAttributesForQuill(format)
              if (event.val[0] === '_block') {
                var removeFormat = {}
                yrichtext._quillBlockFormats.forEach((f) => { removeFormat[f] = false })
                quill.formatText(from, to - from, removeFormat)
              }
              quill.formatText(from, to - from, format)
            }
          }
        })
      }
      quill.update()
    })
  }
  yrichtext.observe(yCallback)

  self.observedInstances[contentID] = {
    editor: quill,
    yCallback: yCallback,
    editorCallback: quillCallback
    // replydbID: replydbID,
    // yReplyCallback: yReplyCallback,
    // replyCallback: replyCallback
  }
}

NetworkManager.prototype._onLostPeer = function (peer) {
  var self = this
  self.ySelections.toArray().forEach(function (sel, i) {
    if (sel.id === peer.id) {
      self.ySelections.delete(i)
    }
  })
}

NetworkManager.prototype.destroy = function () {
  var self = this
  // TODO: Add a proper destroy function in simple-signal
  self.peers.forEach(function (peer) {
    peer.destroy()
  })
  self.peers = []
  self.client = null
  self.voice = null
  self.id = null
  self.yFSIndex = null
  self.yFSNodes = null
  self.ySelections = null
  self.lastSelection = null
}

module.exports = NetworkManager
