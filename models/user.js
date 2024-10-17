// Importa Bookshelf y Knex desde el archivo de inicialización
var bookshelf = require('./init');

// Cargar el plugin de virtuals (asegúrate de tenerlo instalado)
const virtualsPlugin = require('bookshelf-virtuals-plugin');
bookshelf.plugin(virtualsPlugin);

// Definir el modelo User
var User = bookshelf.Model.extend({
    hasTimestamps: true,  // Incluye timestamps automáticos para created_at y updated_at
    tableName: 'users',   // Nombre de la tabla
    hidden: ['remember_token', 'api_token', 'email', 'password', 'created_at', 'updated_at'], // Ocultar estos campos en las respuestas JSON
    virtuals: {
        // Virtual para determinar si el usuario está en línea
        online: function() {
            var online_at = new Date(this.get('online_at'));
            var current_at = Date.now();
            return current_at / 1000 - online_at.getTime() / 1000 < 300; // 5 minutos (300 segundos)
        },
        // Virtual para obtener tiempos actuales y diferencias con online_at
        current_time: function() {
            var online_at = new Date(this.get('online_at'));
            return {
                'now': Date.now(),
                'now2': Date.now() / 1000,
                'online_at': online_at.getTime(),
                'online_at2': online_at.getTime() / 1000,
                'online': Date.now() / 1000 - online_at.getTime() / 1000
            };
        },
        // Virtual para obtener el ícono del usuario
        icon: function() {
            if (this.get('icon_key') == null) {
                return '/files/avatars/default.png';
            }
            return '/files/avatars/' + Math.ceil(this.get('id') / 1000) + '/' + this.get('id') + '_' + this.get('icon_key') + '.jpg';
        },
        // Virtual para obtener el ícono en miniatura del usuario
        icon_thumb: function() {
            if (this.get('icon_key') == null) {
                return '/files/avatars/default.png';
            }
            return '/files/avatars/' + Math.ceil(this.get('id') / 1000) + '/' + this.get('id') + '_' + this.get('icon_key') + '_thumb.jpg';
        }
    }
});

// Exportar el modelo User
module.exports = User;
