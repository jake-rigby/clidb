
var tv4 = require('tv4');

module.exports = function(namespace, redis, schemas, cb) {
	var m = redis.multi();
	for (var s in schemas) {
		var obj = schemas[s];
		if (!obj.id || !obj.$schema) continue;
		var id = obj.id.substring(1);
		m.hset(namespace+':clidb:schema', id, JSON.stringify(obj));
		//tv4.addSchema(id, obj);
		tv4.addSchema(obj);
		console.log('clidb [BUILDER] add schema --> ',id);
	}
	m.exec(function(err,replies) {
		if (cb) cb();
	});
}