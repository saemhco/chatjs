var config = require('config');
var redis = require("redis");
var opt = {db:config.get('redis.db')};
var client = redis.createClient(opt);

var Queue = {
    getQueue: function(queue) {
        return queue === undefined ? 'queues:default':'queues:' + queue;
    },
    push: function(job, data, queue) {
        var value = {
            job : job,
            data : data,
            id : this.makeid(32),
            attempts:1
        };
        client.rpush(this.getQueue(queue), JSON.stringify(value));
    },
    makeid: function(length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < length; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }   
};
module.exports = Queue;
