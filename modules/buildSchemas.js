/**
 * @author Jake Rigby
 *
 * Build a redis transaction to add a bunch of json schemas to 
 * the db, hashed by a unique ns and their id
 */
var tv4 = require('tv4');

module.exports = function(namespace, redis, schemas, cb) {
	var m = redis.multi();
	for (var s in schemas) {
		var obj = schemas[s];
		if (!obj.id || !obj.$schema) continue;
		var id = obj.id.substring(1);
		//m.hset(namespace+':clidb:schema', id, JSON.stringify(obj));
		tv4.addSchema(obj);
		console.log('clidb [BUILDER] add schema --> ',id);
		//console.log(obj.definitions.episode ? obj.definitions.episode.properties.actions : obj);
	}
	m.exec(function(err,replies) {
		if (cb) cb(err, replies);
	});
}