var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
// var FileSystem = require('./../filesystem/filesystem')
var util = require('./../filesystem/util')
var User = require('./../auth/user')

inherits(Reply, EventEmitter)

function Reply (options) {
  var self = this
  if (!(self instanceof Reply)) return new Reply(options)

  // line change시 이 리스트가 하던일을 바꿔줘야함
  self.lineWidgets = null
  self.newLineWidgets = []
  // self.replies = undefined // Y-Array로 댓글 오브젝트를 저장하는 배열이다.
  // reply db를 연결할 때 - 반복문으로 댓글을 올린다.
  // reply db연결을 끊을 때 - cm에서 doc이 끊어지면(swap) line widget이 제거된다.
  self.reinputs = null // 댓글입력노드를 저장하는 배열이다.
  // reply      { user_id, user_name, user_picture, reply_id, insert_time, level, order, line_num, content }
  // replyInput { user_id, user_name, user_picture, reply_id, insert_time, level, order, line_num, input_content }
  self.replyPanel = null
  self.cm = options.cm
  self.timeticks = []
  self.timeouts = []
  self.contentID = options.contentID
  if (!self.contentID) {
    console.warn('Can\'t initiate reply instance!')
  }
  self.setReplyPanel(self.cm)
}

Reply.prototype.setReplies = function (cm, replies) {
  var self = this
  self.reinputs = []
  self.cm = cm
  if (self.timeticks) {
    for (var j = 0; j < self.timeticks.length; j++) {
      clearInterval(self.timeticks[j])
    }
  }
  self.timeticks = []
  if (self.timeouts) {
    for (var k = 0; k < self.timeouts.length; k++) {
      clearInterval(self.timeouts[k])
    }
  }
  self.timeouts = []
  self.setReplyPanel(self.cm)

  if (self.newLineWidgets) {
    for (var i = 0, len = self.newLineWidgets.length; i < len; i++) {
      if (!self.newLineWidgets[i]) continue
      for (var m = self.newLineWidgets[i].length - 1; m >= 0; m--) {
        self.removeReply({
          reply_id: self.newLineWidgets[i][m].node.getAttribute('id').replace('reply-', ''),
          line_num: self.cm.getLineNumber(self.newLineWidgets[i][m].line)
        }, true)
      }
    }

  }
  self.newLineWidgets = []

  console.log('Reply: see replies structure: ' + JSON.stringify(replies))
  for (var i = 0; i < replies.length; i++) {
    self.addReply(replies[i])
  }
  console.log('Reply set init finished: ' + self.contentID)
}

Reply.prototype.updateLineChange = function (cm, replies) {
  var self = this
  if (!self.lineWidgets) return
  var changeobjs = []
  if (typeof replies === 'undefined') return
  var chReplies = replies.toArray()
  for (var j = 0; j < self.lineWidgets.length; j++) {
    for (var i = 0; i < chReplies.length; i++) {
      // console.log("compare " + self.lineWidgets[j].node.getAttribute("id") + " " + repliesarray[i].reply_id)
      if (self.lineWidgets[j].node.getAttribute('id') === 'reply-' + replies.get(i).get('reply_id')) {
        if (self.cm.getLineNumber(self.lineWidgets[j].line) !== replies.get(i).get('line_num')) {
          // console.log("line_num needs to be change: " + replies.get(i).reply_id)
          var newLineNum = self.cm.getLineNumber(self.lineWidgets[j].line)
          if (!newLineNum) break
          changeobjs.push({
            reply_id: replies.get(i).get('reply_id'),
            line_num: newLineNum
          })
        }
      }
    }
    for (var k = 0; k < self.reinputs.length; k++) {
      // console.log("compare " + self.lineWidgets[j].node.getAttribute("id") + " " + self.reinputs[k].reply_id)
      if (self.lineWidgets[j].node.getAttribute('id') === 'reply-input-container-' + self.reinputs[k].reply_id) {
        // console.log("compare" + self.cm.getLineNumber(self.lineWidgets[j].line) + " " + self.reinputs[k].line_num)
        if (self.cm.getLineNumber(self.lineWidgets[j].line) !== self.reinputs[k].line_num) {
          self.reinputs[k].line_num = self.cm.getLineNumber(self.lineWidgets[j].line)
        }
      }
    }
  }
  if (changeobjs.length > 0) {
    changeobjs.forEach(function (cobj) {
      self.emit('changeReply', {
        contentID: self.contentID,
        optype: 'update',
        opval: {
          reply_id: cobj.reply_id,
          line_num: cobj.line_num
        }
      })
    })
  }
}

