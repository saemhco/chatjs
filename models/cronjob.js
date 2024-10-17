const bookshelf = require('./init');

const CronJob = bookshelf.Model({
    tableName: 'cronJobs'
});