/* global Y, CodeMirror */
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var FileSystem = require('./../filesystem/filesystem')
var Editor = require('./editor')
var Util = require('./../filesystem/util')
var User = require('./../auth/user')

inherits(Reply, EventEmitter)

function Reply () {
  var self = this
  if (!(self instanceof Reply)) return new Reply()

  self.lineWidgets = null
  // self.replies = undefined // Y-Array로 댓글 오브젝트를 저장하는 배열이다.
  // reply db를 연결할 때 - 반복문으로 댓글을 올린다.
  // reply db연결을 끊을 때 - cm에서 doc이 끊어지면(swap) line widget이 제거된다.
  self.reinputs = null // 댓글입력노드를 저장하는 배열이다.
  // reply      { user_id, user_name, user_picture, reply_id, insert_time, level, order, line_num, content }
  // replyInput { user_id, user_name, user_picture, reply_id, insert_time, level, order, line_num, input_content }
  self.replyPanel = null
  self.cm = null
  self.timeticks = null
  self.timeouts = null
  self._workingFilePath = null
}

Reply.prototype.setReplies = function (filePath, cm, replies) {
  var self = this
  self._workingFilePath = filePath
  self.reinputs = []
  self.cm = cm
  if (self.timeticks) {
    for (var j = 0;j < self.timeticks.length;j++) {
      clearInterval(self.timeticks[j])
    }
  }
  self.timeticks = []
  if (self.timeouts) {
    for (var j = 0;j < self.timeouts.length;j++) {
      clearInterval(self.timeouts[j])
    }
  }
  self.timeouts = []
  self.setReplyPanel(self.cm)

  if (self.lineWidgets) {
    for (var j = self.lineWidgets.length - 1; j >= 0; j--) {
      self.removeReply({
        reply_id: self.lineWidgets[j].node.getAttribute('id').replace("reply-","")
      }, true)
    }
  }
  self.lineWidgets = []

  console.log('Reply: see replies structure: ' + JSON.stringify(replies));
  for (var i = 0; i < replies.length; i++) {
    self.addReply(replies[i])
  }
  console.log('Reply set init finished: ' + self._workingFilePath);
}

Reply.prototype.getLineChange = function (cm, replies) {
  var self = this
  if (!self.lineWidgets) return []
  var changeobjs = []
  if (typeof replies === 'undefined') return []
  var ch_replies = replies.toArray()
  for (var j = 0; j < self.lineWidgets.length; j++) {
    for (var i = 0; i < ch_replies.length; i++) {
      // console.log("compare " + self.lineWidgets[j].node.getAttribute("id") + " " + repliesarray[i].reply_id)
      if (self.lineWidgets[j].node.getAttribute('id') === 'reply-' + replies.get(i).get('reply_id')) {
        if (self.cm.getLineNumber(self.lineWidgets[j].line) != replies.get(i).get('line_num')) {
          // console.log("line_num needs to be change: " + replies.get(i).reply_id)
          var new_line_num = self.cm.getLineNumber(self.lineWidgets[j].line)
          if (!new_line_num) break
          changeobjs.push({
            reply_id: replies.get(i).get('reply_id'),
            line_num: new_line_num
          })
        }
      }
    }
    for (var k = 0; k < self.reinputs.length; k++) {
      // console.log("compare " + self.lineWidgets[j].node.getAttribute("id") + " " + self.reinputs[k].reply_id)
      if (self.lineWidgets[j].node.getAttribute('id') === 'reply-input-container-' + self.reinputs[k].reply_id) {
        // console.log("compare" + self.cm.getLineNumber(self.lineWidgets[j].line) + " " + self.reinputs[k].line_num)
        if (self.cm.getLineNumber(self.lineWidgets[j].line) != self.reinputs[k].line_num) {
          self.reinputs[k].line_num = self.cm.getLineNumber(self.lineWidgets[j].line)
        }
      }
    }
  }
  return changeobjs
}

