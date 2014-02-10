module.exports.connect = function(namespace, redis, socket) {

	var cli = require('./clidb-direct');

	socket.on('clidb.getschema', function(id) {
		cli.getitem(id, function(err, id, schema){
			socket.emit('clidb.schema', id, schema, err);
			if (err) console.log(err); 
		});
	});

	socket.on('clidb.getall', function() {
		cli.getall(function(err, result) {
			socekt.emit('clidb.getall', result, err);
			if (err) console.log(err); 
		});
	});

	socket.on('clidb.getitem',function(classkey,itemkey){
		cli.getitem(classkey, itemkey, function(err, result) {
			socekt.emit('clidb.item', {classkey:classkey, itemkey:itemkey, value:result}, err);
			if (err) console.log(err);		
		});
	});

	socket.on('clidb.setitem', function(classkey,itemkey,item){
		cli.setitem(classkey, itemkey, item, function(err, result) {
			if (err) console.log(err);
		}
	});

	socket.on('clidb.getclass',function(classkey){
		cli.getclass(classkey, classCallback);
	});
	
	socket.on('clidb.deleteitem',function(classkey,itemkey){
		cli.deleteitem(classkey, itemkey, classCallback)
	});

	function classCallback(classkey, value, err) {
		socket.emit('clidb.class',{classkey:classkey, value:value}, err);
		if (err) console.log(err);	
	}

	function itemCallback(classkey, itemkey, value, err) {
		socekt.emit('clidb.item', {classkey:classkey, itemkey:itemkey, value:value}, err);
		if (err) console.log(err);				
	}
}