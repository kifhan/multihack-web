var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
// var FileSystem = require('./../filesystem/filesystem')
var util = require('./../filesystem/util')
var ifaceUtil = require('../interface/interfaceutil')
var ProfileManager = require('../auth/profileManager')

var template = require('../interface/templates')
var mustache = require('mustache')

inherits(Reply, EventEmitter)

function Reply (options) {
  var self = this
  if (!(self instanceof Reply)) return new Reply(options)

  self.replyContainers = null
  self.replies = null // Y-Array로 댓글 오브젝트를 저장하는 배열이다.
  // reply db를 연결할 때 - 반복문으로 댓글을 올린다.
  // reply db연결을 끊을 때 - cm에서 doc이 끊어지면(swap) line widget이 제거된다.
  self.reinputs = null // 댓글입력노드를 저장하는 배열이다.
  // reply      { user_id, user_name, user_picture, reply_id, insert_time, reply_at, content }
  // replyInput { user_id, user_name, user_picture, reply_id, insert_time, reply_at, input_content }
  self.replyPanel = null
  self.cm = options.cm
  self.timeticks = null
  self.timeouts = null
  self.contentID = options.contentID
  self.profile = ProfileManager.getProfile()
  if (!self.contentID) { console.warn('Can\'t initiate reply instance!') }
  self.setReplyPanel(self.cm)
}

Reply.prototype.setReplies = function (cm, replies) {
  var self = this
  self.replies = replies
  self.cm = cm
  self.timeticks = []
  self.timeouts = []
  self.setReplyPanel(self.cm)

  if (self.replyContainers) {
    throw Error('is it still makes problems?')
  }
  self.replyContainers = []

  // console.log('Reply: see replies structure: ' + JSON.stringify(replies))
  self.replies.forEach(function (reply) { // first add super reply
    if (typeof reply.reply_at === 'number') {
      self.addReply(reply)
    }
  }, self)
  self.replies.forEach(function (reply) { // then add sub reply
    if (typeof reply.reply_at !== 'number') {
      self.addReply(reply)
    }
  }, self)
  console.log('Reply init finished: ' + self.contentID)

  // 댓글 작성 시간을 상대 시간으로 표시한다.
  function timecheck () {
    self.replies.forEach(function (replyobj) {
      var replytime = document.getElementById('reply-time-' + replyobj.reply_id)
      if (!replytime) return
      var inittime = new Date(replyobj.insert_time)
      replytime.innerHTML = self.getTimeDifference(new Date(), inittime)
    })
  }
  self.timetick = setInterval(timecheck, 3000)

  self.cm.getWrapperElement().addEventListener('click', function (event) {
    if (self.cm.hasFocus()) {
      self.replyContainers.forEach(function (rcon) {
        self.removeReplyInput(rcon.lineWidget.line)
      })
      self.cm.refresh()
    }
  })
}

Reply.prototype.updateLineChange = function (cm, replies) {
  // fire when CodeMirror change event occur
  var self = this
  if (!(replies && self.replyContainers.length)) return
  var changedObjs = []

  for (var i = 0; i < self.replies.length; i++) {
    var pastLine = replies.get(i).get('reply_at')
    if (typeof pastLine !== 'number') return

    var actualLine = self.cm.getLineNumber(self.replies[i].container.lineWidget.line)
    if (pastLine !== actualLine) {
      if (self.replies[i].reply_id !== replies.get(i).get('reply_id')) return console.log('error: replies array currupted!')
      changedObjs.push({
        reply_id: replies.get(i).get('reply_id'),
        reply_at: actualLine
      })
    }
  }

  if (changedObjs.length) {
    self.emit('changeReply', {
      contentID: self.contentID,
      optype: 'update',
      opval: {
        changedObjs: changedObjs
      }
    })// end emit
  }// end if
}

