// var util = require('./util')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
inherits(File, EventEmitter)

function File (options) {
  var self = this
  if (!(self instanceof File)) return new File(options)

  self.name = options.name
  self.path = options.parentPath + '/' + options.name
  self.type = options.type
  self.parentPath = options.parentPath
  self.contentID = options.contentID || null
  self.replydbID = options.replydbID || null
}

File.prototype.change = function (options) {
  var self = this
  if (options.name) self.name = options.name
  if (options.type) self.type = options.type
  if (options.parentPath) self.parentPath = options.parentPath
  if (options.contentID) self.contentID = options.contentID
  if (options.replydbID) self.replydbID = options.replydbID
  self.path = self.parentPath + '/' + self.name

  self.emit('change', self)
}

module.exports = File