Reply.prototype.addReplyInput = function (line, level, order) {
  var self = this
  self.removeReplyInput(); // 댓글 입력 노드가 여러개 생기지 않도록 이전에 생성된 입력노드를 제거한다.

  level = typeof level === 'undefined' ? 0 : level
  var instertorder = typeof order === 'undefined' ? 0 : order

  var rcount = 0
  for (var i = 0;i < self.lineWidgets.length;i++) {
    if (self.cm.getLineNumber(self.lineWidgets[i].line) === line) {
      rcount++
    }
  }
  if (typeof order === 'undefined') order = rcount
  console.log('input at count num: ' + rcount + ' order:' + order)

  // reply      { user_id, user_name, user_picture, reply_id, level, order, line_num, content }
  // replyInput { user_id, user_name, user_picture, reply_id, level, order, line_num, text_id }

  // 댓글 입력 노드를 삽입하는 함수이다.
  // line은 에디터 줄의 번호나 lineHandle 오브젝트, 혹은 이미 등록된 댓글 노드의 id가 될 수 있다.
  var reply_id = self.genId()
  var replyinputdom = document.createElement('DIV'); // 삽입할 노드를 생성한다.
  replyinputdom.setAttribute('class', 'reply-box')
  replyinputdom.setAttribute('id', 'reply-input-container-' + reply_id)
  replyinputdom.innerHTML = '<div class="reply" style="margin:0;padding:5px; background-color:#f6f7f9;">' +
    '<div class="reply-img" style="padding:5px; display:inline-block;">' +
    '<img src="' + User.user_picture + '" width="32px"></div>' +
    '<div class="reply-text-container" style="margin:0;padding-top:5px; vertical-align: top; display:inline-block;line-height:1.4;width: calc(100% - 60px);min-height:37px;">' +
    '<div class="reply-input-box" style="border:1px solid #aaa; background:#ffffff;">' +
    '<div id="reply-input-' + reply_id + '" class="reply-input-cell" style="padding:8px;color:#000;" contenteditable="true" tabindex="-1">' +
    '<span style="color:#888;">답글 달기...</span></div></div></div></div>'
    // 미리 작성한 html 템플레이트를 사용한다. https://thimbleprojects.org/mohawkduck/194618/

  function oarc () {
    var clickdom = document.getElementById('reply-input-' + reply_id)
    clickdom.addEventListener('keydown', self.onAddReply.bind(self, window.event, reply_id))
    clickdom.addEventListener('focus', self.replyinputfocus.bind(window.event))
    clickdom.focus()
  }
  self.timeouts.push(setTimeout(oarc, 100))

  if (order >= rcount) self.lineWidgets.push(self.cm.addLineWidget(line, replyinputdom))
  else self.lineWidgets.push(self.cm.addLineWidget(line, replyinputdom, { insertAt: instertorder }))

  self.reinputs.push({
    // self.reinputs 배열에 새로 만든 댓글입력노드를 삽입한다.
    user_id: User.user_id,
    user_name: User.user_name,
    user_picture: User.user_picture,
    reply_id: reply_id,
    insert_time: '',
    level: level,
    order: instertorder,
    line_num: line,
    input_content: ''
  })
}

Reply.prototype.replyinputfocus = function (e) {
  var self = this
  // 댓글입력노드에 텍스트 커서가 붙으면 호출된다.
  if (e.target.textContent != '답글 달기...') return
  // 안내문구가 있을 경우 안내문구를 삭제한다.
  e.target.innerHTML = ''
  while (e.target.firstChild) {
    e.target.removeChild(e.target.firstChild)
  }
}

Reply.prototype.onAddReply = function (event, reply_id) {
  var self = this
  event = window.event
  // console.log('reply keycode: '+event.keyCode +' or ' + event.which)
  // 댓글입력노드에서 키를 누르면 호출된다. enter 키를 감지하면 댓글노드를 삽입한다.
  // event는 onkeydown 이벤트에서 전달된 이벤트 오브젝트이다.
  // reply_id는 해당 노드 id의 번호이다.
  if (event.keyCode == 13 || event.which == 13) {
    // event.keyCode == 13 은 enter 키이다. event.which는 브라우져 호환성을 위해 삽입했다.
    // 댓글 입력 내용을 가져올 노드이다.
    var targetinput
    for (var i = 0; i < self.reinputs.length; ++i) {
      // self.reinputs 배열에서 댓글입력노드를 찾는다.
      if (self.reinputs[i].reply_id == reply_id) {
        targetinput = self.reinputs[i]
      }
    }
    if (!targetinput) return
    targetinput.input_content = document.getElementById('reply-input-' + reply_id).textContent
    targetinput.insert_time = new Date()
    self.addReply(targetinput, true)
  }
}

