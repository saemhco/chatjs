var bookshelf = require('./init');
var User = require('./user');
var Message = require('./message');
//bookshelf.plugin('virtuals');
//bookshelf.plugin('pagination');
var Room = bookshelf.Model.extend({
    hasTimestamps: true,  
    tableName: 'rooms',
    users: function() {
        return this.belongsToMany(User,'room_accesses' , 'room_id', 'user_id');
    },
    message: function() {
        return this.belongsTo(Message, 'message_id');
    },
    messages: function() {
        return this.hasMany(Message,'room_id');
    },
    getСompanion: function(user_id){
        var usersId = this.get('data').split('_');
        return user_id == usersId[0] ? usersId[1]: usersId[0];
    },
    getSettings: function(user_id){
        var usersId = this.get('data').split('_');
        if(user_id == usersId[0]){
            return JSON.parse(this.get('settings_first'));
        }
        if(user_id == usersId[1]){
            return JSON.parse(this.get('settings_second'));
        }
        return null;
    },
    getSettingsSpouse: function(user_id){
        var usersId = this.get('data').split('_');
        if(user_id == usersId[0]){
            return JSON.parse(this.get('settings_second'));
        }
        if(user_id == usersId[1]){
            return JSON.parse(this.get('settings_first'));
        }
        return null;
    },
    getSettingsMy: function(user_id){
        var usersId = this.get('data').split('_');
        if(user_id == usersId[0]){
            return JSON.parse(this.get('settings_my_first'));
        }
        if(user_id == usersId[1]){
            return JSON.parse(this.get('settings_my_second'));
        }
        return null;
    },
    setSettings: function(user_id, value){
        var usersId = this.get('data').split('_');
        if(user_id == usersId[0]){
            this.set('settings_second', JSON.stringify(value));
        }
        if(user_id == usersId[1]){
            this.set('settings_first', JSON.stringify(value));
        }
    },
    setSettingsMy: function(user_id, value){
        var usersId = this.get('data').split('_');
        if(user_id == usersId[0]){
            this.set('settings_my_first', JSON.stringify(value));
        }
        if(user_id == usersId[1]){
            this.set('settings_my_second', JSON.stringify(value));
        }
    }
    
});
module.exports = Room;