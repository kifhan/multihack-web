var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var Tab = require('./tab')
var MAX_TABS = 8

inherits(TabContainer, EventEmitter)

function TabContainer () {
  var self = this
  if (!(self instanceof TabContainer)) return new TabContainer()

  self.dom = document.createElement('div')
  self.dom.className = 'tab-container'
  self.tabs = []
}

TabContainer.prototype.newTab = function (title, view) {
  var self = this

  var lastTab = self.dom.querySelector('.active.tab')
  if (lastTab) lastTab.className = 'tab'

  var tab = new Tab(title, view)

  tab.on('click', function () {
    self.emit('change', {
      tab: tab,
      view: tab.bindedView
    })
  })

  tab.on('close', function () {
    if (self.dom === tab.dom.parentNode) {
      self.dom.removeChild(tab.dom)
      self.deleteTab(tab)
      self.emit('close', {
        tab: tab,
        view: tab.bindedView
      })
    }
  })

  self.tabs.push(tab)
  self.dom.insertBefore(tab.dom, self.dom.firstChild)

  if (self.tabs.length > MAX_TABS) {
    self.tabs[0].close()
    self.tabs.splice(0, 1)
  }
  return tab
}
TabContainer.prototype.deleteTab = function (tab) {
  var self = this
  if (self.tabs.indexOf(tab) !== -1) self.tabs.splice(self.tabs.indexOf(tab), 1)
  // delete tab
}
TabContainer.prototype.closeTab = function (tab) {
  var self = this
  if (self.dom !== tab.dom.parentNode) return
  self.dom.removeChild(tab.dom)
  self.deleteTab(tab)
}

TabContainer.prototype.fileRenamed = function (title, newtitle) {
  var self = this
  for (var i = 0; i < self.tabs.length; i++) {
    if (self.tabs[i].title === title) {
      self.tabs[i].rename(newtitle)
      return
    }
  }
}

TabContainer.prototype.fileDeleted = function (title) {
  var self = this
  for (var i = 0; i < self.tabs.length; i++) {
    if (self.tabs[i].title === title) {
      self.tabs[i].close()
      return
    }
  }
}

module.exports = TabContainer
