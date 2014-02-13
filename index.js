//module.exports.client = require('./modules/appdata.js');
module.exports.build = require('./modules/clidb-builder');
//module.exports.socketlisteners = require('./modules/clidb-socketlisteners'); // namespace, redis, socket
module.exports.socket = require('./modules/clidb-socket');
module.exports.client = require('./modules/clidb-direct');
//module.exports.evaluator = require('./modules/clidb-evaluator');
module.exports.provideContent = require('./modules/content-provider');