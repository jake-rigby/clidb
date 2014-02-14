module.exports.connect = function(namespace, redis, socket) {

	var cli = require('./clidb-direct').connect(namespace, redis, socket);
	//console.log(cli.getitem);
	//return;


	socket.on('clidb.getschema', function(id, qid) {
		cli.getschema(id, function(err, id, schema){
			socket.emit('clidb.schema',err,  id, schema, qid);
			if (err) console.log(err); 
		});
	});

	socket.on('clidb.getall', function(qid) {
		cli.getall(function(err, result) {
			socket.emit('clidb.getall',err,  result, qid);
			if (err) console.log(err); 
		});
	});

	socket.on('clidb.getitem',function(classkey, itemkey, qid) {
		cli.getitem(classkey, itemkey, function(err, result) {
			socket.emit('clidb.item', err, result, qid);
			if (err) console.log(err);		
		});
	});

	socket.on('clidb.setitem', function(classkey, itemkey, item, qid) {
		cli.setitem(classkey, itemkey, item, function(err, result) {
			socket.emit('clidb.setitem', err, Boolean(result), qid);
			if (err) console.log(err);
		});
	});

	socket.on('clidb.getclass',function(classkey, qid) {
		cli.getclass(classkey, function(classkey, value, err) {
			socket.emit('clidb.class', err,{classkey:classkey, value:value}, qid);
			if (err) console.log(err);	
		});
	});
	
	socket.on('clidb.deleteitem',function(classkey, itemkey, qid) {
		cli.deleteitem(classkey, itemkey, function(err, value) {
			console.log(err, value);
			socket.emit('clidb.deleteitem', err, Boolean(value), qid);
			//socket.emit('clidb.class', err, {classkey:classkey, value:value}, qid); // <-- this updates the cached class (clidb.class is a TODO)
			if (err) console.log(err);	
		});
	});

}