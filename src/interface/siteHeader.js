var ProfileManager = require('../auth/profileManager')
var ifaceUtil = require('./interfaceutil')
var template = require('./templates')
var mustache = require('mustache')

function SiteHeader (options) {
  var self = this

  self.loginCheckCallback = options.loginCheck || function () { }
  if (options.loginHost) ProfileManager.setLoginHost(options.loginHost)

  /**
   * Header and Nav Setting
   */
  document.getElementsByClassName('dropdown-toggle')[0].addEventListener('click', function (e) {
    e.stopPropagation()
    e.preventDefault()

    var self = document.getElementsByClassName('dropdown')[0]
    ifaceUtil.toggleClass(self, 'open')
  })
  document.addEventListener('click', function (e) {
    var self = document.getElementsByClassName('dropdown')[0]
    if (ifaceUtil.hasClass(self, 'open')) {
      ifaceUtil.toggleClass(self, 'open')
    }
  })

  document.getElementsByClassName('nav-slider')[0].addEventListener('click', function (e) {
    var self = document.getElementsByTagName('nav')[0]
    ifaceUtil.toggleClass(self, 'open')
    var overlay = document.getElementsByClassName('overlay-shadow')[0]
    overlay.style.display = 'block'
  })

  document.getElementsByClassName('overlay-shadow')[0].addEventListener('click', function (e) {
    var self = document.getElementsByTagName('nav')[0]
    if (ifaceUtil.hasClass(self, 'open')) {
      ifaceUtil.toggleClass(self, 'open')
    }
    e.target.style.display = 'none'
  })

  /**
   * Profile Setting
   */
  ProfileManager.verifyUser(function (err, profile) {
    if (err) {
      console.log(err.message)
      self.setNavProfile()
      self.loginCheckCallback(false)
    } else {
      self.setNavProfile(profile)
      self.loginCheckCallback(true)
    }
  })
}
SiteHeader.prototype.setNavProfile = function (profile) {
  var self = this
  if (!profile) {
    // 네비에 프로파일 부분을 로그인/회원가입 버튼 이벤트 설정
    document.getElementById('header-signin').addEventListener('click', function (e) { self.showLogin(false) })
    document.getElementById('header-signup').addEventListener('click', function (e) { self.showLogin(true) })
  } else {
    // TODO: 네비에 프로파일 사진과 메뉴 설정
    document.getElementById('header-profile').innerHTML = mustache.render(template['header-profile'], {
      profileName: ProfileManager.profile.username,
      profilePicture: ProfileManager.profile.picture
    })
    document.getElementById('nav-profile').innerHTML = mustache.render(template['nav-profile'], {
      profileName: ProfileManager.profile.username,
      profilePicture: ProfileManager.profile.picture
    })
    document.getElementById('header-signout').addEventListener('click', function (e) {
      ProfileManager.logout(function () {
        // window.location.reload()
        window.location.href = '/'
      })
    })
  }
}
SiteHeader.prototype.showLogin = function (isRegister) {
  var self = this

  document.getElementById('content-body').innerHTML = mustache.render(template['login'])

  // 먼저 로그인 화면에서 go-register를 누르면 fade out 되도록 한다
  var loginformElement = document.getElementById('login-form')

  var registerTxt = document.getElementById('go-register')
  registerTxt.addEventListener('click', function () {
    ifaceUtil.fadeOutIn(loginformElement, registerformElement, 500)
  })

  loginformElement.addEventListener('submit', function (e) {
    e.preventDefault()
    ProfileManager.submitLogin(document.loginForm.identifier.value, document.loginForm.password.value, function (err, msg) {
      // 로그인 실패하면 이 callback이 실행된다

      if (err) {
        self.loginCheckCallback(false)
      } else {
        // self.loginCheckCallback(true)
        window.location.href = '/'
      }
    })
    return false // stop propagating
  })

  var registerformElement = document.getElementById('register-form')
  var loginTxt = document.getElementById('go-login')
  loginTxt.addEventListener('click', function () {
    ifaceUtil.fadeOutIn(registerformElement, loginformElement, 500)
  })

  registerformElement.addEventListener('submit', function (e) {
    e.preventDefault()
    ProfileManager.submitRegister(document.registerForm.username.value, document.registerForm.identifier.value, document.registerForm.password.value, function (err, msg) {
      if (err) { throw err }
      console.log(msg)
      // ifaceUtil.fadeOutIn(registerformElement, loginformElement, 500)
      window.location.href = './'
    })
    return false // stop propagating
  })

  if (isRegister) ifaceUtil.fadeOutIn(loginformElement, registerformElement, 0)
}

module.exports = SiteHeader
