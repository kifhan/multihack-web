var mustache = require('mustache')
var templates = require('./../interface/templates')
var request = require('request')
var User = require('./../auth/user')
var List = require('list.js')

function RoomManager () {
  var self = this
  if (!(self instanceof RoomManager)) new RoomManager()

  self.container = document.getElementById('container')
  self.listElement = document.querySelector('.list')
  self.sidebar = document.getElementById('sidebar')
  self.workspace = document.getElementById('main-workspace')
}

RoomManager.prototype.postRoom = function (values, onRoom, modal) {
  var self = this

  var options = {
    method: 'POST',
    url: 'http://localhost:8080/room',
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
    url: 'http://localhost:8080/roomList',
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

RoomManager.prototype.openRoomView = function (modalCallback, onRoom) {
  var self = this
  self.getRoomList(function (data) {

    self.listElement.innerHTML = mustache.render(templates['roomList'], data)

    self.container.style.display = 'block'

    self.sidebar.style.display = 'none'
    self.workspace.style.display = 'none'
    self.roomViewInit(modalCallback, onRoom)
  })

}

RoomManager.prototype.roomViewInit = function (modalCallback, onRoom) {
  var self = this

  // create 버튼 이벤트 설정
  var CreateBtn = document.querySelector('.btn')
  CreateBtn.addEventListener('click', function () {
    modalCallback(self.postRoom.bind(self), onRoom)
  })

  // 리스트를 순회하면서 project를 선택했을 때 이벤트 설정
  var projectNames = document.getElementsByClassName('name')

  for (var i = 0, len = projectNames.length; i < len; i++) {

    projectNames[i].addEventListener('click', function (e) {
      // 프로젝트 view로 변경한다
      self.closeRoomView()
      onRoom({
        room: e.target.innerHTML,
        nickname: User.user_id
      })

    })
  }

  // List 라이브러리의 객체를 생성하면 알아서 각 기능을을 잡아준다
  // input에 이벤트를 달아서 검색을 하게 해 주며 검색 결과를 ul에 적용한다
  var projectList = new List('project-list', {valueNames: ['name']})

}

RoomManager.prototype.closeRoomView = function () {
  var self = this

  self.container.style.display = 'none'

  self.sidebar.style.display = 'block'
  self.workspace.style.display = 'block'
}

module.exports = RoomManager