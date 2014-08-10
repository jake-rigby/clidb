var fs = require('fs'),
	path = require('path'),
	tv4 = require('tv4');

module.exports = function(namespace, redis) {

	var api = {

		file : function (filePath) {

			try {
				if (path.extname(filePath) != '.json') throw 'The class file should be JSON'

				var schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
				tv4.addSchema(schema);
				//redis.hset(namespace+':clidb:schema', id, JSON.stringify(schema));
				console.log('[CLIDB BUILD_SCHEMA] schema added', schema.id);

			} catch (e) {

				console.log('[CLIDB ERROR] importClass', e);
			}	
		},

		directory : function(dirpath) {

			var files = fs.readdirSync(dirpath);

			for (var f in files) {

				this.file(path.join(dirpath,files[f]));
			}
		}
	}

	return api;
}