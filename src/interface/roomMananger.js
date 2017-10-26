var mustache = require('mustache')
var templates = require('../interface/templates')
var request = require('request')
var List = require('list.js')
var Modal = require('../interface/modal')
var lang = require('../interface/lang/lang')
var lg = lang.get.bind(lang)

function RoomManager () {
  var self = this
  if (!(self instanceof RoomManager)) return new RoomManager()

  self.container = document.getElementById('content-body')
  self.listElement = document.querySelector('.list')
  self.loginHost = window.location.protocol + '//' + window.location.host // default host setting

  document.getElementById('modal').style.display = 'none'
  document.getElementById('overlay').style.display = 'none'
}

RoomManager.prototype.postRoom = function (values, onRoom, modal) {
  var self = this

  var options = {
    method: 'POST',
    url: self.loginHost + '/room',
    headers:
    {
      'cache-control': 'no-cache',
      'content-type': 'application/json'
    },
    body: values,
    json: true
  }
  request(options, function (error, response, body) {
    if (error) throw new Error(error)
    if (body.flag) {
      modal.close()
      self.closeRoomView()
      onRoom({room: values.roomName})
    } else {
      var inputs = modal.el.querySelectorAll('input')
      inputs[0].value = ''
      inputs[0].placeholder = 'already exist'
    }
  })
}

RoomManager.prototype.getRoomList = function (callback) {
  var self = this

  var options = {
    method: 'GET',
    url: self.loginHost + '/roomList',
    headers:
    {
      'cache-control': 'no-cache',
      'content-type': 'application/json'
    },
    json: true
  }

  request(options, function (error, response, body) {
    if (error) throw new Error(error)

    callback({'rooms': body})
  })
}

RoomManager.prototype.openRoomView = function (onRoom) {
  var self = this
  self.getRoomList(function (data) {
    self.listElement.innerHTML = mustache.render(templates['roomList'], data)
    self.roomViewInit(onRoom)
  })
}

RoomManager.prototype.roomViewInit = function (onRoom) {
  var self = this

  // create 버튼 이벤트 설정
  var CreateBtn = document.querySelector('.btn')
  CreateBtn.addEventListener('click', function () {
    self.createRoom(onRoom)
  })

  // 리스트를 순회하면서 project를 선택했을 때 이벤트 설정
  var projectNames = document.getElementsByClassName('name')

  for (var i = 0, len = projectNames.length; i < len; i++) {
    projectNames[i].addEventListener('click', function (e) {
      // 프로젝트 view로 변경한다
      self.closeRoomView()
      onRoom({
        room: e.target.innerHTML
      })
    })
  }

  // List 라이브러리의 객체를 생성하면 알아서 각 기능을을 잡아준다
  // input에 이벤트를 달아서 검색을 하게 해 주며 검색 결과를 ul에 적용한다
  var projectList = new List('project-list', {valueNames: ['name']})
}

RoomManager.prototype.createRoom = function (onRoom) {
  var self = this
  // 모달창을 만들고 나서 모달창을 감싸는 부분의 classname으로 만들면 이 안에 들어가는 것 같다

  var roomModal = new Modal('createRoom', {
    title: 'Create Room'
  })
  roomModal.on('done', function (e) {
    // roomModal.close()
    var output = {
      roomName: e.inputs[0].value,
      roomDiscription: e.inputs[1].value
    }

    self.postRoom(output, onRoom, roomModal)
  })
  roomModal.on('cancel', function () {
    roomModal.close()
  })
  roomModal.open()
}

RoomManager.prototype.closeRoomView = function () {
  // var self = this
  // 룸 화면을 벗어날 떄 호출된다.
}

module.exports = RoomManager
