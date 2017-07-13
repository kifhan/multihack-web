// y-js browser debug state

// localStorage.debug = 'y:*,MH:*'
// Turn on debug log
var debug = require('debug')('MH:index')

var FileSystem = require('./filesystem/filesystem')
var Interface = require('./interface/interface')
var CodeEditor = require('./editor/codeeditor')
var DocEditor = require('./editor/doceditor')
var HtmlEditor = require('./editor/htmlviewer')
var Remote = require('./network/multihack-core')
var HyperHostWrapper = require('./network/hyperhostwrapper')
var util = require('./filesystem/util')
var Voice = require('./network/voice')
var lang = require('./interface/lang/lang')
var lg = lang.get.bind(lang)
var Reply = require('./editor/reply')
var User = require('./auth/user')

function Multihack (config) {
  var self = this
  if (!(self instanceof Multihack)) return new Multihack(config)
  // make it as an object.
  // 함수로 불러도 오브젝트로 생성해서 반환한다.

  config = config || {}
  // config: { hostname }

  var _openView = function (e) {
    var view = Interface.workspacePane.isOnPane(e.path)
    if(view) {
      Interface.workspacePane.changeView(view)
      return
    }

    debug('open view with type: '+ util.findFileType(e.path))

    if(util.findFileType(e.path) === 'text') {
      view = new CodeEditor()
      view.open(e.path,self._remote)
      self._remote.onObserver(e.path + '.replydb')
      self._remote.onObserver(e.path)
      // setting an observer for document sync.
      // 실시간 문서 협업 동기화를 하려고 에디터에서 일어나는 액션을 감시한다. 문서와 문서안에 삽입되는 댓글을 감시한다.
      Reply.setReplies(e.path + '.replydb', view._cm, self._remote.getReplyContent(e.path + '.replydb'))
      // Load and set reply data after file opens.
      // 에디터에 문서가 로딩되면 그 위에 댓글을 로드해서 삽입한다.
    } else if(util.findFileType(e.path) === 'quilljs') {
      view = new DocEditor()
      view.open(e.path,self._remote)
    // } else if(util.findFileType(e.path) === 'image') {
    //   view = new HtmlEditor({content:''})
    //   view.open(e.path,self._remote)
    //   // TODO: image viewer 만든다.
    } else {
      view = new HtmlEditor({content:'The file will not be displayed in the editor because it is either binary, very large or uses an unsupported text encoding.'})
      view.open(e.path,null)
    }
    
    Interface.workspacePane.addView(util.getFilename(e.path),view)
  }
  Interface.workspacePane.on('viewChange', function(e){
    if(e.view.getWorkingFile().type === 'text') {
      var filepath = e.view.getWorkingFile().path
      Reply.setReplies(filepath + '.replydb', e.view._cm, self._remote.getReplyContent(filepath + '.replydb'))      
    }
  })

  Interface.on('openFile', function (e) {
    // call when gui opens file.
    // gui에서 파일을 열때 호출한다.
    debug('interface try to open file: ' + e.path);
    FileSystem.getFile(e.path).content = self._remote.getContent(e.path)
    // observe하지 않는 동안 업데이트 된 내용을 File obj와 동기화한다.

    // FileSystem is an virtual file system made with object(File, Folder) and array.
    // doc is document model in CodeMirror. It states contents and options.
    // self._remote is multihack-core. And it's controls network and realtime document sync(CRDT).
    // for document sync, I use yjs module. Above getContent function is getting file from yjs document object(y-text).
    // FileSystem 오브젝트는 js object와 array로 만든 가상의 파일시스템이다.
    // doc은 CodeMirror 에서 사용하는 오브젝트 모델인데 문서 상태 및 내용을 저장한다.
    // self._remote (multihack-core)는 네트워크 및 CRDT 문서 동기화를 하는 모듈이다.
    // 문서 동기화 모델(yjs의 y-text)에서 해당 문서의 내용을 가져와서 파일시스템의 파일에 넣는다.

    _openView(e)
  })

  Interface.on('addFile', function (e) {
    // call when gui add file on treeview
    // 파일/폴더를 생성하는 모달 창에서 파일을 클릭하면 호출한다.
    var created = FileSystem.mkfile(e.path)
    // it ignores when it's same filename.
    // 같은 이름의 파일이 이미 있을 때는 무시한다.
    if (created) {
      Interface.treeview.addFile(e.parentElement, FileSystem.get(e.path))
      self._remote.createFile(e.path)
      // DOM의 인터페이스에 파일을 추가한다.
      _openView(e)
    }
  })

  Interface.on('addDir', function (e) {
    // call when gui add directory
    // 파일/폴더를 생성하는 모달 창에서 폴더를 클릭하면 호출한다.
    var created = FileSystem.mkdir(e.path)
    if (created) {
      Interface.treeview.addDir(e.parentElement, FileSystem.get(e.path))
      self._remote.createDir(e.path)
    }
  })

  Interface.on('removeDir', function (e) {
    // call when gui delete directory
    // 폴더 삭제 버튼을 클릭하면 호출한다.
    var dir = FileSystem.get(e.path)

    Interface.confirmDelete(dir.name, function () {
      // confirm deleting directory
      // 폴더 삭제 확인 모달 창을 띄우고 사용자가 확인하면 호출된다.
      Interface.treeview.remove(e.parentElement, dir)
      // 인터페이스에서 폴더이름을 지운다.
      FileSystem.getContained(e.path).forEach(function (file) {
        // 폴더 안에 파일이 있으면 먼저 다 지운다.
        var view = Interface.workspacePane.isOnPane(file.path)
        if(view) Interface.workspacePane.closeView(view)
        self._remote.deleteFile(file.path)
      })
      self._remote.deleteFile(e.path)
    })
  })

  Interface.on('deleteFile', function (e) {
    // 파일을 삭제한다. Pane에 열려있으면 닫는다.
    if (!e.path) return
    var view = Interface.workspacePane.isOnPane(e.path)
    if(view) Interface.workspacePane.closeView(view)

    var workingFile = FileSystem.getFile(e.path)
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

  // url의 GET 인자와 옵션값을 받는다.
  self.embed = util.getParameterByName('embed') || null
  // embed 모드를 설정한다.
  self.roomID = util.getParameterByName('room') || null
  // 프로젝트 (룸)이름을 설정한다.
  self.hostname = config.hostname

  FileSystem.on('unzipFile', function (file) {
    // call when user upload zip file project.
    // 프로젝트 파일을 zip 형식으로 업로드 하는 경우 호출한다.
    self._remote.createFile(file.path, file.content)
      // 각각의 파일마다 y-text를 만든다.
      // FIXME: image, binary 등 내용 동기화를 할 필요없는 파일은 y-text를 만들 필요가 없다.
  })

  Interface.on('saveAs', function (saveType) {
    // exports project as Zip file
    // 인터페이스에서 zip으로 내보내기를 클릭하면 호출한다.
    FileSystem.getContained('').forEach(function (file) {
      file.content = self._remote.getContent(file.path)
      // 각각의 파일에 y-text 컨텐츠를 삽입한다.
    })
    FileSystem.saveProject(saveType, function (success) {
      // zip 파일을 만들어서 브라우저에서 다운로드하게 한다.
      if (success) {
        Interface.alert(lg('save_success_title'), lg('save_success'))
      } else {
        Interface.alert(lg('save_fail_title'), lg('save_fail'))
      }
    })
  })

  Interface.on('deploy', function () {
    // call when user click deploy button.
    // It use HyperHost module to run node.js app on browser.
    // 인터페이스에서 deploy 버튼을 클릭하면 호출한다.
    // HyperHost는 브라우저 안에 none.js 환경을 에뮬레이트해서 node.js 앱을 실행할 수 있게 해주는 모듈이다.
    HyperHostWrapper.on('error', function (err) {
      Interface.alert(lg('deploy_fail_title'), err)
    })

    HyperHostWrapper.on('ready', function (url) {
      Interface.alertHTML(lg('deploy_title'), lg('deploy_success', {url: url}))
    })

    HyperHostWrapper.deploy(FileSystem.getTree())
  })

  Reply.on('changeReply', function (e) {
    self._remote.changeReply(e.filePath, e.optype, e.opval)
  })

// Originaly on Multihack, it show modal to write room id and user name, but we doesn't need it so I hide it.
// 앱을 시작했을 때 모달창이 떠서 룸 id, user id 등을 고르는 부분이 있었는데 필요없어서 숨겼다.
  Interface.hideOverlay()
  if (self.embed) {
    self._initRemote()
  } else {
    self._initRemote(function () {
      // Interface.getProject(function (project) {
      //   if (project) {
      //     Interface.showOverlay()
      //     FileSystem.loadProject(project, function (tree) {
      //       Interface.treeview.rerender(tree)
      //       Interface.hideOverlay()
      //     })
      //   }
      // })
      // also hide zip project file load funciton.
      // 앱을 시작할 때 프로젝트 ZIP 파일을 로드하는 기능을 껐다.
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
    window.history.pushState('Multihack', lg('history_item', {room: self.roomID}), '?room=' + self.roomID + (self.embed ? '&embed=true' : ''))
    // set new url with room id on browser.
    // 룸 id에 맞춰 브라우저 주소창의 url을 고친다.
    self.nickname = data.nickname
    self._remote = new Remote({
      hostname: self.hostname,
      room: self.roomID,
      nickname: self.nickname,
      voice: Voice,
      wrtc: null
    })
    // 네트워트 및 CRDT 협업 동기화 기능 모듈인 multihack-core를 시작한다.

    self._remote.posFromIndex = function (filePath, index, cb) {
      // tracking user's text cursor. cb is callback function.
      // 사용자가 현재 편집중인 문서 상의 커서 위치를 추적한다. cb는 callback이다. cb에 등록한 함수에 에디터 커서 위치를 인자로 보낸다.
      cb(FileSystem.getFile(filePath).cmdoc.posFromIndex(index))
    }

    self._remote.replyUpdate = function (filePath, replies, cb) {
      // tracking pos of reply. Cause it changes when linebreaks.
      // 현재 문서 상의 댓글 위치를 추적한다. 문서의 줄바꿈 상태가 수정되었을 때 댓글의 위치를 조정하려고 만들었다. cb는 callback이다.
      cb(Reply.getLineChange(Reply.cm, replies))
    }

    document.getElementById('voice').style.display = 'none'
    // 음성채팅 버튼을 보이게 한다.
    document.getElementById('network').style.display = 'none'
    // 접속한 사용자 보기 버튼을 보이게 한다.
    document.getElementById('save').style.display = 'none'    

    // 음성 채팅 기능을 사용한다.
    Interface.on('voiceToggle', function () {
      self._remote.voice.toggle()
    })
    Interface.on('showNetwork', function () {
      Interface.showNetwork(self._remote.peers, self.roomID, self._remote.nop2p, self._remote.mustForward)
    })

    self._remote.on('deleteFile', function (data) {
      // sync deletion of file.
      // 협업 중인 다른 사용자가 파일을 지운 경우 동기화 한다.
      var parentElement = Interface.treeview.getParentElement(data.filePath)
      var view = Interface.workspacePane.isOnPane(data.filePath)
      if(view) Interface.workspacePane.closeView(view)

      if (parentElement) {
        Interface.treeview.remove(parentElement, FileSystem.get(data.filePath))
      }
      FileSystem.delete(data.filePath)
    })
    self._remote.on('createFile', function (data) {
      // sync creation of file
      // 협업 중인 다른 사용자가 파일을 생성한 경우 동기화 한다.
      FileSystem.getFile(data.filePath).content = data.content
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self._remote.on('createDir', function (data) {
      // sync creation of directory.
      // 협업 중인 다른 사용자가 폴더을 생성한 경우 동기화 한다.
      FileSystem.mkdir(data.path)
      Interface.treeview.rerender(FileSystem.getTree())
    })
    self._remote.on('lostPeer', function (peer) {
      // notify when other user disconnected.
      // 협업중인 사용자가 나가면 알림을 띄운다.
      if (self.embed) return
      Interface.flashTooltip('tooltip-lostpeer', lg('lost_connection', {nickname: peer.metadata.nickname}))
    })
    self._remote.on('changeReply', function (data) {
      // sync change of reply.
      // 협업 중인 사용자가 댓글을 달면 현재 사용자의 문서 에디터에 동기화한다.
      // filePath, type, name, value, replies
      if (data.type === 'insert') {
        setTimeout(function() {
          for (var i = 0; i < data.replies.length; i++) {
            var reply = data.replies[i]
            debug('index.js _remote.on changeReply insert: ' + reply.get('reply_id')+ ' on: '+data.filePath);
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
      nickname: User.user_id //lg('default_nickname')
    })
  }
}

module.exports = Multihack
