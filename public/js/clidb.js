'use-strict';

angular.module('clidb',[])

.factory('db', ['$rootScope', 'socket.io', '$http', function($rootScope, socketio, $http) {
	
	// cache
	var service = { data: {} };

	// load local api schema to validate command strings
	$http.get('schemas/api.json').then(function(result){
		tv4.addSchema('api',result.data);
	})

	service.api = {

		getc : function(classkey, itmkey, qid) {
			var cached = service.data[cls][key];
			if (!cached) service.api.get(cls, key);
			else linkExpression(null, cached, qid);
		},

		get : function(classkey, itemkey, qid) {
			socketio.emit('clidb.getitem', classkey, itemkey, qid);
		},

		dlt : function(classkey, itemkey, qid) {
			socketio.emit('clidb.deleteitem', classkey, itemkey, qid);
		},

		set : function(classkey, itemkey, value, qid) {
			socketio.emit('clidb.setitem', classkey, itemkey, value, qid);
		},

		new : function(classkey, itemkey, qid) {
			var definition = tv4.getSchema(classkey),
				instance = resolve(definition);
			if (!instance) return linkExpression('unable to create '+classkey, null, qid);
			var valid = tv4.validate(instance,definition);
			if (valid) socketio.emit('clidb.setitem', classkey, itemkey, instance, qid);
			else linkExpression(tv4.error, null, qid);
		},

		list : function(classkey, qid) {
			socketio.emit('clidb.getclass', classkey, qid);
		},

		schema : function(schemaName, qid) {
			// TODO
		},

		edit : function(classkey, itemkey) {
			// TODO
		}
	}


	/**
	 * socket listeners
	 */

	$rootScope.$on('socket.io.connected',function(){
		socketio.emit('clidb.getschema');
		socketio.emit('clidb.getall');
	});


	socketio.on('clidb.schema',function(err, id, schema){

		// add the root
		schema = JSON.parse(schema);
		tv4.addSchema(schema);

		// also add the definitions
		for (var def in schema.definitions) {
			tv4.addSchema(def,schema.definitions[def]);
		}
	});
	

	socketio.on('clidb.all',function(err, data){
		$rootScope.$apply(function(){
			service.data = {};
			for (var c in data) service.data[c] = parseJSONArray(data[c]);
		})
	});
	

	socketio.on('clidb.class',function(err, data, qid){
		$rootScope.$apply(function(){
			service.data[data.classkey] = parseJSONArray(data.value);
			if (qid) linkExpression(err, data, qid);
		});
	});


	socketio.on('clidb.item',function(err, data, qid){
		$rootScope.$apply(function() {
			if (data) {
				if (!service.data[data.classkey]) service.data[data.classkey] = {};
				service.data[data.classkey][data.itemkey] = data.value;
			}
			if (qid) linkExpression(err, data, qid);
		}, true);
	});


	socketio.on('clidb.setitem', function(err, data, qid){
		$rootScope.$apply(function(){
			if (qid) linkExpression(err, data, qid);
		}, true);
	});


	socketio.on('clidb.deleteitem', function(err, data, qid){
		$rootScope.$apply(function(){
			if (qid) linkExpression(err, data, qid);
		}, true);
	});


	/* Command Evaluation
	 *
	 * evaluate a ' ' delimied command expression (quotes accepted as one term)
	 * tags the resulting command/query with a session-unique id
	 * callbacks are indexed via this id
	 */
	
	service.commands = [];
	var callbacks = {};

	service.eval = function(x, cb) {

		// index the callback 
		var id = String(service.commands.length);
		service.commands.push({cmd: x, idx: id});
		callbacks[id] = cb;

		// http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
		var words = [];
		x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0,g1,g2,g3){
            words.push(g1 || g2 || g3 || '');
        });

		// validate the command via its schema
		var op = service.api[words[0]];
		var schm = tv4.getSchema('api#'+words[0]);
		words[0] = 'clidb.' + words[0];

		if (op && schm && tv4.validate(words.slice(1), schm)) {
		
			words.push(id);
			op.apply(service.eval, words.slice(1));
		
		} else {
		
			var err = schm ?
				tv4.error.message :
				'unknown command : '+ words[0];
			linkExpression(err, null, id);
		}
	}

	/**
	 * link async results to cached commands and their callbacks
	 */
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
				console.log(s.properties[p].$ref)
				if (s.properties[p].type=='object') r[p] = resolve(s.properties[p]);
				else if (s.properties[p].type=='number') r[p] = 0;
				else if (s.properties[p].type=='array') r[p] = resolve(s.properties[p]);
				else if (s.properties[p].type=='string') r[p]='';
				else if (s.properties[p].$ref && tv4.getSchema(s.properties[p].$ref)) {
					r[p] = resolve(tv4.getSchema(s.properties[p].$ref));
				} 
				else r[p] = null;
				//else if schemas[s.properties[p].type] r[p] = resolve(schemas[s.properties[p].type]); // <-- search referenced schemas here
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

