var sys = require('sys'),
    url = require('url'),
    querystring = require('querystring');

var static = require('node-static'),
    formidable = require('formidable'),
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
    this.response = response;
    this.stack = stack;
    this.headers = {};
};

Reply.prototype._send = function (status, body, headers) {
    headers = mixin(this.headers, headers, {'Content-Length': body.length});

    this.response.writeHead(status, headers);
    this.response.end(body);
};

Reply.prototype.writeHead = function (status, headers) {
    this.response.writeHead(status, headers);
};

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

    if (this.headers['Set-Cookie']) throw new(Error)('you can only cookie once, for now');

    this.headers['Set-Cookie'] = cookie;
};

Reply.prototype.json = function (obj) {
    this._send(200, JSON.stringify(obj), {'Content-Type': 'text/json'});
};

Reply.prototype.send = function (txt) {
    this._send(200, txt, {});
};

Reply.prototype.html = function (html) {
    this._send(200, html, {'Content-Type': 'text/html'});
};

Reply.prototype.fail = function (problem) {
    this._send(500, problem, {});
};

Reply.prototype.serve = function (filePath, headers) {
    var _headers = mixin(this.headers, headers);
    file.serveFile(filePath, 200, _headers, {'method': 'GET', headers: {}}, this.response);
};

// ####################################################

var url = require('url');
var querystring = require('querystring');
var Router = function (baseDir) {
    this.routes = [];
    this.notFoundHandler = function (request, response) {
        var body = 'not found';
        response.writeHead(404, {'content-type': 'text/plain', 'content-length': body.length});
        response.end(body);
    };

    this.exceptionHandler = function (request, response, exception) {
        var body = 'Exception: ' + exception.message + '\n' + exception.stack;
        response.writeHead(500, {'content-type': 'text/plain', 'content-length': body.length});
        response.end(body);
    };
};

Router.prototype.map = function (path) {
    var route = new(Route)(path, this);
    this.routes.push(route);
    return route;
};

Router.prototype.notFound = function (notFoundHandler) {
    this.notFoundHandler = notFoundHandler;
};

// split this up into middleware
Router.prototype.route = function (request, response) {
    var that = this;
    var params = {};
    params.get = querystring.parse(url.parse(request.url).query);
    params.headers = request.headers;

    params.headers.request_url = request.url;
    params.url = request.url;
    params.remote_ip   = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.socket.remoteAddress;

    // Cookies
    params.cookies = cookies.parseCookie(request.headers.cookie);

    var route = (function (request) {
        for (var i=0; i < that.routes.length; i++) {
            if (that.routes[i].match(request)) {
                return that.routes[i];
            }
        }
        return false;
    })(request);

    if (!route) {
        that.notFoundHandler(request, response);
        return
    }

    var reply = new(Reply)(response, route.handler.stack);

    // XXX: This should be middleware
    //Post params
    if (request.method === 'POST') {
        var form = new(formidable.IncomingForm)();
        form.keepExtensions = true;
        form.on('error', function () { console.log('FORM ERROR:'); console.log(arguments) });
        form.parse(request, function(err, fields, files) {
            if (err) throw err;
            params.post = mixin(fields, files);
            route.handler(reply, params, params);
        });
    } else {
        try {
            route.handler.call.apply(this, [reply, params]);
        } catch (e) {
            // XXX: This sucks, could be middleware
            console.log('ACTION EXCEPTION!: ' + e);
            console.log(e.stack);
            that.exceptionHandler(request, response, e);
        }
    }
};

var Action = function (/*HandlerA, HandlerB, function () {} */) {
    var stack = Array.prototype.concat.apply([], arguments);

    var target = stack.shift();
    this.stack = stack;
    this.call = target;
};

this.Action = Action;

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
