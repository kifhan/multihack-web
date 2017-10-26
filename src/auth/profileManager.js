/* global DOMException */

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var request = require('request')

inherits(ProfileManager, EventEmitter)

function ProfileManager () {
  var self = this

  self.token = null
  self.storeable = storageAvailable('localStorage')
  self.profile = null
  self.loginHost = window.location.protocol + '//' + window.location.host // default host setting
  // self.loginHost = 'http://ide.rellat.com:8888' // default host setting
}
ProfileManager.prototype.setLoginHost = function (host) {
  var self = this
  // var validateAddress = /^(?:(?:(?:http?|https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})).?)(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(host)
  // if (validateAddress)
  self.loginHost = host
  // else throw new Error('host address is not valid')
}
ProfileManager.prototype.verifyUser = function (cb) {
  var self = this
  if (self.storeable) {
    self.getToken()
    self.getProfile()

    if (self.token && self.profile) {
      request({
        method: 'GET',
        url: self.loginHost + '/api/v1/user/profile',
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          'x-access-token': self.token,
          'x-key': self.profile.email
        },
        json: true
      }, function (error, response, body) {
        if (error) cb(new Error(error))
        else {
          if (body.status === 'true') {
            self.setProfile(body.profile)
            // 혹시 업데이트 사항이 있을 수 있으므로 profile을 저장 해 둔다
            cb(null, self.getProfile())
          } else {
            cb(new Error(body.message))
          }
        }
      })
    } else {
      cb(new Error('Couldn\'t find Token or Profile'))
    }
  } else {
    cb(new Error('localStorage not available'))
  }
}

ProfileManager.prototype.submitLogin = function (email, password, callback) {
  var self = this
  request({
    method: 'POST',
    url: self.loginHost + '/user/login',
    headers:
    {
      'cache-control': 'no-cache',
      'content-type': 'application/json'
    },
    body: { email: email, password: password },
    json: true
  }, function (error, response, body) {
    // console.log(JSON.stringify(body))

    if (!error && (body.status === 'true' || body.status === true)) {
      self.setToken(body.token)
      self.setProfile(body.profile)
      callback(error, body)
    } else {
      error = error || (body ? body.message || 'someting went wrong' : 'someting went wrong')
      callback(error, body)
    }
  })
}

ProfileManager.prototype.logout = function (callback) {
  var self = this
  self.token = null
  self.profile = null
  window.localStorage.removeItem('AuthToken')
  window.localStorage.removeItem('UserProfile')
  if (callback) callback()
  else window.location.href = self.loginHost
}

ProfileManager.prototype.submitRegister = function (name, email, password, callback) {
  var self = this
  request({
    method: 'POST',
    url: self.loginHost + '/user/registerUser',
    headers:
    {
      'cache-control': 'no-cache',
      'content-type': 'application/json'
    },
    body: { email: email, password: password, username: name },
    json: true
  }, function (error, response, body) {
    if (!error && body.status === 'true') {
      callback(null, body)
    } else {
      error = error || (body ? body.message || 'someting went wrong' : 'someting went wrong')
      callback(error, body)
    }
  })
}

ProfileManager.prototype.goNextPage = function (path) {
  var self = this

  window.location.href = self.loginHost + path
}

ProfileManager.prototype.getToken = function () {
  var self = this
  self.token = window.localStorage.getItem('AuthToken')
  return self.token
}
ProfileManager.prototype.setToken = function (token) {
  var self = this

  window.localStorage.setItem('AuthToken', token)
  self.token = token
}

ProfileManager.prototype.getProfile = function () {
  var self = this
  self.profile = JSON.parse(window.localStorage.getItem('UserProfile'))
  return self.profile
}
ProfileManager.prototype.setProfile = function (profile) {
  var self = this

  window.localStorage.setItem('UserProfile', JSON.stringify(profile))
  self.profile = self.getProfile()
}

function storageAvailable (type) {
  try {
    var storage = window[type]
    var x = '__storage_test__'
    storage.setItem(x, x)
    storage.removeItem(x)
    return true
  } catch (e) {
    return e instanceof DOMException && (
      // everything except Firefox
      e.code === 22 ||
      // Firefox
      e.code === 1014 ||
      // test name field too, because code might not be present
      // everything except Firefox
      e.name === 'QuotaExceededError' ||
      // Firefox
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
      // acknowledge QuotaExceededError only if there's something already stored
      storage.length !== 0
  }
}

var prm = new ProfileManager()
window.ProfileManager = prm // expose to global
module.exports = prm
