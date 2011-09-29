
this.Exception = function (reply, params) {
    try {
        reply.pass(reply, params);
    } catch (exception) {
        var body = 'Exception: ' + exception.message + '\n' + exception.stack;
        reply.fail(body);
    }
};
