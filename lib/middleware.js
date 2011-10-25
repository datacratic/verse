
this.Exception = function (reply, params) {
    try {
        reply.pass(reply, params);
    } catch (exception) {
        var body = 'Exception: ' + exception.message + '\n' + exception.stack;
        reply.fail(body);
    }
};

var formidable = require('formidable');

this.Form = function (reply, params) {
    var form = new(formidable.IncomingForm)();
    form.keepExtensions = true;
    form.on('error', function () { console.log('FORM ERROR:'); console.log(arguments) });
    form.parse(request, function(err, fields, files) {
        if (err) throw err;
        params.post = mixin(fields, files);
        route.handler(reply, params, params);
    });
};
