var dict = {}
var lang = require('./lang/lang')
var lg = lang.get.bind(lang)

dict['file'] =
  '<h1>{{title}}</h1>' +
  '<p>{{message}}</p>' +
  '<input style="display:none" type="file">' +
  '<button id="file-button" class="go-button">' + lg('upload') + '</button>' +
  '<button class="no-button">' + lg('skip') + '</button>'

dict['input'] =
  '<h1>{{title}}</h1>' +
  '<p>{{message}}</p>' +
  '<input class="modal-input" placeholder="{{placeholder}}" value="{{default}}" type="text"><br>' +
  '<button class="go-button">' + lg('join') + '</button>'

dict['confirm-delete'] =
  '<h1>{{title}}</h1>' +
  '<p>Are you sure you want to delete "{{fileName}}"?</p>' +
  '<button class="go-button">' + lg('delete') + '</button>' +
  '<button class="no-button">' + lg('cancel') + '</button>'

dict['force-input'] =
  '<h1>{{title}}</h1>' +
  '<p>{{message}}</p>' +
  '<input class="modal-input" placeholder="{{placeholder}}" value="{{default}}" type="text"><br>' +
  '<button class="go-button">' + lg('join') + '</button>'

dict['alert'] =
  '<h1>{{title}}</h1>' +
  '<p>{{message}}</p>' +
  '<button class="go-button">' + lg('continue') + '</button>'

dict['alert-html'] =
  '<h1>{{title}}</h1>' +
  '<p>{{{message}}}</p>' +
  '<button class="go-button">' + lg('continue') + '</button>'

dict['newFile'] =
  '<h1>{{title}}</h1>' +
  '<input type="text" placeholder="' + lg('name') + '"></input> <br>' +
  '<button class="go-button" data-type="file">' + lg('file') + '</button>' +
  '<button class="go-button" data-type="dir">' + lg('folder') + '</button>' +
  '<button class="no-button">' + lg('cancel') + '</button>'

dict['network'] =
  '<h1>Room <b>{{room}}</b></h1>' +
  '<div id="network-graph"></div>' +
  '<button class="no-button">' + lg('close') + '</button>'

dict['rename'] =
  '<h1>{{title}}</h1>' +
  '<input class="modal-input" placeholder="{{placeholder}}" value="{{default}}" type="text"><br>' +
  '<button class="go-button">' + lg('ok') + '</button>' +
  '<button class="no-button">' + lg('cancel') + '</button>'

dict['roomList'] =
  '{{#rooms}}' +
  '<li>' +
  '<!--<img src="./image/mac.jpg" class="thumb"/>-->' +
  '<h4><a class="name" href = "#">{{roomName}}</a></h4> <!--<span class="category">Game</span></h4>-->' +
  '<p class="description">{{roomDiscription}}</p>' +
  '</li>' +
  '{{/rooms}}'

dict['createRoom'] =
  '<h1>{{title}}</h1>' +
  '<h4>' + lg('project_name') + '</h4>' +
  '<input class="modal-input" type="text"><br>' +
  '<h4>' + lg('description') + '</h4>' +
  '<input class="modal-input" type="text"><br>' +
  '<button class="go-button">' + lg('join') + '</button>'

module.exports = dict