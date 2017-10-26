var ProfileManager = require('../auth/profileManager')
var io = require('socket.io-client')
var request = require('request')
var mustache = require('mustache')
var templates = require('./templates')
var util = require('./interfaceutil')

function ChatApp (options) {
  var self = this
  self.roomId = options.roomId
  if (!self.roomId) throw new Error('Room id is missing. Can not set chat app.')
  // self.loginHost = window.location.protocol + '//' + window.location.host // default host setting
  self.loginHost = options.loginHost || window.location.protocol + '//' + window.location.host // default host setting
  self.container = options.container

  self.container.insertAdjacentHTML('beforeend', mustache.render(templates['chat']))

  // set Socket IO
  self.socket = io(self.loginHost)
  self.socket.on('connect', function () {
    self.socketauth(self.socket)
    // self.setRoomList()
    self.setChat()
  })

  // set room list
  request({
    method: 'GET',
    url: self.loginHost + '/api/v1/chat/rooms',
    headers:
    {
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'x-key': ProfileManager.getProfile().email,
      'x-access-token': ProfileManager.getToken()
    },
    json: true
  }, function (error, response, body) {
    console.log('get chat rooms' + JSON.stringify(body))
    if (error) throw new Error(error)
    // for (var key in body.rooms) {
    //   if (body.rooms.hasOwnProperty(key)) {
    //     // console.log('room: ' + JSON.stringify(body.rooms[key]))
    //     helpers.updateRoomsList(self, body.rooms[key])
    //   }
    // }
    var myroom = body.rooms.find(function (room) {
      return room.title === self.roomId
    })
    if (myroom) {
      self.joinRoom(myroom._id, myroom.title)
    } else {
      self.socket.once('updateRoomsList', function (room) {
        console.log('get chat rooms' + JSON.stringify(room))

        if (room.title === self.roomId) {
          self.joinRoom(room._id, room.title)
        } else {
          console.log('could not get created room')
        }
      })
      self.socket.emit('createRoom', self.roomId)
    }
  })

  // set toggle userlist
  if (util.hasClass('header-chat', 'hide')) util.toggleClass('header-chat', 'hide')
  document.getElementById('chat-btn-users').addEventListener('click', function (e) {
    util.toggleClass('users-list', 'open')
  })
  document.getElementById('header-chat').addEventListener('click', function (e) {
    util.toggleClass('chat-container', 'open')
  })
}

ChatApp.prototype.socketauth = function (socket) {
  // get auth from server.
  socket.emit('authentication', { token: ProfileManager.getToken(), profile: ProfileManager.getProfile() })
  socket.on('unauthorized', function (err) {
    console.log('There was an error with the authentication:', err.message)
    console.log('refresh the page')
  })
}

ChatApp.prototype.setRoomList = function () {
  var self = this

  var roomCreate = document.getElementById('room-create')
  // Update rooms list upon emitting updateRoomsList event
  self.socket.on('updateRoomsList', function (room) {
    // console.log('socket: ' + JSON.stringify(room))
    // Display an error message upon a user error(i.e. creating a room with an existing title)
    if (room.error != null) {
      roomCreate.insertAdjacentHTML('beforeend', '<p class="message error">' + room.error + '</p>')
    } else {
      helpers.updateRoomsList(self, room)
    }
  })
  // Whenever the user hits the create button, emit createRoom event.
  document.getElementById('room-create-button').addEventListener('click', function (e) {
    console.log('button click')
    var inputel = document.getElementById('room-create-name')
    var roomTitle = inputel.value.trim() // remove white space from name
    self.socket.emit('createRoom', roomTitle)
    inputel.value = ''
  })
}

