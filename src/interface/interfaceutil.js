function fadeOutIn (outElem, InElement, speed) {
  if (!outElem.style.opacity) {
    outElem.style.opacity = 1
  } // end if

  var outInterval = setInterval(function () {
    outElem.style.opacity -= 0.04
    if (outElem.style.opacity <= 0) {
      clearInterval(outInterval)

      outElem.style.display = 'none'
      InElement.style.display = 'block'
      InElement.style.opacity = 0

      var inInterval = setInterval(function () {
        InElement.style.opacity = Number(InElement.style.opacity) + 0.04
        if (InElement.style.opacity >= 1) clearInterval(inInterval)
      }, speed / 50)
    }
  }, speed / 50)
} // end fadeOut()

function toggleClass (obj, classname) {
  var targetobj = obj
  if (typeof obj === 'string') { targetobj = document.getElementById(obj) }
  var classes = targetobj.className.match(/[^\x20\t\r\n\f]+/g) || []
  var rmatch = classes.indexOf(classname)

  if (rmatch > -1) {
    classes.splice(rmatch, 1)
    targetobj.className = classes.join(' ')
  } else {
    classes.push(classname)
    targetobj.className = classes.join(' ')
  }
}

function hasClass (obj, selector) {
  var targetobj = obj
  if (typeof obj === 'string') { targetobj = document.getElementById(obj) }

  var className = ' ' + selector + ' '
  if ((' ' + targetobj.className + ' ').replace(/[\n\t\r]/g, ' ').indexOf(className) > -1) {
    return true
  }
  return false
}

module.exports = {
  fadeOutIn: fadeOutIn,
  toggleClass: toggleClass,
  hasClass: hasClass
}
