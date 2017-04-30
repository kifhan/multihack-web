
function User () {
    var self = this
    if (!(self instanceof User)) return new User()

    self.user_id = 'guest'
    self.user_name = 'guest'
    self.user_picture = './static/img/User-Profile.png'
    self.guest_user_el = '<div style="display:inline-block"><img width="32px" src="'+ self.user_picture +'"></div>'
    window.document.getElementById('status').innerHTML = self.guest_user_el;
}

// User.prototype.setReplies = function (yarraydata) {
// }
module.exports = new User()