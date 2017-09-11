/* global localStorage */
// y-js browser debug state

localStorage.debug = 'y:*,MH:*'
// Turn on debug log
var debug = require('debug')('MH:index')

var FileSystem = require('./filesystem/filesystem')
var Interface = require('./interface/interface')
var CodeEditor = require('./editor/codeeditor')
var DocEditor = require('./editor/doceditor')
var HtmlEditor = require('./editor/htmlviewer')
var Network = require('./network/network')
// var HyperHostWrapper = require('./network/hyperhostwrapper')
var util = require('./filesystem/util')
var Voice = require('./network/voice')
var lang = require('./interface/lang/lang')
var lg = lang.get.bind(lang)
var Reply = require('./editor/reply')
var User = require('./auth/user')

// FileSystem is an virtual file system made with object(File, Folder) and array.
// self.netManager is multihack-core. And it controls network and realtime document sync(CRDT).
// for document sync, I use yjs module.
// FileSystem 오브젝트는 js object와 array로 만든 가상의 파일시스템이다.
// self.netManager (multihack-core)는 네트워크 및 CRDT 문서 동기화를 하는 모듈이다.

function Multihack (config) {
  var self = this
  if (!(self instanceof Multihack)) return new Multihack(config)
  // make it as an object.
  // 함수로 불러도 오브젝트로 생성해서 반환한다.

  config = config || {}
  // config: { hostname }

  self.execWhenTargetSet = function (target, f) {
    function ft () {
      if (target) f()
      else setTimeout(ft, 50)
    }
    setTimeout(ft, 50)
  }

  self._openView = function (e) {
    var view = Interface.workspacePane.isOnPane(e.path)
    if (view) {
      Interface.workspacePane.changeView(view)
      return
    }
    var filenode = FileSystem.getFileByPath(e.path)
    // var filenode = FileSystem.getFileByPath(e.path)
    debug('open view with type: ' + filenode.type)

    self.execWhenTargetSet(filenode.contentID, function () {
      if (filenode.type === 'text') {
        view = new CodeEditor()
        var reply = new Reply({cm: view._cm, contentID: filenode.replydbID})
        view.open(e.path, self.netManager, reply)
        // setting an observer for document sync.
        // 실시간 문서 협업 동기화를 하려고 에디터에서 일어나는 액션을 감시한다. 문서와 문서안에 삽입되는 댓글을 감시한다.

        // Load and set reply data after file opens.
        // 에디터에 문서가 로딩되면 그 위에 댓글을 로드해서 삽입한다.
      } else if (filenode.type === 'quilljs') {
        view = new DocEditor()
        view.open(e.path, self.netManager)
        // self.netManager.bindQuill(e.contentID, view._quill)
        // } else if(util.findFileType(e.path) === 'image') {
        //   view = new HtmlEditor({content:''})
        //   view.open(e.path,self.netManager)
        //   // TODO: image viewer 만든다.
      } else {
        view = new HtmlEditor({
          content: 'The file will not be displayed in the editor because it is either binary, very large or uses an unsupported text encoding.'
        })
        view.open(e.path, null)
      }

      Interface.workspacePane.addView(filenode.name, view)
    })
  }

  Interface.workspacePane.on('viewChange', function (e) {
    // e.view is focused view
  })

  Interface.on('openFile', function (e) {
    // call when gui opens file.
    // gui에서 파일을 열때 호출한다.
    debug('interface try to open file: ' + e.path)
    self._openView(e)
  })

  Interface.on('addFile', function (e) {
    // call when gui add file on treeview
    // 파일/폴더를 생성하는 모달 창에서 파일을 클릭하면 호출한다.
    var parentPath = util.getParentPath(e.path)
    var fileoption = {
      name: util.getFilename(e.path),
      type: util.findFileType(e.path),
      parentPath: parentPath
    }
    debug('create filenode: ' + JSON.stringify(fileoption))
    if (FileSystem.mkfile(fileoption)) {
      self.netManager.createFile(fileoption.parentPath, fileoption.name, fileoption.type)
      var filenode = self.netManager.getFileMetaByPath(e.path)
      FileSystem.getFileByPath(e.path).change({
        contentID: filenode.contentID,
        replydbID: filenode.replydbID
      })
      Interface.treeview.rerender(FileSystem.getTree())
      self._openView(e)
    }
  })

  Interface.on('addDir', function (e) {
    // call when gui add directory
    // 파일/폴더를 생성하는 모달 창에서 폴더를 클릭하면 호출한다.
    var parentPath = util.getParentPath(e.path)
    var fileoption = {
      name: util.getFilename(e.path),
      parentPath: parentPath
    }
    debug('create filenode: ' + JSON.stringify(fileoption))
    if (FileSystem.mkdir(fileoption)) {
      self.netManager.createDir(fileoption.parentPath, fileoption.name)
      var filenode = self.netManager.getFileMetaByPath(e.path)
      FileSystem.getFileByPath(e.path).change({
        contentID: filenode.contentID
      })
      Interface.treeview.rerender(FileSystem.getTree())
    }
  })

  Interface.on('renameFile', function (e) {
    // call when gui delete directory
    // 이벤트가 발생 한 file의 path로 fileSystem에서 file을 받아온다.
    var filenode = e.file
    // var filenode = FileSystem.getFileByPath(e.path)

    // get new file/folder name
    // 수정될 파일이나 폴더 이름을 받는다.
    Interface.renameDialog(filenode.name, function (data) {
      var success = false
      if (filenode.type === util.DIRECTORY_TYPE) {
        if (FileSystem.changeDirInfo(filenode.path, {name: data.newName})) success = true
      } else {
        if (FileSystem.changeFileInfo(filenode.path, {name: data.newName})) success = true
      }
      // TODO: rename 할때 열린 창을 유지하는 방법에 대해 생각해본다.
      // 예를 들어 settimeout으로 100 tick 후에 getFileByContentID 해서 workingFile을 갱신하는 방법
      // get이 안 나올 경우 창을 닫는다.
      if (success) {
        debug('rename filenode: ' + JSON.stringify(filenode))
        self.netManager.renameFile(filenode.contentID, filenode.name)
        Interface.treeview.rerender(FileSystem.getTree())
      }
    })
  })

  Interface.on('deleteDir', function (e) {
    // call when gui delete directory
    // 폴더 삭제 버튼을 클릭하면 호출한다.
    var dir = e.file
    // var dir = FileSystem.getFileByPath(e.path)
    Interface.confirmDelete(dir.name, function () {
      // confirm deleting directory
      // 폴더 삭제 확인 모달 창을 띄우고 사용자가 확인하면 호출된다.
      FileSystem.getSubFilesInPath(e.path).forEach(function (node) {
        // 폴더에 포함된 파일이 Pane에 열려있으면 닫는다.
        if (node.type !== util.DIRECTORY_TYPE) {
          var view = Interface.workspacePane.isOnPane(node.path)
          if (view) Interface.workspacePane.closeView(view)
        }
      })
      FileSystem.delete(e.path)
      self.netManager.deleteFile(e.path)
      Interface.treeview.rerender(FileSystem.getTree())
    })
  })

  Interface.on('deleteFile', function (e) {
    if (!e.path) return
    var workingFile = e.file
    // var workingFile = FileSystem.getFileByPath(e.path)
    Interface.confirmDelete(workingFile.name, function () {
      // Pane에 열려있으면 닫는다.
      var view = Interface.workspacePane.isOnPane(e.path)
      if (view) Interface.workspacePane.closeView(view)
      // 파일을 삭제한다.
      var workingPath = workingFile.path
      self.netManager.deleteFile(workingPath)
      FileSystem.delete(workingPath)
      Interface.treeview.rerender(FileSystem.getTree())
    })
  })

  // url의 GET 인자와 옵션값을 받는다.
  self.embed = util.getParameterByName('embed') || null
  // embed 모드를 설정한다.
  self.roomID = util.getParameterByName('room') || null
  // 프로젝트 (룸)이름을 설정한다.
  self.hostname = config.hostname

// Originaly on Multihack, it show modal to write room id and user name, but we doesn't need it so I hide it.
// 앱을 시작했을 때 모달창이 떠서 룸 id, user id 등을 고르는 부분이 있었는데 필요없어서 숨겼다.
  Interface.hideOverlay()
  if (self.embed) {
    self._initRemote()
  } else {
    self._initRemote(function () {
      Interface.treeview.rerender(FileSystem.getTree())
    })
  }
}

