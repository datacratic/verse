var v = require('./../index'),
    h = require('./helper'),
    a = require('assert');

var router = new(v.Router)();


//Test Request Response #######################

var testAction = new(v.Action)(function (reply, params) {
    reply.send('Hello World');
});

router.map(/index.html/).bind(testAction);

var index = new(h.FakeRequest)('/index.html', '', {});
h.test(router, index, function (response) {
    a.ok(response);
    a.equal(response.status, 200);
    a.equal(response.body, 'Hello World');
});

// Test Routing ################################

router.map(/.*\/myAction/).bind(testAction);

var index = new(h.FakeRequest)('v8/routing/myAction', '', {});
h.test(router, index, function (response) {
    a.equal(response.status, 200);
    a.equal(response.body, 'Hello World');
});

var index = new(h.FakeRequest)('UNKOWN ACTION', '', {});
h.test(router, index, function (response) {
    a.equal(response.status, 404);
});

// Test composition ############################

var composedAction = new(v.Action)(function (reply, params) {
    reply.pass(reply, {'foo': 'bar'});
}, function (reply, params) {
    reply.send(JSON.stringify(params));
});

router.map(/composed.html/).bind(composedAction);

var index = new(h.FakeRequest)('/composed.html', '', {});
h.test(router, index, function (response) {
    a.equal(response.status, 200);
    var json 
    a.doesNotThrow(function () {
        json = JSON.parse(response.body);
    });

    a.equal(json.foo, 'bar');
});

// Param parsing #############################

var composedAction = new(v.Action)(function (reply, params) {
    reply.send(JSON.stringify(params.get));
});

router.map(/params.html/).bind(composedAction);

var index = new(h.FakeRequest)('/params.html?foo=lol&bar=test', '', {});
h.test(router, index, function (response) {
    a.equal(response.status, 200);
    var json 
    a.doesNotThrow(function () {
        json = JSON.parse(response.body);
    });

    a.equal(json.foo, 'lol');
    a.equal(json.bar, 'test');
});


// Header parsing ############################

var parseHeaders = new(v.Action)(function (reply, params) {
    reply.send(JSON.stringify(params.headers));
});

router.map(/headers.html/).bind(parseHeaders);

var index = new(h.FakeRequest)('/headers.html', '', {'host': 'localhost:9000'});
h.test(router, index, function (response) {
    a.equal(response.status, 200);
    var json 
    a.doesNotThrow(function () {
        json = JSON.parse(response.body);
    });

    a.equal(json['host'], 'localhost:9000');
});

// Cookies ###################################

//get
var parseCookies = new(v.Action)(function (reply, params) {
    a.equal(typeof params.cookies, 'object');
    a.equal(params.cookies.foo, 'bar');
    a.equal(params.cookies.lol, 'totally');

    reply.send('Cool bro');
});

router.map(/cookies.html/).bind(parseCookies);

var getCookie = new(h.FakeRequest)('/cookies.html', '', {'cookie': 'foo=bar; lol=totally'});
h.test(router, getCookie, function (response) {
    a.equal(response.status, 200);
});

//set
var setCookies = new(v.Action)(function (reply, params) {
    a.equal(typeof params.cookies, 'object');

    var inTenMinutes = new(Date)(new Date + (1000 * 60 * 10));
    reply.cookie('foo', 'bar', {expired: inTenMinutes});
    reply.send('Cool bro');
});

router.map(/setCookies.html/).bind(setCookies);

var index = new(h.FakeRequest)('/setCookies.html', '', {});
h.test(router, index, function (response) {
    a.equal(response.status, 200);
    a.ok(/foo=bar/.test(response.headers['Set-Cookie']));
});

// Static Files ##############################

var serveStatic = new(v.Action)(function (reply, params) {
    reply.serve('pixel.gif');
});

router.map(/pixel.gif/).bind(serveStatic);

var pixel = new(h.FakeRequest)('/pixel.gif', '', {});
h.test(router, pixel, function (response) {
    a.equal(response.status, 200);
    a.equal(response.headers['Content-Type'], 'image/gif');
    a.equal(response.headers['Content-Length'], '43');
});

// Exceptions  ###############################

var m = require('./../lib/middleware');

var problem = function (reply, params) {
    throw new(Error)("Catastrophic Error");
};

var willFail = new(v.Action)(problem);
var willSave = new(v.Action)(m.Exception, problem);

router.map(/willFail/).bind(willFail);

router.map(/willSave/).bind(willSave);

var fail= new(h.FakeRequest)('/willFail', '', {});
a.throws(function () {
    h.test(router, fail, function (response) {
        // shouldn't run
        a.equal(response.status, 200);
    });
});

var save = new(h.FakeRequest)('/willSave', '', {});
a.doesNotThrow(function () {
    h.test(router, save, function (response) {
        // should run
        a.equal(response.status, 500);
        a.ok(/Catastrophic Error/.test(response.body));
    });
});

// Abbreviation ##############################

new h.TestAction(function (reply, params) {
    reply.send('hello world');
}).should(function (response) {
    a.equal(response.status, 200);
    a.equal(response.body, 'hello world');
});
