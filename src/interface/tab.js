var mustache = require('mustache')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var template = '<span>{{title}}</span><div class="close">ⓧ</div>'

inherits(Tab, EventEmitter)

function Tab (title,bindedView) {
  var self = this
  if (!(self instanceof Tab)) return new Tab()
  if(!bindedView) throw Error('Tab: can not create tab without view!')

  self.dom = document.createElement('div')
  self.dom.className = 'tab active'
  self.dom.innerHTML = mustache.render(template, {title: title})

  self.dom.addEventListener('click', self._onclick.bind(self))
  self.dom.querySelector('.close').addEventListener('click', self.close.bind(self))

  self.title = title
  self.bindedView = bindedView
}

Tab.prototype._onclick = function (e) {
  var self = this
  if (e) e.stopPropagation()
  self.emit('click')
}

Tab.prototype.setActive = function () {
  var self = this
  self.dom.className += ' active'
}

Tab.prototype.close = function (e) {
  var self = this
  if (e) e.stopPropagation()
  self.emit('close')
}

Tab.prototype.rename = function (newtitle) {
  var self = this

  self.title = newtitle

  self.dom.innerHTML = mustache.render(template, {title: newtitle})
  self.dom.querySelector('.close').addEventListener('click', self._onclose.bind(self))
}

module.exports = Tab