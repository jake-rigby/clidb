/**
 * @author Jake Rigby
 *
 * A direct api to the clidb module
 */


// deps
var tv4 = require('tv4');
var fs = require('fs');

function parseJSONArray(source) {
	
	var result = {};
	for (var key in source) result[key] = JSON.parse(source[key]);
	return result;
}


// api
module.exports.connect = function(namespace, redis) {
	
	return {

		getschemas : function(cb) {
			var id, s;
			var uris = tv4.getSchemaUris();
			for (var i in uris) {
				id = uris[i];
				s = tv4.getSchema(id);
				cb(s ? null : 'schema ' + id + ' not registered', id, s);
			}
		},
		
		getschema : function(id, cb) {
			var s = tv4.getSchema('#'+id);
			cb(s ? null : 'schema ' + id + ' not registered', id, s);
		},

		getall : function(cb) {
			redis.smembers(namespace+':classes',function(err,classkeys){ // <-- return a list of our custom class names
				var result = {}; // <-- we are going to collate all the data
				var m = redis.multi();
				for (var i=0; i<classkeys.length; i++) m.hgetall(namespace+':'+classkeys[i]);
				m.exec(function(err,replies){
					for (i=0; i<replies.length; i++) result[classkeys[i]] = replies[i];
					cb(err, result);				
				});
			});
		},

		getitem : function(classkey,itemkey,cb){
			redis.hget(namespace+':'+classkey,itemkey,function(err,item){
				cb(item ? err : 'no value', item); // <-- redis doesn't generate errors for null queries
			});
		},

		getitemprop : function(classkey, itemkey, path, cb) {
			redis.hget(namespace+':'+classkey,itemkey,function(err,item){
				item = JSON.parse(item);
				if (err) cb(err, null);
				var loc = path.split('.'),
					p = item;
				while(loc.length && p) p = item[loc.shift()];
				cb(p ? err : 'no value', p); // <-- redis doesn't generate errors for null queries
			});

		},

		/*
		 * store @param value in the database
		 * if the class identifies a recognised schema, validate the value by that
		 * if the class is unknown, store the value as a primitive type (the remote client can decide)
		 * only don't add if we have a schema and its not valid
		 */ 
		setitem : function(classkey, itemkey, item, cb){
			var schema = tv4.getSchema('#'+classkey);
			if ((schema && tv4.validate(item, schema)) || !schema) {
				redis.sismember(namespace+':classes',classkey,function(err,is){
					if (!is) redis.sadd(namespace+':classes',classkey);
					redis.hset(namespace+':'+classkey,itemkey,JSON.stringify(item));
					cb(err, item);
				});
			} else {
				cb(tv4.error ? tv4.error : 'schema '+classkey+' not found', false);
			}
		},

		getclass : function(classkey,cb) {
			redis.hgetall(namespace+':'+classkey,cb);
		},

		listclasses : function(classkey,cb) {
			redis.smembers(namespace+':classes',cb);
		},
		
		deleteitem : function(classkey,itemkey,cb) {
			redis.hlen(namespace+':'+classkey, function(err, len){
				//if (len < 2) return; // <-- NEED TO DELETE THE CLASS NAME FROM THE CLASS SET
				redis.hdel(namespace+':'+classkey, itemkey, cb); 
				// redis.hgetall(namespace+':'+classkey, cb); // <-- this updates the remote cache (clidb.class.. is a TODO)
			});
		},

		export : function(classkey, path, cb) {
			redis.hgetall(namespace+':'+classkey, function(err, result) {
				if (!err) {
					console.log(result);
					fs.writeFile(path, JSON.stringify(parseJSONArray(result), undefined, 4), function(err) {
						if (cb) cb(err, err ? false : true);
					}) 
				} else if (cb) {
					cb(err);
				}
			});
		},

		import : function(classkey, path, cb) {
			fs.readFile(path, 'utf8', function(err, result) {
				console.log('[CLIDB-DIRECT] import', result);
			})
		},

		new : function(classkey, cb) {
			var schm = tv4.getSchema(classkey);
			if (!schm) return cb('unable to find definition '+classkey, null);
			var instance = create(schm);
			if (!instance) return cb('error generating new  '+classkey, null);
			cb(null, instance);
		}

	}

 	function create(s) {

 		if (!s) return null
 		else if (s.type=='array') return [];//return [create(s.items)];
		else if (s.type=='object'){
			var r = {};
			for (var p in s.properties){
				
				if (s.properties[p].type=='object') r[p] = create(s.properties[p]);
				else if (s.properties[p].type=='number') r[p] = 0;
				else if (s.properties[p].type=='array') r[p] = create(s.properties[p]);
				else if (s.properties[p].type=='string') r[p]= '-';
				else if (s.properties[p].$ref && tv4.getSchema(s.properties[p].$ref)) r[p] = create(tv4.getSchema(s.properties[p].$ref));
				else r[p] = 'unknown : '+p;
				//else if schemas[s.properties[p].type] r[p] = create(schemas[s.properties[p].type]); // <-- search referenced schemas here
			}
			return r
		} 
		else return '--';	
	}

}
