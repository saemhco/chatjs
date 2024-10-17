var bookshelf = require('./init');
bookshelf.plugin('virtuals');
var File = bookshelf.Model.extend({
    hasTimestamps: true,  
    tableName: 'files',
    virtuals: {
        url: function() {
            var id = this.get('id');
            var type = this.get('type');
            var destinationPath = '/files/other/'+ Math.ceil(id/1000) + '/';
            return destinationPath + id + '_' + this.get('skey') + '.' + type;
        },
        type: function() {
            var mime = this.get('mime');
            return mime.split("/")[1];
        }
    }
});
module.exports = File;