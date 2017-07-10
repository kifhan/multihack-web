var util = {}

util.getFilename = function (path) {
  var split = path.split('/')
  return split[split.length - 1]
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
  return (util.pathCheck(path) 
  || (!!util.pathToCodeMode(path).name?'text':null) 
  || util.getViewMapping(path) 
  || 'unknown')
}

// Creates a zip archive from a file tree
util.zipTree = function (zip, nodeList) {
  console.log(nodeList)
  for (var i = 0; i < nodeList.length; i++) {
 // Iterate children

    if (nodeList[i].isDir) {
      util.zipTree(zip, nodeList[i].nodes)
    } else {
      zip.file(nodeList[i].path.slice(1), nodeList[i].content)
    }
  }
}

util.getParameterByName = function (name) {
    var url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

module.exports = util
