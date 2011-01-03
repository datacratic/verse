var sys = require('sys'),
    url = require('url'),
    querystring = require('querystring');

var cookie = require('./vendor/cookie');
    cookie.secret = 'somesecret';

var static = require('node-static'),
    formidable = require('formidable');

var file = new(static.Server)('./static', { cache: 0 });

// ####################################################

var normalizePath =  function (path) {
    // URL are usually fucked
    // could include '^/' or '$/'
    // could be a string or a regex
    path = path.replace(/(^\/|\/$)/g, ''); //remove start and end slashe
    path = path.replace(/\/\/+/g, '/');    //remove double slashes

    return path;
};

function mixin() {
    var args = Array.prototype.slice.apply(arguments);
    var target = args.pop();
    args.forEach(function (other) {
        Object.keys(other).forEach(function (key) {
            target[key] = other[key];
        });
    });

    return target;
}

// ####################################################

var Reply = function (response) {
    this.response = response;
};

var defaultHeaders = {'Content-Type': 'text/plain'};

Reply.prototype._send = function (status, body, headers) {
    headers = mixin(defaultHeaders, headers, {'Content-Length': body.length});
    this.response.writeHead(status, headers);
    this.response.end(body+ '\n');
};

Reply.prototype.cookie = function (key, value) {
    var inTenYears = new(Date)().getTime() + 315360000000;
    this.response.setCookie(key, value, {host: this.host, expires: inTenYears, path: '/'});
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

Reply.prototype.serve = function (filePath) {
    file.serveFile(filePath, 200, {}, {'method': 'GET', headers: {}}, this.response);
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

Router.prototype.route = function (request, response) {
    var that = this;
   // parse request
    var params = querystring.parse(url.parse(request.url).query);
    var headers = request.headers;
    headers.request_url = request.url;
    headers.remote_ip   = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.socket.remoteAddress;

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

    var reply = new(Reply)(response);

    //Post params
    if (request.method === 'POST') {
        var form = new(formidable.IncomingForm)();
        form.keepExtensions = true;
        form.on('error', function () { console.log('FORM ERROR:'); console.log(arguments) });
        form.parse(request, function(err, fields, files) {
            if (err) throw err;
            params = mixin(params, fields, files);
            route.handler(reply, params, params);
        });
    } else {
        try {
            route.handler.apply(this, [reply, params, headers, request._parseCookies()]);
        } catch (e) {
            console.log('ACTION EXCEPTION!: ' + e);
            console.log(e.stack);
            that.exceptionHandler(request, response, e);
        }
    }
};

var Route = function (path) {
    this.path = path;
}

Route.prototype.match = function (request) {
    var path = normalizePath(url.parse(request.url).pathname);
    return this.path.test(path);
}

Route.prototype.bind = function (handler) {
    this.handler = handler;
};

this.Router = Router;