Reply.prototype.addReply = function (replyobj, set_from_user) {
  var self = this
  // reply      { user_id, user_name, user_picture, reply_id, level, order, line_num, content }
  // replyInput { user_id, user_name, user_picture, reply_id, level, order, line_num, input_content }
  set_from_user = typeof set_from_user === 'undefined' ? false : true
  var textcontent, reply_id
  if (set_from_user) {
    textcontent = replyobj.input_content
    reply_id = self.genId()
    self.removeReplyInput()
  } else {
    textcontent = replyobj.content
    reply_id = replyobj.reply_id
  }

  console.log('going to add reply: ' + reply_id)
  if (typeof reply_id === 'undefined') {
    console.error('Cannot add reply of undefined: ' + self._workingFilePath);
  }

  var replydom = document.createElement('DIV')
  replydom.setAttribute('class', 'reply-box')
  replydom.setAttribute('id', 'reply-' + reply_id)
  replydom.innerHTML = '<div class="reply" style="margin:0;padding:5px; background-color:#f6f7f9;border-top: 1px solid #aaaaff;">' +
    '<div class="reply-img" style="padding:5px; display:inline-block;">' +
    '<img src="' + replyobj.user_picture + '" width="32px"></div>' +
    '<div class="reply-text-container" style="margin:0;padding-top:5px; vertical-align: top; display:inline-block;line-height:1.4;max-width: calc(100% - 60px);word-wrap:break-word;">' +
    '<a style="color:#365899;margin-right:5px;font-weight:bold;text-decoration:none;" href="#">' +
    '<span>' + replyobj.user_name + '</span></a>' +
    '<span>' + textcontent + '</span>' +
    '<div>' +
    // '<a style="text-decoration:none;color:#365899;" href="#"><span>Like</span></a> · ' +
    // '<a id="reply-again-' + reply_id + '" style="text-decoration:none;color:#365899;" href="#"><span>Reply</span></a> · ' +
    '<a id="reply-remove-' + reply_id + '" style="text-decoration:none;color:#365899;" href="#"><span>Remove</span></a> · ' +
    // '<a style="color:#888888;text-decoration:none;" href="#">'+
    '<span id="reply-time-' + reply_id + '" style="color:#888888;">Just now</span>' +
    // '</a>'+
    '</div></div>' +
    '<div class="reply-button" style="color:#888888;float:right;visibility: hidden;">x</div></div>'

  var rcount = 0
  for (var i = 0;i < self.lineWidgets.length;i++) {
    if (self.lineWidgets[i].node.getAttribute('id') === 'reply-' + reply_id) return
    if (self.cm.getLineNumber(self.lineWidgets[i].line) === replyobj.line_num) {
      rcount++
    }
  }

  console.log('reply structure: ' + JSON.stringify(replyobj))

  // if (replyobj.order >= rcount) self.lineWidgets.push(self.cm.addLineWidget(replyobj.line_num, replydom))
  // else self.lineWidgets.push(self.cm.addLineWidget(replyobj.line_num, replydom, { insertAt: replyobj.order }))
  var widget = self.cm.addLineWidget(replyobj.line_num, replydom)
self.lineWidgets.push(widget)
console.log('widget is: ' + widget);

  console.log('reply inserted at line: ' + replyobj.line_num + ' order: ' + replyobj.order + ' of total: ' + rcount)

  if (replyobj.user_id == User.user_id) { // 본인이 쓴 댓글만 지울 수 있다. remove 버튼도 본인에게만 보인다.
    function oarcd () {
      var clickdom = document.getElementById('reply-remove-' + reply_id)
      clickdom.addEventListener('click', self.removeReply.bind(self, {'reply_id': reply_id,'user_id': replyobj.user_id,'user_request': User.user_id}))
    }
    self.timeouts.push(setTimeout(oarcd, 50))
  }

  function timecheck () {
    var replytime = document.getElementById('reply-time-' + reply_id)
    if (!replytime) return
    var inittime = new Date(replyobj.insert_time)
    replytime.innerHTML = self.getTimeDifference(new Date(), inittime)
  }
  self.timeticks.push(setInterval(timecheck, 3000))

  if (!set_from_user) return // 외부 정보를 sync하는 경우.

  // 댓글입력노드를 하단에 삽입한다. 댓글입력노드가 2단계까지만 달리도록 고정한다.
  // self.addReplyInput(replyobj.line_num, replyobj.level, replyobj.order + 1)

  self.emit('changeReply', {
    filePath: self._workingFilePath,
    optype: 'insert',
    opval: {
      user_id: replyobj.user_id,
      user_name: replyobj.user_name,
      user_picture: replyobj.user_picture,
      reply_id: reply_id,
      insert_time: String(replyobj.insert_time),
      level: replyobj.level,
      order: replyobj.order,
      line_num: replyobj.line_num,
      content: textcontent
    }
  })
  console.log('reply added on db!')
}

