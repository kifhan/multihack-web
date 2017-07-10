/* global CodeMirror, Quill */
var util = require('./util')

function File (path) {
  var self = this
  if (!(self instanceof File)) return new File()

  self.name = util.getFilename(path)
  self.path = path
  self.isDir = false
  self.type = util.findFileType(path)

  self._content = null
  self.cmdoc = null
  self.quilldelta = null
  if(self.type === 'text') self.cmdoc = new CodeMirror.Doc('', util.pathToCodeMode(path))
  
  Object.defineProperty(self, 'content', {
    get: function () {
      switch (self.type) {
        case 'image': return self._content
        case 'text': return self.cmdoc.getValue()
        case 'quilljs': 
          var tempCont = document.createElement("div");
          (new Quill(tempCont)).setContents(self.quilldelta)
          return tempCont.getElementsByClassName("ql-editor")[0].innerHTML
        default: return self._content
      }
    },
    set: function (value) {
      switch (self.type) {
        case 'image':
          self._content = value
          break;
        case 'text':
          self.cmdoc.setValue(value)
          break;
        case 'quilljs':
          self.quilldelta = value
          break;
        default:
          self._content = value
          break;
      }
    }
  })
  
  Object.defineProperty(self, 'size', {
    get: function () {
      switch (self.type) {
        case 'image': return self._content.length
        case 'text': return self.cmdoc.getValue().length
        case 'quilljs': return self.content.length
        default: return self._content.length
      }
    }
  })
}

// File.prototype.write = function (value, cb) {
//   var self = this
//   switch (self.type) {
//     case 'image':
//       self.content = value
//       break;
//     case 'text':
//       self.cmdoc.setValue(value)
//       break;
//     case 'quilljs':
//       break;
//     default:
//       self.content = value
//       break;
//   }
//   if (cb) cb()
// }

// File.prototype.read = function (cb) {
//   var self = this
//   var cont = self.content
//   switch (self.type) {
//     case 'image':
//       break;
//     case 'text':
//       cont = self.cmdoc.getValue()
//       break;
//     case 'quilljs':
//       break;
//     default:
//       break;
//   }
//       if (cb) cb(cont)
// }

module.exports = File
