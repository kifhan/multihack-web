var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var split = require('split.js')
var TabContainer = require('./tabcontainer')
var HtmlViewer = require('../editor/htmlviewer')
var lang = require('./lang/lang')
var FileSystem = require('./../filesystem/filesystem')
var lg = lang.get.bind(lang)

inherits(PaneManager, EventEmitter)

function PaneManager (options) {
  var self = this
  if (!(self instanceof PaneManager)) return new PaneManager(options)
  self.container = options.container
  if (!self.container) throw Error('Panemanager: can not start without container!')

  // create main pane
  var mainpane = document.createElement('div')
  mainpane.className = 'pane'

  self.mainPaneHolder = {
    type: 'paneHolder',
    dom: self.container,
    splitation: 'vertical',
    panelist: [{
      type: 'pane',
      dom: mainpane,
      showidx: 0,
      tabcontainer: null,
      viewlist: [] // tab으로 관리한다.
    }]
  }
  // ex: {type:paneHolder, dom:div, splistation: vertical, panelist:[]}
  // ex: {type:pane, dom:div, viewlist:[]}
  self.focusedPane = self.mainPaneHolder.panelist[0]
  self.focusedPane.tabcontainer = new TabContainer()
  self.focusedPane.dom.appendChild(self.focusedPane.tabcontainer.dom)

  self._lastview = null
  self._currentview = null

  // create start dummy view
  self.addView('Welcome!', new HtmlViewer({content:
    '<div class="welcome-view">' +
    '<h1>Rellat</h1>' +
    '<span>The Simultaneous Collaboration Coding service to show people how to make code in real time.</span>' +
    '<br><br><span>Supported File Types</span>' +
    '<ul><li>CodeMirror code editor : js, coffee, ts, json, css, sass, less, html, xml, py, php, md</li>' +
    '<li>Quill.js rich text editor : quill</li>' +
    '<li>Image viewer - in progress </li>' +
    '<li>unsupported file type will be ignored</li>' +
    '</ul>' +
    '</div>'
  }))

  self.focusedPane.tabcontainer.on('change', function (event) {
    self.changeView(event.view)
  })
  self.focusedPane.tabcontainer.on('close', function (event) {
    self.closeView(event.view, event.tab)
  })

  self.container.appendChild(self.focusedPane.dom)
}
// PaneManager.prototype.addPane = function (pane, splitation) {
//   var self = this
// }
PaneManager.prototype.isOnPane = function (filepath) {
  var self = this
  // view가 focusedPane에 이미 추가되어 있는지 확인하기
  var checkview = false
  self.focusedPane.viewlist.forEach(function (view) {
    // console.log('check file exist: ' + filepath + ' ' + view.getWorkingFile().path)
    if (view.getWorkingFile() === FileSystem.getFileByPath(filepath)) { checkview = view }
  }, this)
  return checkview
}
PaneManager.prototype.addView = function (title, view) {
  var self = this
  var lastView = self.focusedPane.dom.querySelector('.editor-view.active')
  if (lastView) {
    lastView.className = lastView.className.replace(' active', '')
    self._lastview = self._currentview
  }

  var showidx = self.focusedPane.viewlist.push(view) - 1
  self.focusedPane.showidx = showidx
  self.focusedPane.viewlist[showidx].container.className += ' active'
  self.focusedPane.dom.appendChild(self.focusedPane.viewlist[showidx].container)
  self._currentview = view

  // add tab button
  var newtab = self.focusedPane.tabcontainer.newTab(title, self.focusedPane.viewlist[showidx])
  self.focusedPane.viewlist[showidx].bindTab(newtab)
}
PaneManager.prototype.changeView = function (view) {
  var self = this
  var tempview = self.focusedPane.viewlist[self.focusedPane.viewlist.indexOf(view)]
  if (!tempview) return

  var lastView = self.focusedPane.dom.querySelector('.editor-view.active')
  if (lastView) {
    lastView.className = lastView.className.replace(' active', '')
    self._lastview = self._currentview
  }
  var lastTab = self.focusedPane.tabcontainer.dom.querySelector('.tab.active')
  if (lastTab) lastTab.className = lastTab.className.replace(' active', '')

  tempview.container.className += ' active'
  tempview.bindedTab.setActive()
  self._currentview = view

  self.emit('viewChange', {view: view})
}
PaneManager.prototype.closeView = function (view, tab) {
  var self = this
  var i = self.focusedPane.viewlist.indexOf(view)
  if (i !== -1) {
    var tempview = self.focusedPane.viewlist[i]
    self.focusedPane.tabcontainer.closeTab(tempview.bindedTab)

    self.focusedPane.dom.removeChild(tempview.container)
    self.focusedPane.viewlist.splice(i, 1)
    view.close()
    self.emit('closeview', {view: view})
    // switch vew
    if (self._lastview && self._lastview !== view) {
      self.changeView(self._lastview)
    } else if (self.focusedPane.viewlist[self.focusedPane.viewlist.length - 1]) {
      console.log('nnn2 ')
      self.changeView(self.focusedPane.viewlist[self.focusedPane.viewlist.length - 1])
    }
  }
}

module.exports = PaneManager