ChatApp.prototype.setChat = function () {
  var self = this
  var msgContainer = document.getElementById('chat-history')
  // Update users list upon emitting updateUsersList event
  self.socket.on('updateUsersList', function (users, clear) {
    console.log('socket: ' + JSON.stringify(users))
    if (!self.roomId) return
    if (users.error != null) {
      msgContainer.insertAdjacentHTML('beforeend', '<p class="message error">' + users.error + '</p>')
    } else {
      helpers.updateUsersList(users, clear)
    }
  })

  function sendMsg (e) {
    if (!self.roomId) return
    var inputel = document.getElementById('chat-message-text')
    var messageContent = inputel.value.trim() // remove white space from name
    if (messageContent !== '') {
      var message = {
        content: messageContent,
        username: ProfileManager.getProfile().username,
        userId: ProfileManager.getProfile().userId,
        date: Date.now()
      }

      self.socket.emit('newMessage', self.roomId, message)
      inputel.value = ''
      helpers.addMessage(message)
    }
  }

  // Whenever the user hits the send button, emit newMessage event.
  document.getElementById('chat-message-button').addEventListener('click', sendMsg)
  document.getElementById('chat-message-text').addEventListener('keydown', function (event) {
    if (event.keyCode === 13 && !event.shiftKey) {
      sendMsg(event)
      event.preventDefault()
    }
  })

  // Whenever a user leaves the current room, remove the user from users list
  self.socket.on('removeUser', function (userId) {
    if (!self.roomId) return
    var el = document.getElementById('user-' + userId)
    console.log('remove user ' + userId)
    el.parentNode.removeChild(el)
    helpers.updateNumOfUsers()
  })

  // Append a new message
  self.socket.on('addMessage', function (message) {
    if (!self.roomId) return
    helpers.addMessage(message)
  })
}

ChatApp.prototype.joinRoom = function (roomId, roomTitle) {
  var self = this
  if (self.roomId) {
    self.socket.emit('leaveRoom', self.roomId)
    helpers.clearChatScreen()
  }
  self.roomId = roomId
  document.getElementById('chat-room-title').innerText = roomTitle
  self.socket.emit('join', self.roomId)
}

var helpers = {
  encodeHTML: function (str) {
    return document.createElement('a').appendChild(document.createTextNode(str)).parentNode.innerHTML
  },
  decodeHTML: function (html) {
    var a = document.createElement('a')
    a.innerHTML = html
    return a.textContent
  },
  // Update rooms list
  updateRoomsList: function (chatapp, room) {
    room.title = this.encodeHTML(room.title)

    var el = document.createElement('a')
    el.href = '#'
    el.addEventListener('click', function (e) {
      chatapp.joinRoom(room._id, room.title)
      return false
    })
    el.innerHTML = '<li class="room-item">' + room.title + '</li>'

    // document.getElementById('room-list').firstChild.insertAdjacentHTML('afterbegin', html)
    document.getElementById('room-list').getElementsByTagName('ul')[0].appendChild(el)
    this.updateNumOfRooms()
  },
  // Update users list
  updateUsersList: function (users, clear) {
    if (users.constructor !== Array) {
      users = [users]
    }
    // console.log('user ' + JSON.stringify(users))

    var html = mustache.render(templates['chat-users'], { users: users })

    if (html === '') { return }

    if (clear) {
      var el = document.getElementById('users-list').getElementsByTagName('ul')[0]
      while (el.firstChild) { el.removeChild(el.firstChild) }
      el.innerHTML = html
    } else {
      document.getElementById('users-list').getElementsByTagName('ul')[0].insertAdjacentHTML('afterbegin', html)
    }

    this.updateNumOfUsers()
  },

  // Adding a new message to chat history
  addMessage: function (message) {
    message.date = (new Date(message.date)).toLocaleString()
    message.username = this.encodeHTML(message.username)
    message.content = this.encodeHTML(message.content)

    var html = mustache.render(templates['chat-message'], message)

    document.getElementById('chat-history').getElementsByTagName('ul')[0].insertAdjacentHTML('beforeend', html)

    // Keep scroll bar down
    var objDiv = document.getElementById('chat-history')
    objDiv.scrollTop = objDiv.scrollHeight
  },

  clearChatScreen: function () {
    var el = document.getElementById('users-list').getElementsByTagName('ul')[0]
    while (el.firstChild) { el.removeChild(el.firstChild) }
    var el2 = document.getElementById('chat-history').getElementsByTagName('ul')[0]
    while (el2.firstChild) { el2.removeChild(el2.firstChild) }
  },

  // Update number of rooms
  // This method MUST be called after adding a new room
  updateNumOfRooms: function () {
    var objCount = document.getElementById('room-list').getElementsByTagName('ul')[0].childNodes.length
    document.getElementById('room-num-rooms').innerText = (objCount - 5) + ' Room(s)'
  },

  // Update number of online users in the current room
  // This method MUST be called after adding, or removing list element(s)
  updateNumOfUsers: function () {
    var objCount = document.getElementById('users-list').getElementsByTagName('ul')[0].childNodes.length
    document.getElementById('chat-num-users').innerText = objCount + ' User(s)'
  }
}

module.exports = ChatApp
