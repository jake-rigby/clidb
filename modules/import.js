var fs = require('fs'),
	path = require('path');

module.exports = function(namespace, redis) {

	var api = {

		file : function (filePath) {

			try {
				if (path.extname(filePath) != '.json') throw 'The class file should be JSON'

				// remove the path and extension and read in synchronously
				var filename = path.basename(filePath),
					classname = filename.split('.').slice(0,-1).join('.'),
					result = JSON.parse(fs.readFileSync(filePath, 'utf8'));

				// add the name to the set of class names
				redis.sadd(namespace+':classes', classname);
				
				for (var key in result) {
					redis.hset(namespace+':'+classname, key, JSON.stringify(result[key]), function(err, result) {
						if (err) throw err;
						console.log('[CLIDB IMPORT] file', classname, key);
					})
				}
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