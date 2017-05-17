var FileSystem = require('./filesystem/filesystem')
var Interface = require('./interface/interface')
var Editor = require('./editor/editor')
var Remote = require('./network/multihack-core')
var HyperHostWrapper = require('./network/hyperhostwrapper')
var util = require('./filesystem/util')
var Voice = require('./network/voice')
var lang = require('./interface/lang/lang')
var lg = lang.get.bind(lang)
var Reply = require('./editor/reply')
var User = require('./auth/user')

var DEFAULT_HOSTNAME = 'https://quiet-shelf-57463.herokuapp.com'
var MAX_FORWARDING_SIZE = 5 * 1000 * 1000 // 5mb limit for non-p2p connections (validated by server)

function Multihack (config) {
  var self = this
  if (!(self instanceof Multihack)) return new Multihack(config)

  config = config || {}

  Interface.on('openFile', function (e) {
    if (Editor._workingFile) {
      if (Editor._workingFile.path === e.path) return
      console.log('switching file: ' + Editor._workingFile.path);
    }
    console.log('interface open file: ' + e.path);
    FileSystem.getFile(e.path).doc.setValue(self._remote.getContent(e.path))
    Editor.open(e.path)
    self._remote.setObserver(e.path + '.replydb','reply')
    self._remote.setObserver(e.path,'text')
    Reply.setReplies(e.path + '.replydb', Editor._cm, self._remote.getReplyContent(e.path + '.replydb'))
  })

  Interface.on('addFile', function (e) {
    var created = FileSystem.mkfile(e.path)

    if (created) {
      Interface.treeview.addFile(e.parentElement, FileSystem.get(e.path))
      Editor.open(e.path)
    }
    self._remote.createFile(e.path)
    if (created) {
      self._remote.setObserver(e.path + '.replydb','reply')
      self._remote.setObserver(e.path,'text')
      Reply.setReplies(e.path + '.replydb', Editor._cm, self._remote.getReplyContent(e.path + '.replydb'))
    }
  })

  FileSystem.on('unzipFile', function (file) {
    file.read(function (content) {
      self._remote.createFile(file.path, content)
    })
  })

  Interface.on('addDir', function (e) {
    var created = FileSystem.mkdir(e.path)

    if (created) {
      Interface.treeview.addDir(e.parentElement, FileSystem.get(e.path))
    }
    self._remote.createDir(e.path)
  })

  Interface.on('removeDir', function (e) {
    var dir = FileSystem.get(e.path)
    var workingFile = Editor.getWorkingFile()

    Interface.confirmDelete(dir.name, function () {
      Interface.treeview.remove(e.parentElement, dir)

      FileSystem.getContained(e.path).forEach(function (file) {
        if (workingFile && file.path === workingFile.path) {
          Editor.close()
        }
        self._remote.deleteFile(file.path)
      })
      self._remote.deleteFile(e.path)
    })
  })

  Interface.on('deleteCurrent', function (e) {
    var workingFile = Editor.getWorkingFile()
    if (!workingFile) return
    Editor.close()

    Interface.confirmDelete(workingFile.name, function () {
      var workingPath = workingFile.path
      var parentElement = Interface.treeview.getParentElement(workingPath)
      if (parentElement) {
        Interface.treeview.remove(parentElement, FileSystem.get(workingPath))
      }
      FileSystem.delete(workingPath)
      self._remote.deleteFile(workingPath)
    })
  })

  self.embed = util.getParameterByName('embed') || null
  self.roomID = util.getParameterByName('room') || null
  self.hostname = config.hostname

  Interface.on('saveAs', function (saveType) {
    FileSystem.getContained('').forEach(function (file) {
      file.write(self._remote.getContent(file.path))
    })
    FileSystem.saveProject(saveType, function (success) {
      if (success) {
        Interface.alert(lg('save_success_title'), lg('save_success'))
      } else {
        Interface.alert(lg('save_fail_title'), lg('save_fail'))
      }
    })
  })

  Interface.on('deploy', function () {
    HyperHostWrapper.on('error', function (err) {
      Interface.alert(lg('deploy_fail_title'), err)
    })

    HyperHostWrapper.on('ready', function (url) {
      Interface.alertHTML(lg('deploy_title'), lg('deploy_success', {url: url}))
    })

    HyperHostWrapper.deploy(FileSystem.getTree())
  })

  Interface.hideOverlay()
  if (self.embed) {
    self._initRemote()
  } else {
    self._initRemote(function () {
      Interface.getProject(function (project) {
        if (project) {
          Interface.showOverlay()
          FileSystem.loadProject(project, function (tree) {
            Interface.treeview.rerender(tree)
            Interface.hideOverlay()
          })
        }
      })
    })
  }
}

