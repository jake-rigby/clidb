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
			redis.smembers(namespace+':clidb:classes',function(err,classkeys){ // <-- return a list of our custom class names
				var result = {}; // <-- we are going to collate all the data
				var m = redis.multi();
				for (var i=0; i<classkeys.length; i++) m.hgetall(namespace+':clidb:'+classkeys[i]);
				m.exec(function(err,replies){
					for (i=0; i<replies.length; i++) result[classkeys[i]] = replies[i];
					cb(err, result);				
				});
			});
		},

		getitem : function(classkey,itemkey,cb){
			redis.hget(namespace+':clidb:'+classkey,itemkey,function(err,item){
				cb(item ? err : 'no value', item); // <-- redis doesn't generate errors for null queries
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
				redis.sismember(namespace+':clidb:classes',classkey,function(err,is){
					if (!is) redis.sadd(namespace+':clidb:classes',classkey);
					redis.hset(namespace+':clidb:'+classkey,itemkey,JSON.stringify(item));
					cb(err, item);
				});
			} else {
				cb(tv4.error ? tv4.error : 'schema '+classkey+' not found', false);
				console.log(item, schema);
			}
		},

		getclass : function(classkey,cb) {
			redis.hgetall(namespace+':clidb:'+classkey,cb);
		},

		listclasses : function(classkey,cb) {
			redis.smembers(namespace+':clidb:classes',cb);
		},
		
		deleteitem : function(classkey,itemkey,cb) {
			redis.hlen(namespace+':clidb:'+classkey, function(err, len){
				//if (len < 2) return; // <-- NEED TO DELETE THE CLASS NAME FROM THE CLASS SET
				redis.hdel(namespace+':clidb:'+classkey, itemkey, cb); 
				// redis.hgetall(namespace+':clidb:'+classkey, cb); // <-- this updates the remote cache (clidb.class.. is a TODO)
			});
		},

		export : function(classkey, path, cb) {
			redis.hgetall(namespace+':clidb:'+classkey, function(err, result) {
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
		}
	}	
}
