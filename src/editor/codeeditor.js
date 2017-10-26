/* globals CodeMirror */

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var FileSystem = require('./../filesystem/filesystem')

inherits(CodeEditor, EventEmitter)

function CodeEditor (options) {
  var self = this
  if (!(self instanceof CodeEditor)) return new CodeEditor(options)

  options = options || {}
  self.title = options.title || 'no name'
  self.container = options.container || document.createElement('div')
  self.container.className = 'editor-view'
  self.bindedTab = null

  var textarea = options.textarea
  if (!textarea) {
    textarea = document.createElement('div')
    textarea.className = 'view code-editor'
    self.container.appendChild(textarea)
  }
  self.textarea = textarea

  self._cm = CodeMirror(function (elt) {
    self.textarea.parentNode.replaceChild(elt, self.textarea)
    self.textarea = elt
  }, {
    mode: {name: 'javascript', globalVars: true}, // syntax mode will change when file opens
    extraKeys: {'tab': 'autocomplete'},
    lineNumbers: true,
    theme: options.codemirrortheme || 'atom',
    tabSize: 4,
    indentUnit: 4,
    lineWrapping: !!(window.innerWidth < 480), // No wrap on mobile
    styleActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    matchTags: {bothTags: true},
    autoCloseTags: true,
    viewportMargin: 100,
    autoResize: true
  })

  self._keyup = function (editor, event) {
    if (!ExcludedIntelliSenseTriggerKeys[(event.keyCode || event.which).toString()]) {
      CodeMirror.commands.autocomplete(editor, null, { completeSingle: false })
    }
  }
  self._cm.on('keyup', self._keyup)

  self._workingFile = null

  var tokens = {}
  self.mutualExcluse = function (key, f) { if (!tokens[key]) { tokens[key] = true; try { f() } catch (e) { delete tokens[key]; throw new Error(e) } delete tokens[key] } }

  self._onSelectionChangebind = self._onSelectionChange.bind(self)
  self._cm.on('beforeSelectionChange', self._onSelectionChangebind)

  self._remoteCarets = []
  self._lastSelections = []
  self._remote = null

  self._resizetimeout = function () {
    if (self.container.offsetHeight && self._cm.getWrapperElement().offsetHeight !== (self.container.offsetHeight - 43 + 1)) {
      self._cm.getWrapperElement().style.height = (self.container.offsetHeight - 43) + 'px'
      // console.log('size ' + self.container.offsetHeight)
      self._cm.refresh()
    }
  }
  setTimeout(self._resizetimeout, 100)
}

CodeEditor.prototype._onSelectionChange = function (cm, change) {
  var self = this

  var ranges = change.ranges.map(self._putHeadBeforeAnchor)

  self._remote.changeSelection({
    filePath: self._workingFile.path,
    change: {
      type: 'selection',
      ranges: ranges
    }
  })
}

CodeEditor.prototype.highlight = function (selections) {
  var self = this

  self._lastSelections = selections

  // Timeout so selections are always applied after changes
  window.setTimeout(function () {
    if (!self._workingFile) return

    self._remoteCarets.forEach(self._removeRemoteCaret)
    self._remoteCarets = []

    self._cm.getAllMarks().forEach(function (mark) {
      mark.clear()
    })

    selections.forEach(function (sel) {
      if (sel.filePath !== self._workingFile.path) return

      sel.change.ranges.forEach(function (range) {
        if (self._isNonEmptyRange(range)) {
          self._cm.markText(range.head, range.anchor, {
            className: 'remoteSelection'
          })
        } else {
          self._insertRemoteCaret(range)
        }
      })
    })
  }, 10)
}

CodeEditor.prototype._insertRemoteCaret = function (range) {
  var self = this

  var caretEl = document.createElement('div')

  caretEl.classList.add('remoteCaret')
  caretEl.style.height = self._cm.defaultTextHeight() + 'px'
  caretEl.style.marginTop = '-' + self._cm.defaultTextHeight() + 'px'

  self._remoteCarets.push(caretEl)

  self._cm.addWidget(range.anchor, caretEl, false)
}

CodeEditor.prototype._removeRemoteCaret = function (caret) {
  caret.parentNode.removeChild(caret)
}

