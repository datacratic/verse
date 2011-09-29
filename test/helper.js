var EventEmitter = require('events').EventEmitter;

function mixin () {
    var args = Array.prototype.slice.apply(arguments);
    var target = {};
    args = args.filter(function (o) { return typeof(o) == 'object' } );
    args.forEach(function (other) {
        Object.keys(other).forEach(function (key) {
            target[key] = other[key];
        });
    });

    return target;
};

var defaultHeaders = {
    host: 'localhost:3301',
     connection: 'keep-alive',
     accept: '*/*',
     'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_0) AppleWebKit/535.1 (KHTML, like Gecko) Chrome/14.0.8 35.186 Safari/535.1',
     'accept-encoding': 'gzip,deflate,sdch',
     'accept-language': 'en-US,en;q=0.8',
     'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
     cookie: 'cookies=arefun'
};

var Request = this.FakeRequest = function (url, params, headers) {
    this.socket = this.client = {
        remoteAddress: '127.0.0.1',
        remotePort: 52560
    };
    this.url = url;

    this.headers = mixin(defaultHeaders, headers, {
        url: url
    });

    this.method = '';
};

Request.prototype._parseCookies = function () {
    // pass, remove later
};


var Response = this.FakeResponse = function (callback) {
    EventEmitter.apply(this);

    this.callback = callback;
    this.body = '';
};

require('util').inherits(Response, EventEmitter);

Response.prototype.writeHead = function (status, headers) {
    this.status = status;
    this.headers = headers;
};

Response.prototype.write = function (date) {
    this.body += data;
};

Response.prototype.end = function (data) {
    if (data) this.body += data;
    
    this.callback(this);
};

this.test = function (router, request, callback) {
    var response = new Response(callback);

    router.route(request, response);
};
