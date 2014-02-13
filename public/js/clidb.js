'use-strict';

angular.module('clidb',[])

.factory('db', ['$rootScope', 'socket.io', '$http', function($rootScope, socketio, $http) {
	
	var service = { data: {} };

	service.classes = {};

	/**
	 * get an item without hitting the cache
	service.getRemote = function(cls, key) {
		socketio.emit('clidb.getitem', cls, keym,)
	}
	 */

	/**
	 * overwrite the json instance enumerated by @param key
	 * of type @param cls
	 */
	service.save = function(cls, key, instance) {
		try {
			var def =  tv4.getSchema(cls);
			if (!def) throw 'no schema for '+cls;
			if (tv4.validate(instance,def)) socketio.emit('clidb.setitem', cls, key, instance);
			else throw tv4.error;
			//service.data[cls][key] = instance; // <-- need token for unconfirmed deletes
		} catch(err) {
			console.log(err);
		}
	}

	/**
	 * delete the json instance enumerated by @param key
	 * of type @param cls
	 */
	service.dlt = function(cls, key) {
		socketio.emit('clidb.deleteitem', cls, key);
	}


	/**
	 * return the json instance enumerated by @param key
	 * of type @param cls without worying about looking in a cache
	 */
	service.get = function(cls, key) {
		return service.data[cls][key]
	}


	/**
	 * compose a tv4 method
	 */
	service.define = function(cls) {
		return tv4.getSchema(cls);
	}


	/**
	 * utility to create a minimal valid instance
	 * of the given schema
	 */
	service.stub = function(definition, cb) {
		var instance = resolve(definition),
			valid = tv4.validate(instance,definition);
		cb(tv4.error, tv4.error ? null : instance);
	}


	/**
	 * socket listeners
	 */

	$rootScope.$on('socket.io.connected',function(){
		socketio.emit('clidb.getschema');
		socketio.emit('clidb.getall');
	});


	socketio.on('clidb.schema',function(id, schema, qid){

		// add the root
		schema = JSON.parse(schema);
		tv4.addSchema(id, schema);

		// also add the definitions
		for (var def in schema.definitions) {
			tv4.addSchema(def,schema.definitions[def]);
		}
	});
	

	socketio.on('clidb.all',function(data){
		$rootScope.$apply(function(){
			service.data = {};
			for (var c in data) service.data[c] = parseJSONArray(data[c]);
		})
	});
	

	socketio.on('clidb.class',function(data){
		$rootScope.$apply(function(){
			service.data[data.classkey] = parseJSONArray(data.value);
		});
	});


	socketio.on('clidb.item',function(data, err, qid){
		$rootScope.$apply(function(){
			if (!service.data[data.classkey]) service.data[data.classkey] = {};
			service.data[data.classkey][data.itemkey] = data.value;
			if (qid) linkExpression(err, data, qid);
		}, true);
	});

	socketio.on('clidb.setitem', function(data, err, qid){
		$rootScope.$apply(function(){
			if (qid) linkExpression(err, data, qid);
		}, true);
	})

	/**
	 * evaluate a '|' delimied command expression
	 * tags the resulting command/query with a session-unique id
	 * callbacks are indexed via this id
	 */
	service.commands = [];
	
	var callbacks = {};

	service.eval = function(x, cb) {
		var id = String(service.commands.length);
		service.commands.push({cmd: x, idx: id});
		callbacks[id] = cb;
		var words = x.split('|');
		var op = api[words[0]];
		var schm = tv4.getSchema('api#'+words[0]);
		words[0] = 'clidb.' + words[0];
		if (op && tv4.validate(words.slice(1),schm)) {
			words.push(id);
			op.apply(service.eval, words.slice(1));
		} else {
			var err = schm ?
				tv4.error.message :
				'unknown command : '+ words[0];
			linkExpression(err, null, id);
		}
	}

	var api = {
		get : function(classkey, itemkey, qid) {
			socketio.emit('clidb.getitem', classkey, itemkey, qid);
		},
		dlt : function(classkey, itemkey, qid) {
			socketio.emit('clidb.deleteitem', classkey, itemkey, qid);
		},
		set : function(classkey, itemkey, value, qid) {
			socketio.emit('clidb.setitem', classkey, itemkey, value, qid);
		}
	}
	$http.get('schemas/api.json').then(function(result){
		tv4.addSchema('api',result.data);
	})


	function linkExpression(err, reply, id) {
		var idx = Number(id);
		service.commands[id].reply = reply;
		service.commands[id].err = err;
		if (callbacks[id]) {
			callbacks[id](err, reply);
			delete callbacks[id];
		}
	}


	/**
	 * helpers        
	 */

	function parseJSONArray(source){
		var result = {};
		for (var key in source) result[key] = JSON.parse(source[key]);
		return result;
	}

	/**
	 * create a minimal instance described by a schema
	 */
 	function resolve(s) {
 		if (!s) {
 			return null
 		} else if (s.type=='array'){
			return [];//[resolve(s.items)];
		} else if (s.type=='object'){
			var r = {};
			for (var p in s.properties){
				if (s.properties[p].type=='object') r[p] = resolve(s.properties[p]);
				else if (s.properties[p].type=='number') r[p] = 0;
				else if (s.properties[p].type=='array') r[p] = resolve(s.properties[p]);
				//else if schemas[s.properties[p].type] r[p] = resolve(schemas[s.properties[p].type]); // <-- search referenced schemas here
				else {r[p]='';}
			}
			return r
		} 
		else return 'example <'+s.type+'>';	
	}



	return service;

}])


.controller('clidb.ConsoleController',['$scope', 'db', function($scope, db) {

	var idx = 0;

	$scope.submit = function(entry){
		db.eval(entry, function(err, result) {
			console.log(entry, '-->', err, result);
		});
		$scope.cmd = null;
		idx = $scope.commands.length;
	}

	/**
	 * use  ng-keydown="inpKeyDown($event.keyCode)"
	 */
	$scope.inpKeyDown = function(keyCode){
		if (keyCode==38 && idx == $scope.commands.length - 1) {
			$scope.cmd = ''; idx = $scope.commands.length;
		} else if (keyCode==38 && idx < $scope.commands.length - 1) {
			$scope.cmd = $scope.commands[++idx].cmd;
		} else if (keyCode==40 && idx > 0) {
			$scope.cmd = $scope.commands[--idx].cmd;
		}
	}

	$scope.$watch(function(){
		return db.commands;
	},function(commands){
		$scope.commands = commands;
	});


}])

