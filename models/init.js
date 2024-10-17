var config = require('config');
var knex = require('knex')(config.get('database'));
module.exports = require('bookshelf')(knex);