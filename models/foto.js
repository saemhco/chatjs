var bookshelf = require('./init');
bookshelf.plugin('virtuals');
var Foto = bookshelf.Model.extend({
    hasTimestamps: true,  
    tableName: 'fotos',
    virtuals: {
        thumb: function() {
            var id = this.get('id');
            var type = this.get('type');
            var destinationPath = '/files/img/'+ Math.ceil(id/1000) + '/';
            return destinationPath + id + '_' + this.get('skey') + '.' + type;
        },
        url: function() {
            var id = this.get('id');
            var type = this.get('type');
            var destinationPath = '/files/img/'+ Math.ceil(id/1000) + '/';
            return destinationPath + id + '_' + this.get('skey') + '.' + type;
        },
        type: function() {
            var mime = this.get('mime');
            if(mime == 'image/jpeg') return 'jpg';
            if(mime == 'image/png') return 'png';
            if(mime == 'image/gif') return 'gif';
            return '';
        }
    }    
});
module.exports = Foto;