Reply.prototype.addReplyInput = function (line, level, parentReplyId) {
  var self = this
  self.removeReplyInput(line) // 댓글 입력 노드가 여러개 생기지 않도록 이전에 생성된 입력노드를 제거한다.
  console.log('in addReplyInput : ', level, parentReplyId)
  if (!self.newLineWidgets[line]) {
    self.newLineWidgets[line] = []
  }

  var lineWidgetTree = self.newLineWidgets[line]

  // reply      { user_id, user_name, user_picture, reply_id, level, order, line_num, content }
  // replyInput { user_id, user_name, user_picture, reply_id, level, order, line_num, text_id }

  // 댓글 입력 노드를 삽입하는 함수이다.
  // line은 에디터 줄의 번호나 lineHandle 오브젝트, 혹은 이미 등록된 댓글 노드의 id가 될 수 있다.
  var reply_id = util.randomStr()

  var replyinputdom = document.createElement('DIV') // 삽입할 노드를 생성한다.
  replyinputdom.setAttribute('class', 'reply-box')
  replyinputdom.setAttribute('id', 'reply-input-container-' + reply_id)
  replyinputdom.innerHTML =
    '<div class="reply" style="margin:0;padding:5px; background-color:#f6f7f9;">' +
    '<div class="reply-img" style="padding:5px; display:inline-block;">' +
    '<img src="' + User.user_picture + '" width="32px"></div>' +
    '<div class="reply-text-container" style="margin:0;padding-top:5px; vertical-align: top; display:inline-block;line-height:1.4;width: calc(100% - 60px);min-height:37px;">' +
    '<div class="reply-input-box" style="border:1px solid #aaa; background:#ffffff;">' +
    '<div id="reply-input-' + reply_id + '" class="reply-input-cell" style="padding:8px;color:#000;" contenteditable="true" data-placeholder="답글 달기 ..." tabindex="-1">' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>'

  // 미리 작성한 html 템플레이트를 사용한다. https://thimbleprojects.org/mohawkduck/194618/

  if (level === 1) {
    // 크기하고 위치가 조금 다르다
    // 위치는 오른쪽으로 4rem, 크기는 패딩 5px를 뺐다
    replyinputdom.innerHTML =
      '<div class="reply" style="margin:0;background-color:#f6f7f9;">' +
      '<div class="reply-img" style="padding:5px; display:inline-block; margin-left: 4rem">' +
      '<img src="' + User.user_picture + '" width="32px"></div>' +
      '<div class="reply-text-container" style="margin:0;padding-top:5px; vertical-align: top; display:inline-block;line-height:1.4;width: calc(100% - 100px);min-height:37px;">' +
      '<div class="reply-input-box" style="border:1px solid #aaa; background:#ffffff;">' +
      '<div id="reply-input-' + reply_id + '" class="reply-input-cell" style="padding:8px;color:#000;" contenteditable="true" data-placeholder="답글 달기 ..." tabindex="-1">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'

    for (var i = 0, len = lineWidgetTree.length; i < len; i++) {
      if (lineWidgetTree[i].node.id === 'reply-' + parentReplyId) {
        if (i === len - 1) lineWidgetTree.push(self.cm.addLineWidget(line, replyinputdom))
        else lineWidgetTree.splice(i, 0, self.cm.addLineWidget(line, replyinputdom, {insertAt: i + 1}))
        break
      }
    }

    if (len === 0) lineWidgetTree.push(self.cm.addLineWidget(line, replyinputdom))
  } else {
    lineWidgetTree.push(self.cm.addLineWidget(line, replyinputdom))
  }

  // 작성 후 엔터를 눌렀을 때의 이벤트 처리 및 input이 아닌 다른 곳을 눌렀을 경우에 input을 제거하는 이벤트 처리
  function oarc () {
    var clickdom = document.getElementById('reply-input-' + reply_id)
    clickdom.addEventListener('keydown', self.onAddReply.bind(self, window.event, reply_id))
    // clickdom.addEventListener('focus', self.replyinputfocus.bind(window.event))
    clickdom.focus()
    var removeInputWindow = function (event) {
      if (!event.target.classList.contains('reply-input-cell')) {
        self.removeReplyInput(line)
        window.removeEventListener('click', removeInputWindow)
      }
    }
    window.addEventListener('click', removeInputWindow)
  }

  self.timeouts.push(setTimeout(oarc, 100))

  self.reinputs.push({
    // self.reinputs 배열에 새로 만든 댓글입력노드를 삽입한다.
    user_id: User.user_id,
    user_name: User.user_name,
    user_picture: User.user_picture,
    reply_id: reply_id,
    insert_time: '',
    level: level,
    line_num: line,
    input_content: '',
    parentId: parentReplyId
  })
}

