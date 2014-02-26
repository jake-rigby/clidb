'use-strict';

angular.module('clidb.services-controllers',[])

.factory('db', ['$rootScope', 'socket.io', '$http', '$location', function($rootScope, socketio, $http, $location) {
	
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
			var err, value;
			try { value = service.data[classkey][itemkey] } catch (e) {
				//if (!cached) service.api.get(classkey, itemkey); // <-- get and getc sould be combined for release, but we want to test the cache for now
				err = 'not cached';
			}
			linkCallback(err, value, qid); 
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
			var definition = tv4.getSchema(classkey);
			if (!definition) return linkCallback('unable find schema '+classkey, null, qid); 
			var instance = create(definition);
			if (!instance) return linkCallback('unable to create '+classkey, null, qid);
			var valid = tv4.validate(instance,definition);
			if (valid) {
				socketio.emit('clidb.setitem', classkey, itemkey, instance, qid);
				service.api.edit(classkey, itemkey, qid);
			}
			else linkCallback(tv4.error, null, qid);
		},

		list : function(classkey, qid) {
			socketio.emit('clidb.getclass', classkey, qid);
		},

		schema : function(schemaName, qid) {
			var schema = tv4.getSchema(schemaName);
			if (!schema) socketio.emit('clidb.getschema', schemaName, qid);
			else linkCallback(tv4.error ? tv4.error : schema ? null : 'unknown schema id', schema, qid);
		},

		edit : function(classkey, itemkey, qid) {
			var schema = tv4.getSchema(classkey);
			if (schema) $location.path('/form').search({key:itemkey, schema:JSON.stringify(schema), schemaName:classkey, qid:qid});
			else linkCallback(tv4.error ? tv4.error : schema ? null : 'schema not found', schema, qid);
		},

		help : function() {
			var result = [];
			for (var api in tv4.getSchema('api').definitions) result.push(api);
			linkCallback(tv4.error, result, arguments[arguments.length-1]);
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
			service.commands[id].reply = result;//angular.fromJson(result);
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
		//socketio.emit('clidb.getschema');
		socketio.emit('clidb.getall');
	});


	socketio.on('clidb.schema',function(err, id, schema, qid){
		if (err) {
			return console.log(err);
		}
		tv4.addSchema(id, schema);
		for (var def in schema.definitions) {
			tv4.addSchema(def,schema.definitions[def]);
		}
		if (qid) linkCallback(err, schema, qid);
	});
	

	socketio.on('clidb.all',function(err, data){
		$rootScope.$apply(function(){
			service.data = {};
			for (var c in data) service.data[c] = parseJSONArray(data[c]);
		})
	});
	

	socketio.on('clidb.class',function(err, classkey, value, qid){
		$rootScope.$apply(function(){
			if (!value || !classkey) return linkCallback('not found', null, qid);
			service.data[classkey] = parseJSONArray(value);
			if (qid) linkCallback(err, value, qid);
		});
	});


	socketio.on('clidb.item',function(err, classkey, itemkey, value, qid){
		$rootScope.$apply(function() {
			if (!service.data[classkey]) service.data[classkey] = {};
			service.data[classkey][itemkey] = value;
			if (qid) linkCallback(err, value, qid);
		}, true);
	});


	socketio.on('clidb.setitem', function(err, data, qid){
		$rootScope.$apply(function(){
			if (qid) linkCallback(err, data, qid);
		}, true);
	});


	socketio.on('clidb.deleteitem', function(err, data, qid){
		$rootScope.$apply(function(){
			if (qid) linkCallback(err, data, qid);
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

	// hack to make sure api schema is asyncronously loaded before external eval 
	// (NOT NEEDED AS THE FORM NOW ACCEPTS THE SCHEMA JSON)
	var inited = false;

	service.eval = function(x, cb) {

		// http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
		var args = [];
		x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0,g1,g2,g3){
			args.push(g1 || g2 || g3 || '');
		});
		args.push(cb);
		return service.do.apply(args);
	}

	service.do = function() {
		var cb = arguments.pop(),
			cmd = arguments.shift(),
			op = service.api[cmd];

		var qid = Date.now();

		if (inited) eval(x, qid, cb);

		else $http.get('schemas/api.json').then(function(result){
			tv4.addSchema('api',result.data);
			eval(x, qid, cb);
			inited = true;
		});

		return qid;

	}

	function eval(x, id, cb) {

		// http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
		var words = [];
		x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0,g1,g2,g3){
			words.push(g1 || g2 || g3 || '');
		});

		// validate the command via its schema
		var cmd = words[0],
			op = service.api[cmd],
			schm = tv4.getSchema('api#'+words[0]);
		words = words.slice(1);

		// index a generated callback - don't index commands with passed in callbacks
		if (!cb) service.commands[id] = {cmd: x, idx: id};
		callbacks[id] = cb ? cb : service.callbacks[cmd];

		if (op && schm && tv4.validate(words, schm)) { // <-- won't validate zero alength arrays
			
			words.push(id);
			op.apply(service.eval, words);
		
		} else {
		
			var err = schm ?
				tv4.error.message : 'unknown command : '+ cmd;
			linkCallback(err, null, id);
		}

		return id;
	}

	/**
	 * link async results to cached commands and their callbacks
	 */
	function linkCallback(err, reply, qid) {
	
		if (callbacks[qid]) {
			callbacks[qid](err, reply, qid);
			delete callbacks[qid];
	
		} else if (service.commands[qid]) {
			service.commands[qid].err = err;
			service.commands[qid].reply = reply;
		}
	}


	/**
	 * parse an array of json objects and return an array of objects        
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
 		if (!s) return null
 		else if (s.type=='array') return [];
		else if (s.type=='object'){
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
		else return '';	
	}

	// expose the create method
	service.create = create;

	// load local api schema to validate command strings
	$http.get('schemas/api.json').then(function(result){
		tv4.addSchema('api',result.data);
		inited = true;
	});


	return service;

}])


.controller('clidb.ConsoleController',['$scope', 'db', function($scope, db) {

	var idx = 0,
		list = [],
		inited = false;

	$scope.submit = function(entry){
		if (!entry) return;
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
		if (!inited) {
			$scope.cmd = ''; 
			idx = list.length;
		}
		inited = true;
	});


}])


.controller('clidb.FormController', ['$scope', '$routeParams', 'db', '$window', '$location',
	function($scope, $routeParams, db, $window, $location) {

	var idx = 0;
	
	$scope.key = $routeParams.key;
	$scope.schemaName = $routeParams.schemaName;
	$scope.schema = JSON.parse($routeParams.schema);
	$scope.path = $routeParams.path;
	
	/**
	 * If the URL parameter 'template' is present, parse that as the root
	 * otherwise try and load from the db with the 'key' parameter
	 */
	try {

		$scope.root = JSON.parse($routeParams.template);
		//console.log('template method', $scope.template);
		init();

	} catch (e) {

		db.eval('get ' + $scope.schemaName + ' "' + $scope.key + '"', function(err, result) { // <-- we use 'eval' so we can pass out own callback - this is a failing of the clidb module
			
			$scope.root = JSON.parse(result); 
			//console.log('template method', $scope.root);
			init();

		});
	}

	/*
	 * crawl the root object to the given 'path'
	 * or load the root as the edit target
	 */
	function init() {

		if ($scope.path) {
			var p = angular.copy($scope.path),
				o = $scope.root;
			while(p.length && o) o = o[p.shift()];
			if (o) $scope.obj = o;
			else throw new error('invalid object path');
		}

		else $scope.obj = $scope.root;

		var valid = tv4.validate($scope.obj, $scope.schema);
		//console.log('validation results ', $scope.obj, $scope.schema, tv4.error, valid);
		$scope.items = parse($scope.schema, $scope.obj, 0);

	}



	function parse(node, data, depth, path, pindex) {

		if (!path) path = [];
		
		var result = [], type, items, item, ref, ppath;

		if (node.properties) {

			for (var p in node.properties) {

				type = node.properties[p].type;
				ref = node.properties[p].ref;
				items = node.properties[p].items;

				// items of type reference
				if (ref) {

					item = {
						title: p,
						type: item.type,
						value: data[p],
						depth: depth,
						ref: ref,
						id: idx++,
						path: path.concat([p]),
						index: pindex
					};

					item.refs = ['loading'];
					result.push(item);
				}
				
				// items of primitive type
				else if (type == 'string' ||
					type == 'number') {

					item = {
						title: p,
						type: type,
						value: data[p],
						depth: depth,
						id: idx++,
						path: path.concat([p]),
						index: pindex

					};

					result.push(item);
				}

				// list items
				else if (type == 'array') {

					if (!items) {
						items = {type: 'string'};
					}

					// for objects we launch a new form, but we have to call back to this one
					if (items.type == 'object') {

						for (var v in data[p]) {

							item = {
								title: p,
								index: Number(v),
								type: 'object',
								value: JSON.stringify(data[p][v], undefined, 2),
								depth: depth,
								id: idx++,
								schema: node.properties[p].items,
								path: path.concat([p,Number(v)])
							}

							result.push(item);
						}
					}
					
					else for (var v in data[p]) {
			
						item = {
							title: p,
							index: Number(v), 
							type: items.type,
							value: data[p][v], 
							depth: depth,
							id: idx++,
							path: path.concat([p,Number(v)])
						};

						result.push(item);
					}

					// a stub to add a new list item
					result.push({
						title: p,
						index: data[p].length,
						id: idx++,
						template: db.create(items),
						newItemStub: true,
						depth: depth,
						path: path.concat([p])
					})
				}

				else {
					// type is object
					console.log('To complete');
				}
			}
		}

		return result;
	}


	$scope.editChild = function(schema, path) {
		db.api.set($scope.schemaName, $scope.key, $scope.root, $routeParams.qid);
		$location.path('/form').search({
			key: $scope.key, 
			schema: JSON.stringify(schema), 
			schemaName: $scope.schemaName, 
			path: path,
			template: $scope.root } );
	}

	$scope.save = function() {
		db.api.set($scope.schemaName, $scope.key, $scope.root, $routeParams.qid);
		$window.history.back();
	}
	
	$scope.cancel = function() {
		db.api.dlt($scope.schemaName, $scope.key, $routeParams.qid);
		$window.history.back();
	}

	$scope.loadRefs = function(item) {
		db.eval('list '+item.ref, function(err, result) {
			item.refs = [];
			for (var key in result) item.refs.push(key);
		})
	}

	$scope.setRef = function(item, ref) {
		$scope.obj[item.title] = ref;
	}

	$scope.augmentList = function(path, template) {
		var loc = $scope.obj;
		while (path.length && loc) {
			loc = loc[path.shift()];
		}
		loc.push(template);
		$scope.items = parse($scope.schema, $scope.obj, 0);
	}

	$scope.removeListItem = function(item) {
		var loc = $scope.obj;
		while (item.path.length > 1 && loc) {
			loc = loc[item.path.shift()];
		}
		if (loc){
			loc[item.path.shift()] = null;
			compressList(loc);
		}
		$scope.items = parse($scope.schema, $scope.obj, 0);
	}

	function compressList(source){
		var temp = [];
		for(var i in source) source[i] && temp.push(source[i]); 
		angular.copy(temp,source);
	}

	//https://coderwall.com/p/ngisma
	$scope.safeApply = function(fn) {
		var phase = this.$root.$$phase;
		if(phase == '$apply' || phase == '$digest') {
			if(fn && (typeof(fn) === 'function')) {
			fn();
			}
		} else {
			this.$apply(fn);
		}
	};


}])
