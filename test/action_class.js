var v = require('./../index'),
    h = require('./helper'),
    a = require('assert');

var MyAction = new(v.ActionClass)(function (reply, params) {
    params.user = {id: 1, name: 'Sean'};
    reply.pass(reply, params);
});


var SomeAction = new(MyAction)(function (reply, params) {
    reply.json(params.user);
});

new h.TestAction(SomeAction).should(function (response) {
    a.equal(response.status, 200);
    a.equal(response.headers['Content-Type'], 'text/json');
    a.equal(response.body, '{"id":1,"name":"Sean"}');
});
