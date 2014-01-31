module.exports.connect = function(namespace, redis, socket) {

	socket.on('clidb.getschema', function(id) {
		/*
		if (!id) id = 'root';
		redis.hget(namespace+':clidb:schema', id, function(err,schema) {
			socket.emit('clidb.schema',schema);
		});
		*/
		if (!id) redis.hgetall(namespace+':clidb:schema',function(err, schemas) {
			for (var key in schemas) {
				socket.emit('clidb.schema', key, schemas[key]);
			}
		});
		else redis.hget(namespace+':clidb:schema', id, function(err, schema) {
			socket.emit('clidb.schema', id, schema);
		});

	});

	socket.on('clidb.setschema', function() {
		// TODO change the schema, and collate all 'dangling' keys
	});

	socket.on('clidb.getall', function() {
		redis.smembers(namespace+':clidb:classes',function(err,classkeys){ // <-- return a list of our custom class names
			var result = {}; // <-- we are going to collate all the data
			var m = redis.multi();
			for (var i=0; i<classkeys.length; i++) m.hgetall(namespace+':clidb:'+classkeys[i]);
			m.exec(function(err,replies){
				for (i=0; i<replies.length; i++) result[classkeys[i]] = replies[i];
				socket.emit('clidb.all',result);				
			});
		});
	});

	socket.on('clidb.getitem',function(classkey,itemkey){
		redis.hget(namespace+':clidb:'+classkey,itemkey,function(err,item){
			socket.emit('clidb.item',{classkey:classkey,itemkey:itemkey,value:item});
		});
	});

	socket.on('clidb.setitem', function(classkey,itemkey,item){
		// TODO restricted words 'classes', 'schema'
		redis.sismember(namespace+':clidb:classes',classkey,function(err,is){
			if (!is) redis.sadd(namespace+':clidb:classes',classkey);
			redis.hset(namespace+':clidb:'+classkey,itemkey,JSON.stringify(item));
			socket.emit('clidb.item',{classkey:classkey,itemkey:itemkey,value:item});
		});
	});

	socket.on('clidb.getclass',function(classkey){
		redis.hgetall(namespace+':clidb:'+classkey,function(err,cls){
			socket.emit('clidb.class',{classkey:classkey,value:cls});
		});
	});
	
	/**
	 * write the schema into the fs
	 * copy the file to the web folder
	socket.on('clidb.setclass',function(classkey,descriptor){
		// requires schema change - need to validate the descriptor
		redis.get(namespace,'clidb:schema',function(err,schema){
			schema[classkey] = descriptor;
			redis.hset(namespace,'clidb:schema',schema);
			socket.emit('clidb.schema',{schema:schema});
		});
	});
	*/
	
	socket.on('clidb.deleteitem',function(classkey,itemkey){
		redis.hlen(namespace+':clidb:'+classkey,function(err,len){
			if (len < 2) return;
			redis.hdel(namespace+':clidb:'+classkey,itemkey);
			redis.hgetall(namespace+':clidb:'+classkey,function(err,cls){
				console.log(cls);
				socket.emit('clidb.class',{classkey:classkey,value:cls});
			});
		});
	});
	/*
	socket.on('clidb.commit',function(){
		api.compile(function(err,data){
			require('fs').writeFile(dataPath+'.json',JSON.stringify(data));
		});
	});
	*/	
}