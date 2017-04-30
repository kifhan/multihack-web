
function User () {
    var self = this
    if (!(self instanceof User)) return new User()

    self.user_id = 'guest'
    self.user_name = 'guest'
    self.user_picture = './static/img/User-Profile.png'
    self.guest_user_el = '<div style="display:inline-block"><img width="32px" src="'+ self.user_picture +'"></div>'
    window.document.getElementById('status').innerHTML = self.guest_user_el;
    window.setUserData = self.setData.bind(self)
}

User.prototype.setData = function (data) {
    var self = this
    self.user_id = data.user_id
    self.user_name = data.user_name
    self.user_picture = data.user_picture
}

module.exports = new User()