var dict = {}
var lang = require('./lang/lang')
var lg = lang.get.bind(lang)

/**
 * Modal Template
 */
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

/**
 * Room select page Template
 */
dict['rommMain'] =
  '<div class="roomlist-container">' +
  '<h2>Project Room List</h2>' +
  '<div id="project-list">' +
  '<input class="search" placeholder="Search Project"/>' +
  '<button class="btn">Create</button>' +
  '<ul class="list">' +
  '</ul>' +
  '</div>' +
  '<div id="modal" class="modal text-center theme-dark-border"></div>' +
  '<div id="overlay" class="blocking-overlay overlay"></div>' +
  '</div>'

dict['roomList'] =
  '{{#rooms}}' +
  '<li>' +
  '<!--<img src="./image/mac.jpg" class="thumb"/>-->' +
  '<h4><a class="name" href="javascript:void(0)">{{roomName}}</a></h4> <!--<span class="category">Game</span></h4>-->' +
  '<p class="description">{{roomDiscription}}</p>' +
  '</li>' +
  '{{/rooms}}'

dict['createRoom'] =
  '<h1>{{title}}</h1>' +
  '<label for="projectnameinput">' + lg('project_name') + '</label>' +
  '<input id="projectnameinput" class="modal-input" type="text"><br>' +
  '<label for="projectdescinput">' + lg('description') + '</label>' +
  '<input id="projectdescinput" class="modal-input" type="text"><br>' +
  '<button class="go-button">' + lg('join') + '</button>' +
  '<button class="no-button">' + lg('cancel') + '</button>'

/**
 * Main Workspace Template
 */
dict['workspace'] =
  '<div class="theme-atom theme-dark theme-font-secondary">' +
  '<div id="sidebar" class="sidebar theme-light">' +
  '<div class="panel-topbar theme-border">' +
  '<span id="room"></span>' +
  '<span id="root-plus" class="beside plus">&#43;</span>' +
  '</div>' +
  '<div class="icon-button" id="collapsesidebar">' +
  '<img src="/img/collapse.png">' +
  '</div>' +
  '<ol id="tree" class="tree panel">' +
  '</ol>' +
  '</div>' +
  '<div id="main-workspace" class="workspace">' +
  '</div>' +
  '<div id="modal" class="modal text-center theme-dark-border"></div>' +
  '<div id="overlay" class="blocking-overlay overlay"></div>' +
  '</div>'

/**
 * Site Intro Template
 */
dict['intro'] =
  '<div class="intro-container">' +
  '<div class="row"><h1>RELLAT</h1></div>' +
  '<div class="row">' +
  '<div class="row-box">' +
  '<span style="font-weight:600;">Relltat is Simultaneous Collaborative Coding service to share with people how to code.<br><br></span>' +
  '<ol><li>Show the process of coding' +
  '<div>Show people how to code in real time. When annotating, explain what happens in the code by unpacking it.</div></li>' +
  '<li>Share how to code<div>' +
  'People write the code and comments together. Like Internet bulletin board or SNS, comment on code and exchange opinions. If you think of a better code, make suggestions and register. Like Wikipedia!' +
  '</div>' +
  '</li>' +
  '<li>Collaborative<div>' +
  'Try a more complex open source project. Give rewards and benefits to those who teach other people and contribute to the project! People recommend projects that fit their abilities.' +
  '</div></li></ol></div></div>' +
  '<div class="row">' +
  '<div class="row-box">' +
  '<h3>Current status</h3>' +
  '<span style="font-weight:600;">Version 0.1 Alpha build 0042<br><br></span>' +
  '<ul style="list-style: disc;">' +
  '<li>Collaborative Document editor</li>' +
  '<li>Collaborative Code editor with comment</li>' +
  '</ul></div></div>' +
  '<div class="row">' +
  '<div class="row-box" style="height:400px;">' +
  '<h3>What we are aiming for</h3>' +
  '<iframe width="560" height="315" src="https://www.youtube.com/embed/imJi6nFJXhQ?rel=0&amp;showinfo=0" frameborder="0" allowfullscreen style="float: left; margin-right: 20px;"></iframe>' +
  '<div style="float: left;width: 180px;padding-left: 20px;">' +
  '<ul style="list-style: disc;">' +
  '<li>Document editor</li>' +
  '<li>Kanban style agile board</li>' +
  '<li>Code editor</li>' +
  '<li>Revision history, logging system</li>' +
  '<li>Project branch management</li>' +
  '<li>Chatting with team member</li>' +
  '<li>Terminal with Virtual machine</li>' +
  '</ul></div></div></div>' +
  '<div class="row">' +
  '<div class="row-box">' +
  '<h3>Rellat philosophy</h3>' +
  '<span>Please check <a target="_blank" href="http://www.rellat.com">Rellat Blog</a> for more information.</span>' +
  '</div>' +
  '</div>' +
  '<div class="footer">' +
  '<div class="row-box">' +
  '<h3>Connect</h3>' +
  '<span>Check our <a target="_blank" href="http://fb.me/rellatkr">Rellat facebook page</a></span>' +
  '</div>' +
  '</div>' +
  '</div>'

