//module.exports.client = require('./modules/appdata.js');
module.exports.build = require('./modules/clidb-builder');
module.exports.socketlisteners = require('./modules/clidb-socketlisteners'); // namespace, redis, socket
module.exports.client = require('./modules/clidb-direct');
//module.exports.evaluator = require('./modules/evaluator');
module.exports.provideContent = require('./modules/content-provider');