// CodeMirror Doc bind
  function CodeMirrorCallback (cm, delta) {
    mutualExcluse(function () {
      var start = CodeMirrorInstance.indexFromPos(delta.from)
      // apply the delete operation first
      if (delta.removed.length > 0) {
      var delLength = 0
      for (var j = 0; j < delta.removed.length; j++) {
          delLength += delta.removed[j].length
      }
      // "enter" is also a character in our case
      delLength += delta.removed.length - 1
      self.delete(start, delLength)
      }
      // apply insert operation
      self.insert(start, delta.text.join('\n'))
    })
  }
  CodeMirrorInstance.on('change', CodeMirrorCallback)

  function r(n,t){t(function(){i=e.indexFromPos(t.from);if(t.removed.length>0){for(var s=0,l=0;l<t.removed.length;l++)s+=t.removed[l].length;s+=t.removed.length-1,o.delete(i,s)}o.insert(i,t.text.join("\n"))})}function i(n){t(function(){var t=e.posFromIndex(n.index);if("insert"===n.type){var r=t;e.replaceRange(n.values.join(""),t,r)}else if("delete"===n.type){var i=e.posFromIndex(n.index+n.length);e.replaceRange("",t,i)}})}var o=this;n=n||{};var s=!0;e.setValue(this.toString()),e.on("changes",r)