Multihack.prototype._initRemote = function (cb) {
  var self = this
  // This use multihack-core to control network and realtime document sync(CRDT).
  // 네트워트 및 CRDT 협업 동기화 기능을 시작한다.
  function onRoom (data) {
    // overlaps funciton blocks to init room with conditional safety check.
    // 룸 id가 없을 때 룸 id를 생성해서 네트워크를 실행시키려고 함수를 2중으로 감쌌다.
    self.roomID = data.room
    Interface.setRoom(self.roomID)
    // putting room id to gui
    // 인터페이스에 룸 id를 삽입한다.
    window.history.pushState('Multihack', lg('history_item', {
      room: self.roomID
    }), '?room=' + self.roomID + (self.embed ? '&embed=true' : ''))
    // set new url with room id on browser.
    // 룸 id에 맞춰 브라우저 주소창의 url을 고친다.
    self.nickname = data.nickname
    self.netManager = new Network({
      hostname: self.hostname,
      room: self.roomID,
      nickname: self.nickname,
      voice: Voice,
      wrtc: null
    })
    // 네트워트 및 CRDT 협업 동기화 기능 모듈인 multihack-core를 시작한다.

    document.getElementById('voice').style.display = 'none'
    // 음성채팅 버튼을 보이게 한다.
    document.getElementById('network').style.display = 'none'
    // 접속한 사용자 보기 버튼을 보이게 한다.
    document.getElementById('save').style.display = 'none'

    // 음성 채팅 기능을 사용한다.
    Interface.on('voiceToggle', function () {
      self.netManager.voice.toggle()
    })
    Interface.on('showNetwork', function () {
      Interface.showNetwork(self.netManager.peers, self.roomID, self.netManager.nop2p, self.netManager.mustForward)
    })

    self.netManager.on('createDir', function (data) {
      // sync creation of directory.
      // 협업 중인 다른 사용자가 폴더을 생성한 경우 동기화 한다.
      FileSystem.getFileSync(data)
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self.netManager.on('createFile', function (data) {
      // sync creation of file
      // 협업 중인 다른 사용자가 파일을 생성한 경우 동기화 한다.
      FileSystem.getFileSync(data)
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self.netManager.on('updateDir', function (data) {
      // sync update of file meta data.
      if (!FileSystem.changeDirInfoSync(data)) debug('couldn\'t change dir info sent by network: ' + JSON.stringify(data))
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self.netManager.on('updateFile', function (data) {
      // sync update of file meta data.
      if (!FileSystem.changeFileInfoSync(data)) debug('couldn\'t change file info sent by network: ' + JSON.stringify(data))
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self.netManager.on('deleteFile', function (data) {
      // sync deletion of file.
      // 협업 중인 다른 사용자가 파일을 지운 경우 동기화 한다.
      if (FileSystem.existsByPath(data.path)) {
        var view = Interface.workspacePane.isOnPane(data.filePath)
        if (view) Interface.workspacePane.closeView(view)
        FileSystem.delete(data.filePath)
        Interface.treeview.rerender(FileSystem.getTree())
      }
    })

    self.netManager.on('lostPeer', function (peer) {
      // notify when other user disconnected.
      // 협업중인 사용자가 나가면 알림을 띄운다.
      if (self.embed) return
      Interface.flashTooltip('tooltip-lostpeer', lg('lost_connection', {
        nickname: peer.metadata.nickname
      }))
    })

    if (typeof cb !== 'undefined') cb()
  }

  // Create room id if it doesn't have one.
  // 룸 id가 없을 때 룸 id를 생성해서 네트워크를 실행시키고 룸id가 있으면 해당 id로 네트워크를 실행시킨다.
  // Random starting room (to be changed) or from query
  if (!self.roomID && !self.embed) {
    // Interface.getRoom(Math.random().toString(36).substr(2), onRoom)
    Interface.getRoom('rellat-otter-dev-v0.1', onRoom)
    // } else if (!self.embed) {
    //   Interface.getNickname(self.roomID, onRoom)
  } else {
    // Interface.embedMode()
    onRoom({
      room: self.roomID || 'rellat-otter-dev-v0.1', // Math.random().toString(36).substr(2),
      nickname: User.user_id // lg('default_nickname')
    })
  }
}

module.exports = Multihack
