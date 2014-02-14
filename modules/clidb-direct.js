
// deps
var tv4 = require('tv4');

// api
module.exports.connect = function(namespace, redis, socket) {
	
	return {
		
		getschema : function(id, cb) {
			if (!id) redis.hgetall(namespace+':clidb:schema',function(err, schemas) {
				for (var key in schemas) {
					cb(err, key, schemas[key]);
				}
			});
			else redis.hget(namespace+':clidb:schema', id, function(err, schema) {
				cb(err, id, schema);
			});

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
				cb(item ? err : 'no value', item);
			});
		},

		/*
		 * store @param value in the database
		 * if the class identifies a recognised schema, validate the value by that
		 * if the class is unknown, store the value as a primitive type (the remote client can decide)
		 */ 
		setitem : function(classkey, itemkey, item, cb){
			var schema = tv4.getSchema('#'+classkey);
			if ((schema && tv4.validate(item, schema)) || !schema) { //<-- only don't add if we have a schema and its not valid
				redis.sismember(namespace+':clidb:classes',classkey,function(err,is){
					if (!is) redis.sadd(namespace+':clidb:classes',classkey);
					redis.hset(namespace+':clidb:'+classkey,itemkey,JSON.stringify(item));
					cb(err, item);
				});
			} else {
				cb(item+' does not validate '+schema.id, false);
			}
		},

		getclass : function(classkey,cb) {
			redis.hgetall(namespace+':clidb:'+classkey,cb);
		},

		listclasses : function(classkey,cb) {
			redis.smembers(namespace+':clidb:classes',cb);
		},
		
		deleteitem : function(classkey,itemkey,cb){
			redis.hlen(namespace+':clidb:'+classkey, function(err, len){
				//if (len < 2) return; // <-- NEED TO DELETE THE CLASS NAME FROM THE CLASS SET
				redis.hdel(namespace+':clidb:'+classkey, itemkey, cb); 
				// redis.hgetall(namespace+':clidb:'+classkey, cb); // <-- this updates the remote cache (clidb.class.. is a TODO)
			});
		}
		/*,
		socket.on('clidb.commit',function(){
			api.compile(function(err,data){
				require('fs').writeFile(dataPath+'.json',JSON.stringify(data));
			});
		});
		*/
	}	
}