Reply.prototype.getTimeDifference = function (current, previous) {
  var msPerMinute = 60 * 1000
  var msPerHour = msPerMinute * 60
  var msPerDay = msPerHour * 24
  var msPerMonth = msPerDay * 30
  var msPerYear = msPerDay * 365
  var elapsed = current - previous
  if (elapsed < msPerMinute) { return Math.floor(elapsed / 1000) + ' seconds ago'; }
  else if (elapsed < msPerHour) { return Math.floor(elapsed / msPerMinute) + ' minutes ago'; }
  else if (elapsed < msPerDay) { return Math.floor(elapsed / msPerHour) + ' hours ago'; }
  else if (elapsed < msPerMonth) { return Math.floor(elapsed / msPerDay) + ' days ago'; }
  else if (elapsed < msPerYear) { return 'approximately ' + Math.floor(elapsed / msPerMonth) + ' months ago'; }else { return Math.floor(elapsed / msPerYear) + ' years ago'; }
}

Reply.prototype.removeReplyInput = function () {
  var self = this
  // self.reinputs 배열에 있는 댓글입력노드를 dom과 배열에서 제거한다.
  // console.log("line widget count: " + self.lineWidgets.length)
  for (var j = self.lineWidgets.length - 1; j >= 0; j--) {
    for (var i = 0; i < self.reinputs.length; ++i) {
      // console.log('delete line widget: ' + self.cm.getLineNumber(self.lineWidgets[j].line) + ' ' + self.reinputs[i].line_num)
      if (self.lineWidgets[j].node.getAttribute('id') === 'reply-input-container-' + self.reinputs[i].reply_id) {
        self.cm.removeLineWidget(self.lineWidgets[j])
        self.lineWidgets.splice(j, 1)
      }
    }
  }
  self.reinputs.length = 0
}
Reply.prototype.removeReply = function (robj, dontsync) {
  var self = this
  dontsync = (typeof dontsync === 'undefined') ? false : true
  // 'user_request':User.user_id
  if (typeof robj.user_request !== 'undefined') {
    if (robj.user_id != robj.user_request) {
      console.log('Failed to remove reply. Permission denied.')
      return
    }
  }
  for (var j = self.lineWidgets.length - 1; j >= 0; j--) {
    if (self.lineWidgets[j].node.getAttribute('id') === 'reply-' + robj.reply_id) {
      self.cm.removeLineWidget(self.lineWidgets[j])
      self.lineWidgets.splice(j, 1)
      if (!dontsync) {
        console.log('하지말라고');
        self.emit('changeReply', {
          filePath: self._workingFilePath,
          optype: 'delete',
          opval: {
            reply_id: robj.reply_id
          }
        })
      }
    }
  }
}

Reply.prototype.setReplyPanel = function (cm) {
  var self = this
  if (self.replyPanel) self.replyPanel.clear()
  // 에디터에 댓글 다는 패널을 만든다.
  var PANEL_ELEMENT_CLASS = 'CM-buttonsPanel'
  var panelNode = document.createElement('div')
  panelNode.className = PANEL_ELEMENT_CLASS
  var button = self.createButton(cm, {
    hotkey: 'Alt-R',
    class: 'cm-reply',
    label: 'reply',
    callback: function (cm) {
      var self = this
      cm.focus()
      self.addReplyInput(cm.getCursor().line)
    }
  })
  panelNode.appendChild(button)
  self.replyPanel = cm.addPanel(panelNode)
}

Reply.prototype.createButton = function (cm, config) {
  var buttonNode
  if (config.el) {
    if (typeof config.el === 'function') {
      buttonNode = config.el(cm)
    } else { buttonNode = config.el; }
  } else {
    buttonNode = document.createElement('button')
    buttonNode.innerHTML = config.label
    buttonNode.setAttribute('type', 'button')
    buttonNode.setAttribute('tabindex', '-1')

    //   buttonNode.addEventListener('click', function (e) {
    //       e.preventDefault()
    //       cm.focus()
    //       config.callback(cm,this)
    //   })
    buttonNode.addEventListener('click', config.callback.bind(this, cm))

    if (config.class) { buttonNode.className = config.class; }
    if (config.title) { buttonNode.setAttribute('title', config.title); }
  }
  if (config.hotkey) {
    var map = {}
    map[config.hotkey] = config.callback
    cm.addKeyMap(map)
  }
  return buttonNode
}

Reply.prototype.genId = function () {
  return Math.random().toString(36).substr(2)
}

module.exports = new Reply()
