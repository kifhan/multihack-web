var SiteHeader = require('./interface/siteHeader')
var template = require('./interface/templates')
var mustache = require('mustache')
var util = require('./filesystem/util')
var RoomManager = require('./interface/roomMananger')
var ChatApp = require('./interface/chat')

var LOGIN_SERVER = window.location.protocol + '//' + '127.0.0.1:3000'

var loginHeader = new SiteHeader({
  loginCheck: pageInit,
  loginHost: LOGIN_SERVER
})

function pageInit (isLogedIn) {
  var roomID = util.getParameterByName('room')
  console.log('room ', roomID)
  if (isLogedIn && !roomID) {
    document.getElementById('content-body').innerHTML = mustache.render(template['rommMain'])
    var roomManager = new RoomManager()
    roomManager.openRoomView(function (data) {
      setRellatMain(data.room)
    })
  } else if (roomID) {
    // if has room name query
    setRellatMain(roomID)
  } else {
    document.getElementById('content-body').innerHTML = mustache.render(template['intro'])
  }
}

function setRellatMain (roomID) {
  document.getElementById('content-body').innerHTML = mustache.render(template['workspace'])
  var Main = require('./rellatMain')
  var rellatmain = new Main({
    hostname: window.location.host,
    container: document.getElementById('content-body'),
    embed: util.getParameterByName('embed')
  })
  rellatmain.onRoom({ room: roomID })

  var chat = new ChatApp({
    roomId: roomID,
    loginHost: LOGIN_SERVER,
    container: document.getElementById('content-body')
  })
}