/**
 * Site header, Login Template
 */
dict['login'] = '<div class="login-page">' +
  '    <div class="form">' +
  '        <form name="loginForm" id="login-form">' +
  '            <input type="email" placeholder="user email" autocomplete="username" name="identifier" id="identifierId"/>' +
  '            <input type="password" placeholder="password" autocomplete="password" name="password" id="passwordId"/>' +
  '            <input type="submit" name="submit" value="login"/>' +
  '            <p class="message">Not registered? <a href="#" id="go-register">Create an account</a></p>' +
  '        </form>' +
  '        <form name="registerForm" id="register-form">' +
  '            <input type="email" name="identifier" placeholder="email address"/>' +
  '            <input type="password" name="password" placeholder="password"/>' +
  '            <input type="text" name="username" placeholder="name"/>' +
  '            <input type="submit" name="submit" value="create"/>' +
  '            <p class="message">Already registered? <a href="#" id="go-login">Sign In</a></p>' +
  '        </form>' +
  '    </div>' +
  '</div>'

dict['header-profile'] = '<a id="header-signout" href="javascript:void(0)">Sign out</a>' +
  '<div id="profile-name">{{profileName}}</div><div id="profile-picture"><img src="{{profilePicture}}" width="32px"></div>'

dict['nav-profile'] = '<a class="nav-profile-icon" href="javascript:void(0)"><img alt="Profile picture" src="{{profilePicture}}" width="38px"></a>' +
  '<a class="nav-profile-text" href= "javascript:void(0)"> {{profileName}}</a>'

/**
 * Chat Template
 */
dict['chat'] =// doesn't need room selection on ide.
  // '<div id="room-section" class="room-section container clearfix">' +
  // '  <div class="room" style="width: 100%;">' +
  // '    <div class="room-header clearfix">' +
  // '      <div class="room-about">' +
  // '        <div class="room-title">Rooms</div>' +
  // '        <div id="room-num-rooms" class="room-num-rooms"></div>' +
  // '      </div>' +
  // '      <i class="fa fa-th-list"></i>' +
  // '    </div> <!-- end room-header -->' +
  // '    <div id="room-create" class="room-create clearfix" style="border-bottom: 2px solid white;">' +
  // '      <input id="room-create-name" type="text" name="title" autofocus placeholder ="Type a new room">' +
  // '      <button id="room-create-button">Create</button>' +
  // '    </div> <!-- end room-create -->' +
  // '    <div id="room-list" class="room-list">' +
  // '      <ul>' +
  // '          <!-- <a href="#"><li class="room-item">room.title</li></a> -->' +
  // '          <!-- <p class="message" style="text-align: center; padding: 0; margin: 0;">Create your first room!</p> -->' +
  // '      </ul>' +
  // '    </div> <!-- end room-list -->' +
  // '  </div> <!-- end room -->' +
  // '</div>' +
  '<div id="chat-container" class="chat-section">' +
  '  <div class="chat">' +
  '    <div class="chat-header clearfix">' +
  '      <img src="./img/user.jpg" alt="avatar" style="display:none;">' +
  '      <div class="chat-about">' +
  '        <div id="chat-room-title" class="chat-room" style="display:none;">room.title</div>' +
  '        <div id="chat-num-users" class="chat-num-users"> User(s)</div>' +
  '      </div>' +
  '      <a id="chat-btn-users" href="javascript:void(0)"><i class="material-icons">people</i></a>' +
  '    </div> <!-- end chat-header -->' +
  '    <div id="chat-history" class="chat-history">' +
  '      <ul>' +
  '      </ul>' +
  '      <div class="chat-message clearfix">' +
  '        <textarea id="chat-message-text" name="message" placeholder ="Type your message" rows="3"></textarea>' +
  '        <a id="chat-message-button" href="javascript:void(0)"><i class="material-icons">send</i></a>' +
  '      </div> <!-- end chat-message -->' +
  '    </div> <!-- end chat-history -->' +
  '    <div id="users-list" class="users-list">' +
  '      <ul class="list">' +
  '      </ul>' +
  '    </div>' +
  '  </div> <!-- end chat -->' +
  // '  <div class="controls"><a href="#" id="logout-btn" class="logout-btn">Logout</a></div>' +
  '</div> <!-- end container -->'

