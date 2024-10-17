var bookshelf = require('./init');
var Setting = bookshelf.Model.extend({
    hasTimestamps: true,  
    tableName: 'settings',
    virtuals: {
        private: {
            get: function(){
                var private = this.get('private');
                if(private != ''){
                    return JSON.parse(private);
                }
                return [];
            },
            set: function(value){
                this.set('private', JSON.stringify(value));
            }
        } 
    }
});
module.exports = Room;