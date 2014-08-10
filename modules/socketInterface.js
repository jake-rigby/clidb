/**
 * @author Jake Rigby
 *
 * connect a remote client to the direct api via socket
 */
module.exports.connect = function(namespace, redis, socket) {

	var cli = require('./directInterface').connect(namespace, redis, socket); // <-- for every connection ??

	cli.getschemas(function(err, id, schema){
		socket.emit('clidb.schema',err,  id, schema);
		if (err) console.log(err); 
	})

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
			socket.emit('clidb.item', err, classkey, itemkey, result, qid);
			if (err) console.log(err);		
		});
	});

	socket.on('clidb.getitemprop',function(classkey, itemkey, path, qid) {
		cli.getitemprop(classkey, itemkey, path, function(err, result) {
			socket.emit('clidb.getitemprop', err, result, qid);
			if (err) console.log(err);		
		});
	});


	socket.on('clidb.setitem', function(classkey, itemkey, item, qid) {
		cli.setitem(classkey, itemkey, item, function(err, result) {
			socket.emit('clidb.setitem', err, classkey, itemkey, item, qid);
			if (err) console.log(err);
		});
	});

	socket.on('clidb.getclass',function(classkey, qid) {
		cli.getclass(classkey, function(err, value) {
			socket.emit('clidb.class', err, classkey, value, qid);
			if (err) console.log(err);	
		});
	});
	
	socket.on('clidb.deleteitem',function(classkey, itemkey, qid) {
		cli.deleteitem(classkey, itemkey, function(err, value) {
			socket.emit('clidb.deleteitem', err, Boolean(value), qid);
			//socket.emit('clidb.class', err, {classkey:classkey, value:value}, qid); // <-- this updates the cached class (clidb.class is a TODO)
			if (err) console.log(err);	
		});
	});

	socket.on('clidb.listclasses', function (qid) {
		cli.listclasses(function (err, result) {
			socket.emit('clidb.listclasses', err, result, qid);
			if (err) console.log(err);
		})
	});

	/**
	 * Exports are saved to disk in the child /exports of the parent folder
	 */
	socket.on('clidb.export', function(classkey, qid) {
		cli.export(classkey, './exports/'+classkey+'.json', function(err, result) {
			socket.emit('clidb.export', err, classkey, !err, qid);
			if (err) console.log(err);
		})
	});

}