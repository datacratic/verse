var sys = require('sys'),
    http = require('http'),
    url = require('url'),
    querystring = require('querystring');

var static = require('node-static'),
    cookies = require('./lib/cookies');

var file = new(static.Server)('./static', { cache: 0 });

// XXX: todo => middleware out static file serving and form parsing

// ####################################################

var normalizePath =  function (path) {
    // URL are usually fucked
    // could include '^/' or '$/'
    // could be a string or a regex

    path = path.replace(/(^\/|\/$)/g, ''); //remove start and end slashe
    path = path.replace(/\/\/+/g, '/');    //remove double slashes

    return path;
};

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

// ####################################################

var Reply = function (response, stack) {
    this.stack = Array.prototype.concat.apply([], stack);
    this.headers = {};
    this.filters = [];

    this.response = response;
};

// Proxy methods
Reply.prototype.on = function () {
    this.response.on.apply(this.response, arguments);
};

Reply.prototype.emit = function () {
    this.response.emit.apply(this.response, arguments);
};

Reply.prototype.removeListener = function () {
    this.response.removeListener.apply(this.response, arguments);
};

Reply.prototype.end = function () {
    this.response.end.apply(this.response, arguments);
};

Reply.prototype.write = function () {
    this.response.write.apply(this.response, arguments);
};

Reply.prototype.writeHead = function () {
    this.response.writeHead.apply(this.response, arguments);
};

Reply.prototype.getHeader = function () {
    this.response.getHeader.apply(this.response, arguments);
};

Reply.prototype.setHeader = function () {
    this.response.setHeader.apply(this.response, arguments);
};

Reply.prototype.reply = function (status, body, headers) {
    if (!body || body.length == 0) throw new(Error)('trying to write empty body');
    headers = mixin(this.headers, headers, {'Content-Length': body.length});

    var that = this;
    this.filters.forEach(function (filter) {
        filter.apply(this, [body]);
    });

    this.writeHead(status, headers);
    this.end(body);
};

// Replace with setHeader

Reply.prototype.addHeaders = function (headers) {
    this.headers = headers;
};

Reply.prototype.pass = function (reply, params) {
    var next = this.stack.shift();

    if (!next) {
        throw new(Error)('Called pass with nowehre to go');
    } else {
        next(reply, params);
    }
};


// This only works once

Reply.prototype.cookie = function (key, value, options) {
    var inTenYears = new Date(new(Date)().getTime() + 315360000000);
    var cookie = cookies.serializeCookie(key, value, {host: this.host, expires: inTenYears, path: '/'});

    if (this.getHeader('Set-Cookie')) throw new(Error)('you can only cookie once, for now');

    this.setHeader('Set-Cookie', cookie);
};

Reply.prototype.json = function (obj) {
    this.reply(200, JSON.stringify(obj), {'Content-Type': 'text/json'});
};

Reply.prototype.send = function (txt) {
    this.reply(200, txt, {});
};

Reply.prototype.html = function (html) {
    this.reply(200, html, {'Content-Type': 'text/html'});
};

Reply.prototype.fail = function (problem) {
    this.reply(500, problem, {});
};

Reply.prototype.serve = function (filePath, headers) {
    var _headers = mixin(this.headers, headers);
    file.serveFile(filePath, 200, _headers, {'method': 'GET', headers: {}}, this.response);
};

Reply.prototype.filter = function (func) {
    this.filters.push(func);
};

var Params = function (request) {
    http.ClientRequest.apply(this, [{}]);
    this.get = querystring.parse(url.parse(request.url).query);

    if (request.headers.cookie) {
        this.cookies = cookies.parseCookie(request.headers.cookie);
    } else {
        this.cookies = {};
    }

    this.remote_ip = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.socket.remoteAddress;
};

Params.prototype.__proto__ = http.ClientRequest.prototype;

// ####################################################

var url = require('url');

var Router = function (baseDir) {
    this.routes = [];
    this.notFoundHandler = function (request, response) {
        var body = 'not found';
        response.writeHead(404, {'content-type': 'text/plain', 'content-length': body.length});
        response.end(body);
    };
};

Router.prototype.map = function (path) {
    var route = new(Route)(path, this);
    this.routes.push(route);
    return route;
};

Router.prototype.route = function (request, response) {
    var that = this;

    // Find route
    var route = (function (request) {
        for (var i=0; i < that.routes.length; i++) {
            if (that.routes[i].match(request)) {
                return that.routes[i];
            }
        }
        return false;
    })(request);

    if (!route) {
        return this.notFoundHandler(request, response);
    }

    // Generate reply and params object that wrap response and request
    var reply = new(Reply)(response, route.handler.stack);

    var params = new(Params)(request);

    params.__proto__ = request;
    request.__proto__ = Params.prototype;

    route.handler.apply(this, [reply, params]);
};

var Action = this.Action = function (/*HandlerA, HandlerB, function () {} */) {
    var stack = Array.prototype.concat.apply([], arguments);

    var target = stack.shift();
    this.stack = stack;
    this.target = target;
};

Action.prototype.apply = function (that, args) {
    return this.target.apply(that, args);
};

var ActionClass = this.ActionClass = function () {
    var klassStack = Array.prototype.concat.apply([], arguments);

    return function () {
        var stack = Array.prototype.concat.apply(klassStack, arguments);
        return new(Action)(stack);
    }
};

var Route = function (path) {
    this.path = path;
};

Route.prototype.match = function (request) {
    var path = normalizePath(url.parse(request.url).pathname);
    return this.path.test(path);
};

Route.prototype.bind = function (handler) {
    this.handler = handler;
};

this.Router = Router;
