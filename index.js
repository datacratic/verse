/* TODO:
   - route to functions
   - functions can return json
   - functions can parse json
   - functions can stream
   - function can POST GET ETC
   - fallback gto a generic error handler
   - reply.send, reply.fail, reply(Buffer, 'binary')
        - all that good stuff
        - reply.render(someTemplate)
        - map.serving('/some file :D');
*/

var sys = require('sys'),
    url = require('url'),
    querystring = require('querystring');

var cookie = require('./vendor/cookie');
    cookie.secret = 'somesecret';

var static = require('node-static'),
    formidable = require('formidable');

var file = new(static.Server)('./frontend/static', { cache: 0 });

// ####################################################

var normalizePath =  function () {
    // URL are usually fucked
    // could include '^/' or '$/'
    // could be a string or a regex

    var paths = Array.prototype.slice.apply(arguments);
    paths = paths.map(function (path) {
        return path.replace(/(^\/|\/$)/g, ''); //remove any slashes
    });

    return paths.join('/');
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

var defaultHeaders = {'content-type': 'text/plain'};

Reply.prototype._send = function (status, body, headers) {
    headers = mixin(defaultHeaders, headers, {'content-length': body.length});
    this.response.writeHead(status, headers);
    this.response.end(body+ '\n');
};

Reply.prototype.cookie = function (key, value) {
    var inTenYears = new(Date)().getTime() + 315360000000;
    this.response.setCookie(key, value, {host: this.host, expires: inItenYears, path: '/'});
};

Reply.prototype.json = function (obj) {
    this._send(200, JSON.stringify(obj), {'content-type': 'text/json'});
};

Reply.prototype.send = function (txt) {
    this._send(200, txt, {});
};

Reply.prototype.html = function (html) {
    this._send(200, html, {'content-type': 'text/html'});
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
var Router = function () {
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
    headers.url = request.url;

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
        form.on('error', function () { console.log('ERROR:'); console.log(arguments) });
        form.parse(request, function(err, fields, files) {
            if (err) throw err;
            params = mixin(params, fields, files);
            route.handler(reply, params, params);
        });
    } else {
        try {
            require('sys').debug('routing');
            route.handler.apply(this, [reply, params, request.headers]);
        } catch (e) {
            console.log('EXCEPTION!: ' + e);
            that.exceptionHandler(request, response, e);
        }
    }
};

var Route = function (path) {
    this.path = path;
}

Route.prototype.match = function (request) {
    var path = url.parse(request.url).pathname;
    return this.path.test(path);
}

Route.prototype.bind = function (handler) {
    this.handler = handler;
};

this.Router = Router;
