module.exports.connect = function(namespace, redis, socket) {

	var cli = require('./clidb-direct');

	socket.on('clidb.getschema', function(id, qid) {
		cli.getitem(id, function(err, id, schema){
			socket.emit('clidb.schema', id, schema, err, qid);
			if (err) console.log(err); 
		});
	});

	socket.on('clidb.getall', function(qid) {
		cli.getall(function(err, result) {
			socekt.emit('clidb.getall', result, err, qid);
			if (err) console.log(err); 
		});
	});

	socket.on('clidb.getitem',function(classkey, itemkey, qid) {
		cli.getitem(classkey, itemkey, function(err, result) {
			socekt.emit('clidb.item', {classkey:classkey, itemkey:itemkey, value:result}, err, qid);
			if (err) console.log(err);		
		});
	});

	socket.on('clidb.setitem', function(classkey, itemkey, item, qid) {
		cli.setitem(classkey, itemkey, item, function(err, result) {
			socket.emit('clidb.setitem', err == false, err, qid);
			if (err) console.log(err);
		});
	});

	socket.on('clidb.getclass',function(classkey, qid) {
		cli.getclass(classkey, function classCallback(classkey, value, err) {
			socket.emit('clidb.class',{classkey:classkey, value:value}, err, qid);
			if (err) console.log(err);	
		});
	});
	
	socket.on('clidb.deleteitem',function(classkey, itemkey, qid) {
		cli.deleteitem(classkey, itemkey, function classCallback(classkey, value, err) {
			socket.emit('clidb.class',{classkey:classkey, value:value}, err, qid);
			if (err) console.log(err);	
		});
	});

}