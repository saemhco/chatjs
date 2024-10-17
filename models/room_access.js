var bookshelf = require('./init');
var User = require('./user');
var Room = require('./room');
var Message = require('./message');
//bookshelf.plugin('virtuals');
//bookshelf.plugin('pagination');
var RoomAccess = bookshelf.Model.extend({
    hasTimestamps: true,  
    tableName: 'room_accesses',
    user: function() {
        return this.belongsTo(User,'user_id');
    },
    room: function() {
        return this.belongsTo(Room,'room_id');
    }
});
module.exports = RoomAccess;