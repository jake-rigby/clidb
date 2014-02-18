'use-strict';

angular.module('clidb.services-controllers',[])

.factory('db', ['$rootScope', 'socket.io', '$http', function($rootScope, socketio, $http) {
	
	// cache
	var service = { data: {} };

	/**
	 * an api can comprise of 4 parts :
	 * 
	 * 1) an entry in the api.json schema describing the parameters
	 * 2) a call method within the aip object
	 * 3) a callback method in the callbacks object
	 * 4) a socekt listener for server responses, which will retrieve the index command object
	 */

	/**
	 * api object
	 */
	service.api = {

		getc : function(classkey, itemkey, qid) {
			console.log(service.data);
			var err, value;
			try { value = service.data[classkey][itemkey] } catch (e) {
				//if (!cached) service.api.get(classkey, itemkey); // <-- get and getc sould be combined for release, but we want to test the cache for now
				err = 'not cached';
			}
			linkExpression(err, value, qid); 
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
				instance = create(definition);
			if (!instance) return linkExpression('unable to create '+classkey, null, qid);
			var valid = tv4.validate(instance,definition);
			if (valid) socketio.emit('clidb.setitem', classkey, itemkey, instance, qid);
			else linkExpression(tv4.error, null, qid);
		},

		list : function(classkey, qid) {
			socketio.emit('clidb.getclass', classkey, qid);
		},

		schema : function(schemaName, qid) {
			var schema = tv4.getSchema(schemaName);
			linkExpression(tv4.error ? tv4.error : schema ? null : 'unknown schema id', schema, qid);
		},

		edit : function(classkey, itemkey) {
			// TODO - launch a json schema generated form
		},

		help : function() {
			console.log();
			var result = [];
			for (var api in tv4.getSchema('api').definitions) result.push(api);
			linkExpression(tv4.error, result, arguments[arguments.length-1]);
		}
	}

	/**
	 * callbacks object
	 */
	service.callbacks = {

		getc :  function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			service.commands[id].err = err;
		},

		get :  function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			service.commands[id].err = err;
		},

		dlt : function(err, result, id) {
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		set : function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			service.commands[id].err = err;
		},

		new : function(err, result, id) {
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		list : function(err, result, id) {
			var reply = [],
				list = parseJSONArray(result);
			for (var key in list) reply.push(key);
			service.commands[id].reply = reply;
			service.commands[id].err = err;
		},

		schema : function(err, result, id) {
			service.commands[id].reply = angular.fromJson(result);
			service.commands[id].err = err;
		},

		help : function(err, result, id) {
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		edit : function(err, result, id) {
			service.commands[id].reply = result;
			service.commands[id].err = err;			
		}

	}


	/*
	 * socket listeners
	 */

	$rootScope.$on('socket.io.connected',function(){
		socketio.emit('clidb.getschema');
		socketio.emit('clidb.getall');
	});


	socketio.on('clidb.schema',function(err, id, schema, qid){
		schema = JSON.parse(schema);
		tv4.addSchema(id, schema);
		for (var def in schema.definitions) {
			tv4.addSchema(def,schema.definitions[def]);
		}
		if (qid) linkExpression(err, value, qid);
	});
	

	socketio.on('clidb.all',function(err, data){
		$rootScope.$apply(function(){
			service.data = {};
			for (var c in data) service.data[c] = parseJSONArray(data[c]);
		})
	});
	

	socketio.on('clidb.class',function(err, classkey, value, qid){
		$rootScope.$apply(function(){
			if (!value || !classkey) return linkExpression('not found', null, qid);
			service.data[classkey] = parseJSONArray(value);
			if (qid) linkExpression(err, value, qid);
		});
	});


	socketio.on('clidb.item',function(err, classkey, itemkey, value, qid){
		$rootScope.$apply(function() {
			if (!service.data[classkey]) service.data[classkey] = {};
			service.data[classkey][itemkey] = value;
			if (qid) linkExpression(err, value, qid);
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
	
	service.commands = {};

	var callbacks = {};

	service.eval = function(x, cb) {

		// http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
		var words = [];
		x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0,g1,g2,g3){
			words.push(g1 || g2 || g3 || '');
		});

		// validate the command via its schema
		var cmd = words[0],
			op = service.api[cmd],
			schm = tv4.getSchema('api#'+words[0]),
			id = Date.now();//String(service.commands.length); // <-- change to timestamp
		words = words.slice(1);

		// index the callback 
		service.commands[id] = {cmd: x, idx: id};
		callbacks[id] = service.callbacks[cmd];

		if (op && schm && tv4.validate(words, schm)) { // <-- won't validate zero alength arrays
		
			words.push(id);
			op.apply(service.eval, words);
		
		} else {
		
			var err = schm ?
				tv4.error.message : 'unknown command : '+ cmd;
			linkExpression(err, null, id);
		}

		return id;
	}

	/**
	 * link async results to cached commands and their callbacks
	 */
	function linkExpression(err, reply, id) {
		if (callbacks[id]) {
			callbacks[id](err, reply, id);
			delete callbacks[id];
		} else if (service.commands[id]) {
			service.commands[id].err = err;
			service.commands[id].reply = reply;
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
 	function create(s) {
 		if (!s) {
 			return null
 		} else if (s.type=='array'){
			return [];//[create(s.items)];
		} else if (s.type=='object'){
			var r = {};
			for (var p in s.properties){
				
				if (s.properties[p].type=='object') {

					r[p] = create(s.properties[p]);
					
				} else if (s.properties[p].type=='number') {

					r[p] = 0;

				} else if (s.properties[p].type=='array') {

					r[p] = create(s.properties[p]);

				} else if (s.properties[p].type=='string') {

					r[p]='';

				} else if (s.properties[p].$ref && tv4.getSchema(s.properties[p].$ref)) {

					r[p] = create(tv4.getSchema(s.properties[p].$ref));

				} else {

					r[p] = null;

				}
				//else if schemas[s.properties[p].type] r[p] = create(schemas[s.properties[p].type]); // <-- search referenced schemas here
			}
			return r
		} 
		else return 'example <'+s.type+'>';	
	}

	// load local api schema to validate command strings
	$http.get('schemas/api.json').then(function(result){
		tv4.addSchema('api',result.data);
	});


	return service;

}])


.controller('clidb.ConsoleController',['$scope', 'db', function($scope, db) {

	var idx = 0;
	var list = [];

	$scope.submit = function(entry){
		var qid = db.eval(entry);
		list.push(qid);
		$scope.cmd = null;
		idx = list.length;
	}

	/**
	 * use  ng-keydown="inpKeyDown($event.keyCode)"
	 */
	$scope.inpKeyDown = function(keyCode){

		if (keyCode==38 && idx == list.length - 1) {

			$scope.cmd = ''; 
			idx = list.length;

		} else if (keyCode==38 && idx < list.length - 1) {

			$scope.cmd = $scope.commands[list[++idx]].cmd;

		} else if (keyCode==40 && idx > 0) {

			$scope.cmd = $scope.commands[list[--idx]].cmd;

		}
	}

	$scope.$watch(function(){
		return db.commands;
	},function(commands){
		$scope.commands = commands;
		list = [];
		for (var key in commands) list.push(key);
		list.sort();
	});


}])
/*
.factory('form',['db','$rootScope', function(db, $rootScope) {

	var service = {},

	service.obj = {};

	service.schema = {};

	service.set = function(obj, schema) {
		$rootScope.$apply(function() {
			service.obj = obj;
			service.schema = schema;
		}, true);
	}
}])
*/
.controller('clidb.FormController', ['$scope', '$routeParams', function($scope, $routParams) {

	$scope.$watch(function(){
		return form.obj;
	},function(commands){
		$scope.commands = commands;
		list = [];
		for (var key in commands) list.push(key);
		list.sort();
	});

}])


.filter('pp', function() {
	return function(data) {
		return angular.toJson(data, true);
	}
})

