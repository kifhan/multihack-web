var util = {}

util.getFilename = function (path) {
  var split = path.split('/')
  return split[split.length - 1]
}

util.getParentPath = function (path) {
  var parentPath = path.split('/')
  parentPath.splice(-1, 1)
  return parentPath.join('/')
}

util.getExtension = function (path) {
  path = util.getFilename(path)
  var split = path.split('.')
  return split[split.length - 1]
}

var CM_MAPPINGS = {
  'js': 'javascript',
  'coffee': 'javascript',
  'ts': 'javascript',
  'json': 'javascript',
  'css': 'css',
  'sass': 'css',
  'less': 'css',
  'html': 'htmlmixed',
  'xml': 'xml',
  'py': 'python',
  'php': 'application/x-httpd-php',
  'md': 'markdown'
}
util.pathToCodeMode = function (path) {
  return {
    name: CM_MAPPINGS[util.getExtension(path)] || null,
    globalVars: true
  }
}

var VIEW_MAPPINGS = {
  'png': 'image',
  'jpg': 'image',
  'jpeg': 'image',
  'jpeg2000': 'image',
  'tif': 'image',
  'tiff': 'image',
  'gif': 'image',
  'bmp': 'image',
  'ico': 'image'
}
util.getViewMapping = function (path) {
  return VIEW_MAPPINGS[util.getExtension(path)] || null
}

var PATH_MAPPINGS = {
  'quill': 'quilljs',
  'replydb': 'replydb'
}
util.pathCheck = function (path) {
  return PATH_MAPPINGS[util.getExtension(path)] || null
}
util.findFileType = function (path) {
  return (util.pathCheck(path) || (util.pathToCodeMode(path).name ? 'text' : null) || util.getViewMapping(path) || 'unknown')
}

util.DIRECTORY_TYPE = 'directory'

util.getParameterByName = function (name) {
  var url = window.location.href
  name = name.replace(/[\[\]]/g, '\\$&')
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  var results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

util.randomStr = function () {
  return Math.random().toString(36).substr(2)
}

module.exports = util
