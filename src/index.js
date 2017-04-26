var FileSystem = require('./filesystem/filesystem')
var Interface = require('./interface/interface')
var Editor = require('./editor/editor')
var util = require('./filesystem/util')


// var DEFAULT_HOSTNAME = 'https://quiet-shelf-57463.herokuapp.com'
var MAX_FORWARDING_SIZE = 5*1000*1000 // 5mb limit for non-p2p connections (validated by server)

function Multihack (config) {
  var self = this
  if (!(self instanceof Multihack)) return new Multihack(config)

  config = config || {}



  Interface.on('openFile', function (e) {
    Editor.open(e.path)
  })

  Interface.on('addFile', function (e) {
    var created = FileSystem.mkfile(e.path)
    if (created) {
      Interface.treeview.addFile(e.parentElement, FileSystem.get(e.path))
      FileSystem.yfs.set(e.path,Y.Text)
      Editor.open(e.path)
    }
  })

  Interface.on('addDir', function (e) {
    var created = FileSystem.mkdir(e.path)
    if (created) {
      Interface.treeview.addDir(e.parentElement, FileSystem.get(e.path))
      FileSystem.yfs.set(e.path,'')
    }
  })

  Interface.on('removeFile', function (e) {
    var file = FileSystem.get(e.path)
    Interface.confirmDelete(file.name, function () {
      Interface.treeview.remove(e.parentElement, file)
      FileSystem.delete(e.path)
      FileSystem.yfs.delete(e.path)
    })
  })

  Interface.on('deleteCurrent', function (e) {
    var workingFile = Editor.getWorkingFile()
    
    Interface.confirmDelete(workingFile.name, function () {
      var workingPath = workingFile.path
      var parentElement = Interface.treeview.getParentElement(workingPath)
      if (parentElement) {
        Interface.treeview.remove(parentElement, FileSystem.get(workingPath))
      }
      FileSystem.delete(workingPath)
      FileSystem.yfs.delete(workingPath)
      Editor.close()
    })
  })

  self.embed = util.getParameterByName('embed') || null
  self.roomID = util.getParameterByName('room') || null
  self.hostname = config.hostname
  self.providedProject = false

  Interface.on('saveAs', function (saveType) {
    FileSystem.saveProject(saveType, function (success) {
      if (success) {
        Interface.alert('Save Completed', 'Your project has been successfully saved.')
      } else {
        Interface.alert('Save Failed', 'An error occured while trying to save your project.<br>Please select a different method.')
      }
    })
  })

  Interface.removeOverlay()
  if (self.embed) {
    self._initRemote()
  } else {
    Interface.getProject(function (project) {
      if (!project) {
        self._initRemote()
      } else {
        self.providedProject = true
        Interface.showOverlay()
        FileSystem.loadProject(project, function (tree) {
          Interface.treeview.render(tree)
          self._initRemote()
        })
      }
    })
  }
}

Multihack.prototype._initRemote = function () {
  var self = this
  
  function onRoom(data) {
    self.roomID = data.room
    window.history.pushState('Multihack', 'Multihack Room '+self.roomID, '?room='+self.roomID + (self.embed ? '&embed=true' : ''));
    self.nickname = data.nickname
    
    // initialize a shared object. This function call returns a promise!
    Y({
    db: {
        name: 'memory' // Data stored in each peer's browser. When all peer disconnect, data will disappears.
    },
    connector: {
        name: 'webrtc', // use webRTC for p2p connection.
        room: self.roomID
    },
    sourceDir: '/bower_components',
    share: {
        dir_tree: 'Map', // key: data.filePath, value: y_obj_id
        //code_editor: 'Text', // y.share.code_editor is of type Y.Text
        //cm_reply: 'Array', // { auth_id, line_num, order_num, level, value }
        // chat: 'Array', // { auth_id, value }
        peers: 'Array' // { user_id, auth_id, name, state, selection}
    }
    }).then(function (y) {
        window.yCodeMirror = y;

        // file system binding
        FileSystem.yfs = y.share.dir_tree;
        FileSystem.yfs.observe(function(event) {
          var file_path = event.name;
          var file_not_exists = !FileSystem.exists(file_path)

          console.log('yfs callback on: ' + file_path + ' type: ' + event.type)

          if (file_not_exists) {
            if(event.type == 'add') { 
              if(typeof event.value == 'string') {
                FileSystem.mkdir(file_path)
              } else {
                FileSystem.mkfile(file_path)
              }
            } else if(event.type == 'update') { // rename file or dir
            } else if(event.type == 'delete') {
            }
          }else {
            if(event.type == 'add') { 
            } else if(event.type == 'update') { // rename file or dir
            } else if(event.type == 'delete') {
              if(event.type == 'delete') {
                var parentElement = Interface.treeview.getParentElement(file_path)
                if (parentElement) {
                  Interface.treeview.remove(parentElement, FileSystem.get(file_path))
                }
                FileSystem.delete(file_path)
              }
            }
          }
          Interface.treeview.rerender(FileSystem.getTree())
          if (event.value instanceof Y.Text.typeDefinition.class) {
            if(typeof FileSystem.getFile(file_path).ytext == 'undefined') {
              var newfile = FileSystem.getFile(file_path)
              newfile.ytext = event.value;
            }
          }
        })

        //peer network monitor binding
        y.share.peers.push([{
          'user_id': y.connector.userId,
          'name': self.nickname
        }])
        // y.share.peers.observe(function(e){
        // })
        y.connector.onUserEvent(function(e) {
          if(e.action == 'userLeft') {
            var ypeers = y.share.peers.toArray()
            for(var i=0;i<ypeers.length;i++) {
              if(e.user == ypeers[i]['user_id']) {
                y.share.peers.delete(i)
              }
            }
          }
        })
    });
  }

  // Random starting room (to be changed) or from query
  if (!self.roomID && !self.embed) {
    Interface.getRoom(Math.random().toString(36).substr(2), onRoom)
  } else if (!self.embed) {
    Interface.getNickname(self.roomID, onRoom)
  } else {
    Interface.embedMode()
    onRoom({
      room: self.roomID || Math.random().toString(36).substr(2),
      nickname: 'Guest'
    })
  }
}

module.exports = Multihack