dict['chat-users'] =
  '{{#users}}' +
  '<li class="clearfix" id="user-{{userId}}">' +
  '      <img src="{{picture}}" alt="{{username}}" />' +
  '      <div class="about">' +
  '      <div class="name">{{username}}</div>' +
  '      <div class="status"><i class="fa fa-circle {{online}}"></i> {{online}}</div>' +
  '      </div></li>' +
  '{{/users}}'

dict['chat-message'] = '<li>' +
  '    <div class="message-data">' +
  '    <span class="message-data-name">{{username}}</span>' +
  '    <span class="message-data-time">{{date}}</span>' +
  '    </div>' +
  '    <div class="message my-message" dir="auto">{{content}}</div>' +
  '    </li>'

/**
 * Reply Template
 */
dict['reply-line-widget'] =
'<input id="{{checkboxID}}" type="checkbox" class="reply-toggle-check" ><a class="reply-toggle-btn" id="{{btnID}}"><i class="material-icons">comment</i></a><ol></ol>'

dict['reply-input-super'] =
  '<div class="reply" style="margin:0;padding:5px; background-color:#f6f7f9;">' +
  '<div class="reply-img" style="padding:5px; display:inline-block;">' +
  '<img src="{{picture}}" width="32px"></div>' +
  '<div class="reply-text-container" style="margin:0;padding-top:5px; vertical-align: top; display:inline-block;line-height:1.4;width: calc(100% - 60px);min-height:37px;">' +
  '<div class="reply-input-box" style="border:1px solid #aaa; background:#ffffff;">' +
  '<div id="reply-input-{{replyID}}" class="reply-input-cell" style="padding:8px;color:#000;" contenteditable="true" data-placeholder="답글 달기 ..." tabindex="-1">' +
  '</div>' +
  '</div>' +
  '</div>' +
  '</div>'

dict['reply-input-sub'] =
  '<div class="reply" style="margin:0;background-color:#f6f7f9;">' +
  '<div class="reply-img" style="padding:5px; display:inline-block; margin-left: 4rem">' +
  '<img src="{{picture}}" width="32px"></div>' +
  '<div class="reply-text-container" style="margin:0;padding-top:5px; vertical-align: top; display:inline-block;line-height:1.4;width: calc(100% - 100px);min-height:37px;">' +
  '<div class="reply-input-box" style="border:1px solid #aaa; background:#ffffff;">' +
  '<div id="reply-input-{{replyID}}" class="reply-input-cell" style="padding:8px;color:#000;" contenteditable="true" data-placeholder="답글 달기 ..." tabindex="-1">' +
  '</div>' +
  '</div>' +
  '</div>' +
  '</div>'

dict['reply-super'] =
  '<div class="reply-img"><img src="{{picture}}" width="32px"></div>' +
  '<div class="reply-text-container">' +
  ' <a href="javascript:void(0)"><span>{{username}}</span></a>' +
  ' <span>{{content}}</span>' +
  '<div>'
  // '<a style="text-decoration:none;color:#365899;" href="#"><span>Like</span></a> · ' +
  // '<a style="text-decoration:none;color:#365899;" href="javascript:void(0)"><span>Remove</span></a> · ' +
  // '<a style="text-decoration:none;color:#365899;" href="javascript:void(0)"><span>Reply</span></a> · ' +
  // '<a style="color:#888888;text-decoration:none;" href="#">'+
  // '<span id="reply-time-{{replyID}}" style="color:#888888;">Just added</span>' +
  // '</a>'+
  // '</div></div>'
  // '<div class="reply-button" style="color:#888888;float:right;visibility: hidden;">x</div>'

module.exports = dict