Reply.prototype.getReplyContainer = function (identifier, wannaWrite) {
  var self = this
  // console.log(identifier)
  // identifier could be number, string(reply id) or object(codemirror line info).
  if (identifier && typeof identifier === 'object') { // if identifier is codemirror line info obj
    if (identifier.height) identifier = self.cm.getLineNumber(identifier)
    else return null
  } else if (typeof identifier !== 'number') {
    if (typeof identifier !== 'string') return null // pass when it is wrong type
    var rtarget = self.replies.find(function (element) {
      return element.reply_id === identifier
    })
    if (rtarget) {
      if (wannaWrite) {
        if (ifaceUtil.hasClass(rtarget.container.inputbox, 'hide')) ifaceUtil.toggleClass(rtarget.container.inputbox, 'hide')
        self.cm.refresh()
        rtarget.container.inputTextarea.focus()
      }
      return rtarget.container
    }
    return null
  } else if (!identifier) {
    identifier = 0
  }

  // if indentifier is number
  var target = self.replyContainers.find(function (container) {
    return self.cm.getLineNumber(container.lineWidget.line) === identifier
  })
  if (target) {
    if (wannaWrite) {
      if (ifaceUtil.hasClass(target.inputbox, 'hide')) ifaceUtil.toggleClass(target.inputbox, 'hide')
      self.cm.refresh()
      target.inputTextarea.focus()
    }
    return target
  }

  // If a line number is presented but the line widget doesn't exist at the line, return created one.
  var containerEl = document.createElement('div')
  containerEl.setAttribute('class', 'reply-container')

  var cocheck = document.createElement('input')
  cocheck.className = 'reply-toggle-check'
  cocheck.checked = true
  cocheck.type = 'checkbox'

  var label = document.createElement('a')
  label.className = 'reply-toggle-btn'
  label.href = 'javascript:void(0)'
  label.innerHTML = '<i class="material-icons"></i>'
  label.addEventListener('click', function (e) {
    cocheck.checked = !cocheck.checked
    self.cm.refresh()
  })

  var ol = document.createElement('ol')
  ol.className = 'reply-list'

  var reinput = document.createElement('div')
  reinput.className = 'reply-input-box'
  reinput.innerHTML = mustache.render('<div class="reply-img"><img src="{{picture}}" width="32px"></div>', {picture: self.profile.picture})

  var rtc = document.createElement('div')
  rtc.className = 'reply-inputtextarea-box'

  var rta = document.createElement('textarea')
  rta.className = 'reply-input-textarea'
  rta.setAttribute('placeholder', 'Type your message')
  rta.setAttribute('rows', '1')

  rtc.appendChild(rta)
  reinput.appendChild(rtc)

  containerEl.appendChild(cocheck)
  containerEl.appendChild(label)
  containerEl.appendChild(reinput)
  containerEl.appendChild(ol)

  var replyContainer = {
    lineWidget: self.cm.addLineWidget(identifier, containerEl), // to get line information
    listElement: ol, // to add reply on the container
    inputbox: reinput, // to be able to hide input box
    inputTextarea: rta // to get text from reply input textarea
  }

  rta.addEventListener('keydown', function (event) {
    if ((event.keyCode === 13 || event.which === 13) && !event.shiftKey) { // event.keyCode == 13 은 enter 키이다. event.which는 브라우져 호환성을 위해 삽입했다.
      self.addReply({ reply_at: replyContainer.lineWidget.line, content: replyContainer.inputTextarea.value }, true) // because it needs line number and listElement
      event.preventDefault()
      replyContainer.inputTextarea.value = ''
      // ifaceUtil.toggleClass(replyContainer.inputbox, 'hide')
    }
  })

  self.replyContainers.push(replyContainer)

  if (wannaWrite) {
    rta.focus()
  } else {
    ifaceUtil.toggleClass(reinput, 'hide')
  }

  return replyContainer
}

