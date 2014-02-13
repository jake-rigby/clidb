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
				cb(err, item);
			});
		},

		setitem : function(classkey,itemkey,item,cb){
			// TODO restricted words 'classes', 'schema'
			redis.sismember(namespace+':clidb:classes',classkey,function(err,is){
				if (!is) redis.sadd(namespace+':clidb:classes',classkey);
				redis.hset(namespace+':clidb:'+classkey,itemkey,JSON.stringify(item));
				cb(err, item);
			});
		},

		getclass : function(classkey,cb){
			redis.hgetall(namespace+':clidb:'+classkey,function(err,cls){
				cb(cls);
			});
		},
		
		deleteitem : function(classkey,itemkey,cb){
			redis.hlen(namespace+':clidb:'+classkey,function(err,len){
				if (len < 2) return;
				redis.hdel(namespace+':clidb:'+classkey,itemkey);
				redis.hgetall(namespace+':clidb:'+classkey,function(err,cls){
					cb(cls);
				});
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