Reply.prototype.onAddReply = function (event, reply_id) {
  var self = this
  event = window.event
  // console.log('reply keycode: '+event.keyCode +' or ' + event.which)
  // 댓글입력노드에서 키를 누르면 호출된다. enter 키를 감지하면 댓글노드를 삽입한다.
  // event는 onkeydown 이벤트에서 전달된 이벤트 오브젝트이다.
  // reply_id는 해당 노드 id의 번호이다.
  if (event.keyCode === 13 || event.which === 13) {
    // event.keyCode == 13 은 enter 키이다. event.which는 브라우져 호환성을 위해 삽입했다.
    // 댓글 입력 내용을 가져올 노드이다.
    var targetinput
    for (var i = 0; i < self.reinputs.length; ++i) {
      // self.reinputs 배열에서 댓글입력노드를 찾는다.
      if (self.reinputs[i].reply_id === reply_id) {
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
    reply_id = util.randomStr()
    self.removeReplyInput(replyobj.line_num)
  } else {
    textcontent = replyobj.content
    reply_id = replyobj.reply_id
  }

  console.log('going to add reply: ' + reply_id)
  if (typeof reply_id === 'undefined') {
    console.error('Cannot add reply of undefined: ' + self.contentID)
  }

  var lineWidgetTree = self.newLineWidgets[replyobj.line_num] || (self.newLineWidgets[replyobj.line_num] = [])

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
    '<a id="reply-reply-' + reply_id + '" style="text-decoration:none;color:#365899;" href="#"><span>Reply</span></a> · ' +
    // '<a style="color:#888888;text-decoration:none;" href="#">'+
    '<span id="reply-time-' + reply_id + '" style="color:#888888;">Just now</span>' +
    // '</a>'+
    '</div></div>' +
    '<div class="reply-button" style="color:#888888;float:right;visibility: hidden;">x</div></div>'

  console.log('reply structure: ', JSON.stringify(replyobj))

  if (replyobj.level === 1) {
    replydom = document.createElement('DIV')
    replydom.setAttribute('class', 'reply-box')
    replydom.setAttribute('id', 'reply-' + reply_id)
    replydom.innerHTML = '<div class="reply" style="margin:0; background-color:#f6f7f9;border-top: 1px solid #aaaaff;">' +
      '<div class="reply-img" style="padding:5px; display:inline-block; margin-left: 4rem;">' +
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

    // 자신의 order를 저장하는 방법도 있겠지만 그렇게 하면 중간에 뭐가 삽입 되었을 때 뒤 element들의 order를 다 수정 해 주어야 한다
    // 현재 생긴 replyinput의 order는 전달 해 주어도 될 것 같다
    // 근데 다른사람이 갑자기 댓글을 삽입한다면 문제가 될 수도 있어서 그냥 이렇게 하는게 낫겠다
    for (var i = 0, len = lineWidgetTree.length; i < len; i++) {
      if (lineWidgetTree[i].node.id === 'reply-' + replyobj.parentId) {
        if (i === len - 1) {
          var widget = self.cm.addLineWidget(replyobj.line_num, replydom)
          widget.level = replyobj.level
          lineWidgetTree.push(widget)
        }
        else {
          var widget = self.cm.addLineWidget(replyobj.line_num, replydom, {insertAt: i + 1})
          widget.level = replyobj.level
          lineWidgetTree.splice(i + 1, 0, widget)
        }
        break
      }
    }
  } else {
    var widget = self.cm.addLineWidget(replyobj.line_num, replydom)
    widget.level = replyobj.level
    lineWidgetTree.push(widget)

    // 모두에게 reply 버튼이 보인다 모두 reply를 달 수 있다
    var oarcd2 = function () {
      var clickdom = document.getElementById('reply-reply-' + reply_id)

      clickdom.addEventListener('click', function (event) {
        // 나중에 insert index랑 line num을 바로 넘겨주는 방식으로 개선 해 본다
        self.addReplyInput(replyobj.line_num, 1, reply_id)
      })
    }
    self.timeouts.push(setTimeout(oarcd2, 100))
  }

  console.log('widget is: ', widget)
  if (replyobj.user_id === User.user_id) { // 본인이 쓴 댓글만 지울 수 있다. remove 버튼도 본인에게만 보인다.

    var oarcd = function () {
      var clickdom = document.getElementById('reply-remove-' + reply_id)
      clickdom.addEventListener('click', self.removeReply.bind(self, {
        'reply_id': reply_id,
        'user_id': replyobj.user_id,
        'user_request': User.user_id,
        'line_num': replyobj.line_num
      }, false))
    }
    // 50 에서 100으로 수정
    self.timeouts.push(setTimeout(oarcd, 100))
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
    contentID: self.contentID,
    optype: 'insert',
    opval: {
      user_id: replyobj.user_id,
      user_name: replyobj.user_name,
      user_picture: replyobj.user_picture,
      reply_id: reply_id,
      insert_time: String(replyobj.insert_time),
      level: replyobj.level,
      line_num: replyobj.line_num,
      content: textcontent,
      parentId: replyobj.parentId
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

  if (elapsed < msPerMinute) return Math.floor(elapsed / 1000) + ' seconds ago'
  else if (elapsed < msPerHour) return Math.floor(elapsed / msPerMinute) + ' minutes ago'
  else if (elapsed < msPerDay) return Math.floor(elapsed / msPerHour) + ' hours ago'
  else if (elapsed < msPerMonth) return Math.floor(elapsed / msPerDay) + ' days ago'
  else if (elapsed < msPerYear) return 'approximately ' + Math.floor(elapsed / msPerMonth) + ' months ago'
  else return Math.floor(elapsed / msPerYear) + ' years ago'
}

Reply.prototype.removeReplyInput = function (line) {
  var self = this
  // self.reinputs 배열에 있는 댓글입력노드를 dom과 배열에서 제거한다.
  // console.log("line widget count: " + self.lineWidgets.length)
  if (!self.newLineWidgets[line]) {
    self.newLineWidgets[line] = []
  }
  var lineWidgetTree = self.newLineWidgets[line]

  for (var j = lineWidgetTree.length - 1; j >= 0; j--) {
    for (var i = 0; i < self.reinputs.length; ++i) {
      // console.log('delete line widget: ' + self.cm.getLineNumber(self.lineWidgets[j].line) + ' ' + self.reinputs[i].line_num)
      if (lineWidgetTree[j].node.getAttribute('id') === 'reply-input-container-' + self.reinputs[i].reply_id) {
        self.cm.removeLineWidget(lineWidgetTree[j])
        lineWidgetTree.splice(j, 1)
      }
    }
  }
  self.reinputs.length = 0
}
Reply.prototype.removeReply = function (robj, dontsync) {
  var self = this
  dontsync = (typeof dontsync === 'undefined') ? false : dontsync
  // 'user_request':User.user_id
  if (robj.user_request) {
    if (robj.user_id !== robj.user_request) {
      console.log('Failed to remove reply. Permission denied.')
      return
    }
  }

  var lineWidgetTree = self.newLineWidgets[robj.line_num]

  for (var j = lineWidgetTree.length - 1; j >= 0; j--) {
    if (lineWidgetTree[j].node.getAttribute('id') === 'reply-' + robj.reply_id) {
      self.cm.removeLineWidget(lineWidgetTree[j])

      var rereply_ids = []
      var rereCnt = 0
      for (var i = j + 1, len = lineWidgetTree.length; i < len; i++) {

        if (lineWidgetTree[i].level === 1) {
          rereply_ids.push(lineWidgetTree[i].node.id)
          self.cm.removeLineWidget(lineWidgetTree[i])
          rereCnt++
        } else break
      }

      lineWidgetTree.splice(j, 1 + rereCnt)
      if (dontsync === false) {
        console.log('reply removed by user')
        self.emit('changeReply', {
          contentID: self.contentID,
          optype: 'delete',
          opval: {
            reply_id: robj.reply_id,
            rereply_ids: rereply_ids
          }
        })
      }
      break
    }
  }
}

Reply.prototype.setReplyPanel = function (cm) {
  var self = this
  if (self.replyPanel) {
    try {
      self.replyPanel.clear()
    } catch (error) {
      // TODO: 오류 처리 코드를 넣는다.
    }
  }
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
    } else { buttonNode = config.el }
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

    if (config.class) { buttonNode.className = config.class }
    if (config.title) { buttonNode.setAttribute('title', config.title) }
  }
  if (config.hotkey) {
    var map = {}
    map[config.hotkey] = config.callback
    cm.addKeyMap(map)
  }
  return buttonNode
}

module.exports = Reply