Multihack.prototype._initRemote = function (cb) {
  var self = this

  function onRoom (data) {
    self.roomID = data.room
    Interface.setRoom(self.roomID)
    window.history.pushState('Multihack', lg('history_item', {room: self.roomID}), '?room=' + self.roomID + (self.embed ? '&embed=true' : ''))
    self.nickname = data.nickname
    self._remote = new Remote({
      hostname: self.hostname,
      room: self.roomID,
      nickname: self.nickname,
      voice: Voice,
      wrtc: null
    })

    self._remote.posFromIndex = function (filePath, index, cb) {
      cb(FileSystem.getFile(filePath).doc.posFromIndex(index))
    }

    self._remote.replyUpdate = function (filePath, replies, cb) {
      cb(Reply.getLineChange(Editor._cm, replies))
    }

    document.getElementById('voice').style.display = ''
    document.getElementById('network').style.display = ''

    Interface.on('voiceToggle', function () {
      self._remote.voice.toggle()
    })
    Interface.on('showNetwork', function () {
      Interface.showNetwork(self._remote.peers, self.roomID, self._remote.nop2p, self._remote.mustForward)
    })

    self._remote.on('changeSelection', function (selections) {
      Editor.highlight(selections)
    })
    self._remote.on('changeFile', function (data) {
      Editor.change(data.filePath, data.change)
    })
    self._remote.on('deleteFile', function (data) {
      var parentElement = Interface.treeview.getParentElement(data.filePath)
      var workingFile = Editor.getWorkingFile()

      if (workingFile && data.filePath === workingFile.path) {
        Editor.close()
      }

      if (parentElement) {
        Interface.treeview.remove(parentElement, FileSystem.get(data.filePath))
      }
      FileSystem.delete(data.filePath)
    })
    self._remote.on('createFile', function (data) {
      FileSystem.getFile(data.filePath).write(data.content)
      Interface.treeview.rerender(FileSystem.getTree())
      // if (!Editor.getWorkingFile()) {
      //   self._remote.setObserver(data.filePath + '.replydb','reply')
      //   self._remote.setObserver(data.filePath,'text')
      //   Editor.open(data.filePath)
      //   FileSystem.getFile(data.filePath).doc.setValue(self._remote.getContent(data.filePath))
      //   Reply.setReplies(data.filePath + '.replydb', Editor._cm, self._remote.getReplyContent(data.filePath + '.replydb'))
      // }
    })
    self._remote.on('createDir', function (data) {
      FileSystem.mkdir(data.path)
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self._remote.on('lostPeer', function (peer) {
      if (self.embed) return
      Interface.flashTooltip('tooltip-lostpeer', lg('lost_connection', {nickname: peer.metadata.nickname}))
    })
    self._remote.on('changeReply', function (data) {
      // filePath, type, name, value, replies
      if (data.type === 'insert') {
        setTimeout(function() {
          for (var i = 0; i < data.replies.length; i++) {
            var reply = data.replies[i]
            console.log('is reply arrived on index.js? ' + data.filePath)
            console.log('index.js _remote.on changeReply insert: ' + reply.get('reply_id'));
            Reply.addReply({
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
        },50)
      } else if (data.type === 'delete') {
        for (var i = 0; i < data.replies.length; i++) {
          var reply = data.replies[i]
          Reply.removeReply({
            reply_id: reply.get('reply_id')
          })
        }
      } else if (data.type === 'update') {
        // line_num updated on self._remote.replyUpdate
        // TODO: update reply feature
      }
    })

    Editor.on('change', function (data) {
      self._remote.changeFile(data.filePath, data.change)
    })
    Editor.on('selection', function (data) {
      self._remote.changeSelection(data)
    })
    Reply.on('changeReply', function (data) {
      self._remote.changeReply(data.filePath, data.optype, data.opval)
    })

    if (typeof cb !== 'undefined') cb()
  }

  // Random starting room (to be changed) or from query
  // if (!self.roomID && !self.embed) {
  //   Interface.getRoom(Math.random().toString(36).substr(2), onRoom)
  // } else if (!self.embed) {
  //   Interface.getNickname(self.roomID, onRoom)
  // } else {
  //   Interface.embedMode()
    onRoom({
      room: self.roomID || 'rellat-otter-dev-v0.1', // Math.random().toString(36).substr(2),
      nickname: User.user_id //lg('default_nickname')
    })
  // }
}

module.exports = Multihack