// Handle an external change
CodeEditor.prototype.change = function (filePath, change) {
  var self = this
  if (self._workingFile && filePath === self._workingFile.path) {
    self.mutualExcluse('change', function () {
      self._cm.replaceRange(change.text, change.to, change.from)
    })
  }
}

CodeEditor.prototype.posFromIndex = function (index) {
  var self = this

  return self._cm.posFromIndex(index)
}

CodeEditor.prototype.open = function (filePath, remote, reply) {
  var self = this
  if (self._workingFile && filePath === self._workingFile.path) return // Skip, if the file is already opened
  self._workingFile = FileSystem.getFileByPath(filePath)
  self._remote = remote

  self._remote.bindCodeMirror(self._workingFile.contentID, self._cm, self._workingFile.replydbID, reply)

  // document.querySelector('.editor-wrapper').style.display = ''
  self.highlight(self._lastSelections)
  setTimeout(function () {
    self._cm.execCommand('goDocStart')
  }, 100)

  self._selectionevent = function (selections) {
    // sync text cursor of other user.
    // 협업 중인 다른 사용자의 커서가 현재 사용자의 문서 에디터에 나타나도록 한다.
    self.highlight(selections)
  }
  self._remote.on('changeSelection', self._selectionevent)

  self._changeFileInfo = function () { self.bindedTab.rename(self._workingFile.name) }
  self._workingFile.on('change', self._changeFileInfo)
}

CodeEditor.prototype.close = function () {
  var self = this

  self._remote.unbindCodeMirror(self._workingFile.contentID)

  self._cm.off('keyup', self._keyup)
  self._cm.off('beforeSelectionChange', self._onSelectionChangebind)

  self._remote.removeListener('changeSelection', self._selectionevent)
  self._workingFile.removeListener('change', self._changeFileInfo)

  self._workingFile = null
  self.container.childNodes.forEach(function (element) {
    self.container.removeChild(element)
  })
    // TODO: destroy
}

CodeEditor.prototype.getWorkingFile = function () {
  var self = this
  return self._workingFile
}

CodeEditor.prototype._isNonEmptyRange = function (range) {
  return range.head.ch !== range.anchor.ch || range.head.line !== range.anchor.line
}

CodeEditor.prototype._putHeadBeforeAnchor = function (range) {
  var nr = JSON.parse(JSON.stringify(range))
  if (nr.head.line > nr.anchor.line || (
    nr.head.line === nr.anchor.line && nr.head.ch > nr.anchor.ch
  )) {
    var temp = nr.head
    nr.head = nr.anchor
    nr.anchor = temp
  }
  return nr
}
CodeEditor.prototype.bindTab = function (tab) {
  var self = this
  self.bindedTab = tab
}
module.exports = CodeEditor

var ExcludedIntelliSenseTriggerKeys = {
  '8': 'backspace',
  '9': 'tab',
  '13': 'enter',
  '16': 'shift',
  '17': 'ctrl',
  '18': 'alt',
  '19': 'pause',
  '20': 'capslock',
  '27': 'escape',
  '32': 'space',
  '33': 'pageup',
  '34': 'pagedown',
  '35': 'end',
  '36': 'home',
  '37': 'left',
  '38': 'up',
  '39': 'right',
  '40': 'down',
  '45': 'insert',
  '46': 'delete',
  '91': 'left window key',
  '92': 'right window key',
  '93': 'select',
  '107': 'add',
  '109': 'subtract',
  '110': 'decimal point',
  '111': 'divide',
  '112': 'f1',
  '113': 'f2',
  '114': 'f3',
  '115': 'f4',
  '116': 'f5',
  '117': 'f6',
  '118': 'f7',
  '119': 'f8',
  '120': 'f9',
  '121': 'f10',
  '122': 'f11',
  '123': 'f12',
  '144': 'numlock',
  '145': 'scrolllock',
  '186': 'semicolon',
  '187': 'equalsign',
  '188': 'comma',
  '189': 'dash',
  '191': 'slash',
  '192': 'graveaccent',
  '219': 'bracket',
  '220': 'backslash',
  '222': 'quote'
}
