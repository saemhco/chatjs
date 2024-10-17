var bookshelf = require('./init');
bookshelf.plugin('virtuals');
bookshelf.plugin('pagination');
bookshelf.plugin('processor');
var User = require('./user');
var Foto = require('./foto');
var File = require('./file');
var Message = bookshelf.Model.extend({
    hasTimestamps: true,  
    tableName: 'messages',
    user: function() {
        return this.belongsTo(User,'user_id');
    },
    fotos: function() {
        return this.belongsToMany(Foto, 'message_fotos', 'messages_id', 'foto_id');
    },
    files: function() {
        return this.belongsToMany(File, 'message_files', 'messages_id', 'file_id');
    },
    virtuals: {
        date: function() {
            function zero(val){
                return val < 10 ? '0' + val: val;
            }
            var date = new Date( Date.parse(this.get('created_at')) ) ;
            return date.getFullYear() +'-'+ zero(date.getMonth()+1) + '-' + zero(date.getDate()) + ' ' + zero(date.getHours()) + ':' + zero(date.getMinutes()) + ':' + zero(date.getSeconds());
            var month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return month[date.getMonth()] +' '+ date.getDate() + ', ' + date.getFullYear() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
        }
    },
    processors: {
        text: function(value) {
            return checkTextForBadWords(value);
        }
    }
});

function checkTextForBadWords(text) {
    const badWords = [
        'Cunt',
        'Fucking',
        'Fucker',
        'Fuck',
        'Bitch',
        'Slut',
        'Whore',
        'Motherfucker',
        'Pussy',
        'Bastard',
        'Dickhead',
        'Moron',
        'Jerk',
        'Asshole',
        'Shit'
    ];

    for (const badWord of badWords) {
        var word = new Array(badWord.length).fill("*").join("");
        text = text.replace(new RegExp(badWord, "ig"), word);
    }
    return text;
}

module.exports = Message;