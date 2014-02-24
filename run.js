/**
 * @author Jake Rigby
 *
 * A direct api to the clidb module
 */
var redis = require('redis').createClient(6379, '127.0.0.1', {no_ready_check: true});
require('./modules/server')(require('express')(), 'clidb-test', redis, 808, './appdata-test.json');