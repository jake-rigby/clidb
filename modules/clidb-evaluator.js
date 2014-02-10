
/**
 * Evaluate an expression string. An expression queries a dot seperated 
 * path within an instance of a class. Supports nested expressions within {}
 * to a depth of one. @
 * 
 */
module.exports.connect = function(namespace,redis,socket){

	socket.on('evaluate',function(expression,token){
		get(expression,function(err,result){
			console.log('evaluator ',expression, result);
			socket.emit('evaluate.result',result,err,token);
		})
	})

	function get(z,cb){
		function _get(x,cb){
			var k = x[0],
				loc = x.substring(1).split('.');
			var extend = function(err,result){
				result = JSON.parse(result);
				while(loc.length && result) result = result[loc.shift()];
				cb(err,result); }
			if (k=='@') redis.hget(namespace+':clidb:'+loc.shift(),loc.shift(),extend);
			else cb(null,x);
		}
		var s = z.match(/\{([^\)]+)\}/);
		if (s) {
			_get(s[1],function(err,r){
				z = z.replace(s[0],r);
				_get(z,cb);
			});
		} else _get(z,cb);
	}

	return get;
};