Reply.prototype.addReply = function (replyobj, isNew) {
  var self = this
  // reply      { user_id, user_name, user_picture, reply_id, insert_time, reply_at, content }
  var replyContainer = self.getReplyContainer(replyobj.reply_at, false)
  if (!replyContainer) {
    console.log('error: can not add reply because it failed to get reply container!')
    return
  }

  if (isNew) { // 새 댓글을 만들 때 필요한 정보를 세팅한다.
    replyobj.user_id = self.profile.userId
    replyobj.user_name = self.profile.username
    replyobj.user_picture = self.profile.picture
    replyobj.reply_id = util.randomStr()
    replyobj.insert_time = String(new Date())
    replyobj.reply_at = (typeof replyobj.reply_at === 'object') ? self.cm.getLineNumber(replyobj.reply_at) : replyobj.reply_at // 라인 위젯 위치가 변하는 것에 대응하는 꼼수. getReplyContainer를 참고
    // replyobj.content = // 댓글 생성할 때 미리 세팅해서 들어온다.
  }
  // console.log('going to add reply:', JSON.stringify(replyobj), '\nis new: ', isNew)

  var containerEl = document.createElement('div')
  containerEl.setAttribute('class', 'reply')
  containerEl.setAttribute('id', 'reply-' + replyobj.reply_id)
  containerEl.innerHTML = mustache.render(template['reply-super'], {
    picture: replyobj.user_picture,
    username: replyobj.user_name,
    content: replyobj.content
  })

  var commendEl = document.createElement('div')

  var removeBtn = document.createElement('a')
  removeBtn.className = 'reply-remove-btn'
  removeBtn.href = 'javascript:void(0)'
  removeBtn.innerHTML = 'Remove'

  var subreplyBtn = document.createElement('a')
  subreplyBtn.className = 'reply-subreply-btn'
  subreplyBtn.href = 'javascript:void(0)'
  subreplyBtn.innerHTML = 'Reply'
  subreplyBtn.addEventListener('click', function (event) {
    self.getReplyContainer(replyobj.reply_id, true)
  })

  commendEl.appendChild(removeBtn)
  commendEl.appendChild(subreplyBtn)
  commendEl.insertAdjacentHTML('beforeend', mustache.render('<span id="reply-time-{{replyID}}">Just added</span>', { replyID: replyobj.reply_id }))

  var reinput = document.createElement('div')
  reinput.className = 'reply-input-box' + ' hide'
  reinput.innerHTML = mustache.render('<div class="reply-img"><img src="{{picture}}" width="32px"></div>', { picture: self.profile.picture })

  var rtc = document.createElement('div')
  rtc.className = 'reply-inputtextarea-box'

  var rta = document.createElement('textarea')
  rta.className = 'reply-input-textarea'
  rta.setAttribute('placeholder', 'Type your message')
  rta.setAttribute('rows', '1')

  rtc.appendChild(rta)
  reinput.appendChild(rtc)

  containerEl.appendChild(commendEl)
  containerEl.appendChild(reinput)

  replyContainer.listElement.insertAdjacentElement('afterbegin', containerEl)

  if (typeof replyobj.reply_at === 'number') { // super reply, it has container for sub replies.
    var cocheck = document.createElement('input')
    cocheck.className = 'reply-toggle-check'
    cocheck.checked = true
    cocheck.type = 'checkbox'

    var label = document.createElement('a')
    label.className = 'reply-toggle-btn'
    label.href = 'javascript:void(0)'
    label.innerHTML = '<i class="material-icons"></i> Replies'
    label.addEventListener('click', function (e) {
      cocheck.checked = !cocheck.checked
      self.cm.refresh()
    })

    var ol = document.createElement('ol')
    ol.className = 'reply-list'

    containerEl.appendChild(cocheck)
    containerEl.appendChild(label)
    containerEl.appendChild(ol)

    replyobj.container = { lineWidget: replyContainer.lineWidget, listElement: ol, inputbox: reinput, inputTextarea: rta }
  } else { // sub reply, it cannot contain lower level reply. so point it to super's container.
    replyobj.container = replyContainer
  }

  rta.addEventListener('keydown', function (event) {
    if ((event.keyCode === 13 || event.which === 13) && !event.shiftKey) { // event.keyCode == 13 은 enter 키이다. event.which는 브라우져 호환성을 위해 삽입했다.
      self.addReply({ reply_at: replyobj.reply_id, content: replyobj.container.inputTextarea.value }, true) // because it needs line number and listElement
      event.preventDefault()
      replyobj.container.inputTextarea.value = ''
      // ifaceUtil.toggleClass(replyobj.container.inputbox, 'hide')
    }
  })

  self.replies.push(replyobj)

  // 본인이 쓴 댓글만 지울 수 있다. remove 버튼도 본인에게만 보인다.
  removeBtn.addEventListener('click', function (e) {
    self.removeReply({
      'reply_id': replyobj.reply_id,
      'user_id': replyobj.user_id,
      'reply_at': replyobj.reply_at,
      'user_request': self.profile.userId
    }, false)
  })

  if (!isNew) return // 외부 정보를 sync하는 경우.
  else self.removeReplyInput(replyobj.reply_at)

  console.log('check where is put in ' + replyobj.reply_at)

  self.emit('changeReply', {
    contentID: self.contentID,
    optype: 'insert',
    opval: {
      'user_id': replyobj.user_id,
      'user_name': replyobj.user_name,
      'user_picture': replyobj.user_picture,
      'reply_id': replyobj.reply_id,
      'insert_time': replyobj.insert_time,
      'reply_at': replyobj.reply_at,
      'content': replyobj.content
    }
  })
  // console.log('reply added on db!')
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

Reply.prototype.removeReplyInput = function (identifier) {
  var self = this
  var container = self.getReplyContainer(identifier)
  if (!ifaceUtil.hasClass(container.inputbox, 'hide')) ifaceUtil.toggleClass(container.inputbox, 'hide')

  if (container.listElement.childNodes.length === 0) { // delete empty reply line widget
    self.cm.removeLineWidget(container.lineWidget)
    self.replyContainers.splice(self.replyContainers.indexOf(container), 1)
  }
}

Reply.prototype.removeReply = function (robj, stopSync) {
  var self = this
  // 'user_request':self.profile.userId
  if (!robj.user_request || robj.user_id !== robj.user_request) {
    console.log('Failed to remove reply. Permission denied.')
    return
  }
  console.log('check ' + robj.reply_at)

  var container = self.getReplyContainer(robj.reply_at)
  var targetEl = document.getElementById('reply-' + robj.reply_id)
  container.listElement.removeChild(targetEl)

  // console.log('reply removed by user')
  var rereplyIDs = []
  if (typeof robj.reply_at === 'number') { // if it is super reply,
    // delete empty reply line widget
    if (container.listElement.childNodes.length === 0) {
      self.cm.removeLineWidget(container.lineWidget)
      self.replyContainers.splice(self.replyContainers.indexOf(container), 1)
    }
    // remove sub replies together.
    for (var i = self.replies.length - 1; i >= 0; i--) {
      var treply = self.replies[i]
      if (treply.reply_id !== robj.reply_id && treply.container.listElement === container.listElement) {
        rereplyIDs.push(treply.reply_id)
        self.replies.splice(i, 1)
      }
    }
  }

  if (!stopSync) {
    self.emit('changeReply', {
      contentID: self.contentID,
      optype: 'delete',
      opval: {
        'reply_id': robj.reply_id,
        'rereply_ids': rereplyIDs
      }
    })
  }
}

// TODO: 댓글 내용 업데이트 하는 메소드, 업데이트 내용 동기화하는 메소드 추가한다.

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
    label: 'comment',
    title: 'reply',
    callback: function (cm) {
      cm.focus()
      // self.addReplyInput(cm.getCursor().line)
      self.getReplyContainer(cm.getCursor().line, true)
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
    buttonNode = document.createElement('a')
    buttonNode.innerHTML = '<i class="material-icons">' + config.label + '</i>'
    // buttonNode.setAttribute('type', 'button')
    // buttonNode.setAttribute('tabindex', '-1')
    buttonNode.setAttribute('href', 'javascript:void(0)')
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
