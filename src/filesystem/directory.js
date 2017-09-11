var util = require('./util')

function Directory (options) {
  var self = this
  if (!(self instanceof Directory)) return new Directory(options)

  self.name = options.name
  self.path = options.parentPath + '/' + options.name
  self.type = util.DIRECTORY_TYPE
  self.contentID = options.contentID || null
  self.parentPath = options.parentPath
  self.nodes = []
  self.isCollapsed = false
}

Directory.prototype.change = function (options) {
  var self = this
  if (options.name) self.name = options.name
  if (options.parentPath) self.parentPath = options.parentPath
  if (options.contentID) self.contentID = options.contentID
  self.path = self.parentPath + '/' + self.name
}

module.exports = Directory
