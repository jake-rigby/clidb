'use-strict';

angular.module('clidb.services',[])

.factory('db', ['$rootScope', 'socket.io', '$http', '$location', 'editStore', 'utils',
	function($rootScope, socketio, $http, $location, editStore, utils) {
	
	/*
	 * instances are cached in classes, directly accessible through the data object
	 */
	var service = { data: {} };

	/* 
	 * Evaluate a ' ' delimied command expression (quotes accepted as one term)
	 * tags the resulting command/query with a session-unique id
	 * callbacks are indexed via this id
	 */	
	service.commands = {};

	/*
	 * callbacks are indexed in the callbacks dictionary via the unique command id
	 */
	var callbacks = {};

	/*
	 * hack to make sure api schema is asyncronously loaded before external eval 
	 * not really required, the form service accepts json value schema so async not important
	 */
	var inited = false;

	
	service.resolveToString = function(x, cb) {

		try {

		var x = x,
			aborted = false,
			completed = false;

		var inners = utils.extractSectionsinCurlys(x),
			outers = utils.extractSectionsinCurlys(x, true);

		if (outers) {

			var replace = {};

			for (var i = 0; i < outers.length; i++) {
				replace[inners[i]] = outers[i];
			}

			for (var r in replace) {		
				(function(inner, outer) {
					service.eval(inner, function(err, result) {
						if (err) {
							if (cb) cb(err, null);
							return abort();
						}
						x = x.replace(new RegExp(inner, "g"), result);
						delete replace[inner];
						for (var j in replace) return;
						cb(null, x);
					}, ++QID); // <-- ensure we don't use same id
				})(r, replace[r]);
			}
		}

		else cb(null, x);

		} catch (e) {

			cb(e, null);
			return abort();
		}

		function abort() {
			var aborted = true;
		}
		
	}


	/**
	 * parse a command string (async)
	 * resolve parts within {} recursively
	 * split by ' ' space char
	 * first word is the command method id,
	 * remaining words are the parameters, described by api.json
	 */
	service.eval = function(x, cb, qid) {

		try {

		var x = x,
			aborted = false,
			completed = false;

		if (!qid) qid = Date.now();
		// service.commands[qid] = {cmd: str, idx: qid};

		var inners = utils.extractSectionsinCurlys(x),
			replacers = utils.extractSectionsinCurlys(x, true),
			results = {};

		if (replacers) for (var i = 0; i < replacers.length; i++) {

			var key = '$REPLACE$' + i;
			x = x.replace(replacers[i], key);
		}

		var parts = utils.splitWhiteSpaceOutsideQuotes(x),
			cmd = parts.shift();

		if (replacers) for (var i = 0; i < replacers.length; i++) {		
			(function(y, key, index, parts, results, aborted) {
				service.eval(y, function(err, result) {
					inners[index] = undefined;
					if (err) {
						if (cb) cb(err, null);
						return abort();
					} 
					results[key] = result;
					complete();
				}, qid + i)
			})(inners[i], '$REPLACE$' + i, i, parts, results, aborted);
		}

		} catch (e) {

			cb(e, null);
		}

		function complete() {
			if (aborted || completed) return;
			for (var i in inners) if (inners[i]) return;
			for (i =  0; i < parts.length; i++) {
				var key = parts[i],
					result = results[parts[i]];
				if (result) {
					try { 
						result = JSON.parse(results[parts[i]])
					} catch (e) {
						result = results[parts[i]];
					}
					parts[i] = result;
				}
			}
			completed = true;
			service.exec(cmd, parts, cb, qid);			
		}

		complete();

		function abort() {
			var aborted = true;
		}

		return qid;
	}

	/**
	 * execute the specified command
	 * give the command an id if not provided
	 */
	service.exec = function(cmd, args, cb, qid) {
		
		if (!qid) qid = Date.now();

		var str = [cmd].concat(args.slice(0, args.length)).join(' ');
		
		/* index a generated callback 
		 * don't index commands with passed in callbacks, so we don't spam the console */
		if (!cb) service.commands[qid] = {cmd: str, idx: qid};
		callbacks[qid] = cb ? cb : service.callbacks[cmd];

		if (inited) applyCommand(cmd, args, qid, cb);

		else $http.get('schemas/api.json').then(function(result){
			tv4.addSchema('api',result.data);
			applyCommand(cmd, args, qid, cb);
			inited = true;
		});

		return qid;
	}

	/**
	 * when applying the command, make sure the api schema is satisfied
	 * otherwise notify of the error
	 */
	function applyCommand(cmd, args, id, cb) {

		var op = service.api[cmd],
			schm = tv4.getSchema('api#'+cmd);

		if (op && schm && tv4.validate(args, schm)) { // <-- won't validate zero alength arrays
			
			args.push(id, cb); // <-- ??
			op.apply(applyCommand, args);
		
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
	 * create a minimal instance described by a schema
	 */
 	function create(s) {
 		
 		if (!s) return null
 		if (s.$ref) {
 			var ref = tv4.getSchema(s.$ref);
 			if (!ref) return null;
 			else s = ref; 
 		}
 		if (s.type=='array') return [];//return [create(s.items)];
		else if (s.type=='object'){
			var r = {};
			for (var p in s.properties){
				
				if (s.properties[p].type=='object') r[p] = create(s.properties[p]);
				else if (s.properties[p].type=='number') r[p] = 0;
				else if (s.properties[p].type=='array') r[p] = create(s.properties[p]);
				else if (s.properties[p].type=='string') r[p]= '';
				else if (s.properties[p].$ref && tv4.getSchema(s.properties[p].$ref)) r[p] = create(tv4.getSchema(s.properties[p].$ref));
				else r[p] = 'unknown : '+p;
				//else if schemas[s.properties[p].type] r[p] = create(schemas[s.properties[p].type]); // <-- search referenced schemas here
			}
			return r
		} 
		else return '';	
	}

	/*
	 * expose the create method
	 */
	service.create = create;


	/*
	 * the api methods
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

		getp : function(classkey, itemkey, path, qid) {
			socketio.emit('clidb.getitemprop', classkey, itemkey, path, qid);
		},

		dlt : function(classkey, itemkey, qid) {
			//service.data[classkey][itemkey] = null; // <-- remove locally
			delete service.data[classkey][itemkey];
			socketio.emit('clidb.deleteitem', classkey, itemkey, qid);
		},

		set : function(classkey, itemkey, value, qid) {
			socketio.emit('clidb.setitem', classkey, itemkey, value, qid);
			if (!service.data[classkey]) service.data[classkey] = {};
			service.data[classkey][itemkey] = value;
		},

		new : function(classkey, qid) {
			var schm = tv4.getSchema('#'+classkey);
			if (!schm) return linkCallback('unable to find definition '+classkey, null, qid);
			var instance = create(schm);
			if (!instance) return linkCallback('error generating new  '+classkey, null, qid);
			linkCallback(null, instance, qid);
		},

		list : function(classkey, qid) {
			socketio.emit('clidb.listclasses', classkey, qid);
		},

		getclass : function(classkey, qid) {
			socketio.emit('clidb.getclass', classkey, qid);
		},

		schema : function(schemaName, qid) {
			var schema = tv4.getSchema(schemaName);
			if (!schema) socketio.emit('clidb.getschema', schemaName, qid);
			else linkCallback(tv4.error ? tv4.error : schema ? null : 'unknown schema id', schema, qid);
		},

		edit : function(classkey, item, qid) {
			var schema = tv4.getSchema('#'+classkey);
			if (!schema) return linkCallback('unable to find definition '+classkey, null, qid);
			if (schema && tv4.validate(item, classkey)) {
				editStore.schema = schema;
				editStore.obj = item;
				editStore.cb = function(err, result) {
					linkCallback(err, result, qid);
					//service.api.set(classkey, itemkey, result, qid);
				}
				if (false/*$modal*/) $modal.open({
					templateUrl: 'partials/jsonModal.html',
					controller: 'ItemEditorController',
					resolve: {
						//schema:JSON.stringify(schema), 
						//obj:JSON.stringify(item),
						schemaName:classkey, 
						qid:qid, 
						key:item.id
					}
				})
				else $location.path('/item-editor').search({
					//schema:JSON.stringify(schema), 
					//obj:JSON.stringify(item),
					schemaName:classkey, 
					qid:qid, 
					key:item.id
				});

			}
			else linkCallback(tv4.error ? tv4.error : schema ? null : 'schema not found', schema, qid);
		},

		help : function(qid) {
			var result = [];
			for (var api in tv4.getSchema('api').definitions) result.push(api);
			linkCallback(tv4.error, result, qid);
		},

		result : function(qid) {
			linkCallback(null, editStore.obj, qid);
		},

		export : function(classkey, qid) {
			socketio.emit('clidb.export', classkey, qid);
		}
	}

	/*
	 * respective callbacks for api methods 
	 * (these are all very similar, but some are different)
	 */
	service.callbacks = {

		getc : function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			editStore.obj = result;
			service.commands[id].err = err;
		},

		get : function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			editStore.obj = result;
			service.commands[id].err = err;
		},

		getp : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		dlt : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		set : function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			editStore.obj = result;
			service.commands[id].err = err;
		},

		new : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		list : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		getclass : function(err, result, id) {
			var reply = [],
				list = utils.parseJSONArray(result);
			for (var key in list) reply.push(key);
			editStore.obj = result;
			service.commands[id].reply = reply;
			service.commands[id].err = err;
		},

		schema : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		help : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		edit : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;			
		},

		result : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;			
		},

		commit : function(err, result, id) {
			service.commands[id].reply = result;
			service.commands[id].err = err;						
		}
	}


	/*
	 * socket listeners will link a query id (qid)
	 * passed back from the server to get the right callback
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
		/*
		for (var def in schema.definitions) {
			tv4.addSchema(def,schema.definitions[def]);
		}*/
		if (qid) linkCallback(err, schema, qid);
	});
	

	socketio.on('clidb.all',function(err, data){
		$rootScope.$apply(function(){
			service.data = {};
			for (var c in data) service.data[c] = utils.parseJSONArray(data[c]);
		})
	});
	

	socketio.on('clidb.class',function(err, classkey, value, qid){
		$rootScope.$apply(function(){
			if (!value || !classkey) return linkCallback('not found', null, qid);
			service.data[classkey] = utils.parseJSONArray(value);
			if (qid) linkCallback(err, value, qid);
		});
	});


	socketio.on('clidb.item',function(err, classkey, itemkey, value, qid){
		$rootScope.$apply(function() {
			if (!service.data[classkey]) service.data[classkey] = {};
			try {
				service.data[classkey][itemkey] = JSON.parse(value);
			} catch (e) {
				service.data[classkey][itemkey] = value;
			}
			if (qid) linkCallback(err, value, qid);
		}, true);
	});

	socketio.on('clidb.getitemprop', function(err, result, qid) {
		$rootScope.$apply(function() {
			if (qid) linkCallback(err, result, qid);
		})
	})


	socketio.on('clidb.setitem', function(err, classkey, itemkey, item, qid){
		$rootScope.$apply(function(){
			if (service.data[classkey] && err) service.data[classkey][itemkey] = null;
			if (qid) linkCallback(err, item, qid);
		}, true);
	});


	socketio.on('clidb.deleteitem', function(err, data, qid){
		$rootScope.$apply(function(){
			if (qid) linkCallback(err, data, qid);
		}, true);
	});


	socketio.on('clidb.listclasses', function (err, result, qid) {
		$rootScope.$apply(function(){
			if (qid) linkCallback(err, result, qid);
		}, true);
	});

	socketio.on('clidb.export', function(err, classkey, result, qid){
		$rootScope.$apply(function(){
			if (qid) linkCallback(err, classkey, result, qid);
		}, true);
	});




	/**
	 * export function - tell teh server to write the specified file to disk
	 */
	service.export = function(classkey) {
		
		socketio.emit('clidb.export', classkey);
	}

	socketio.on('clidb.export', function() {

		// server confirms export
		console.log('exported');
	});

	return service;

}])


/*
 * A service that allows us to pass an object between ui's for editing
 */
.factory('editStore', function() {

	return {
		schema: null,
		obj: null,
		cb: function(err, result) {
			console.log('editStore default callback ',err, result);
		}
	}
})


.factory('utils', function() {

	return {

	/**
	 * remove Boolean(val)==false elements from array and collaps down
	 */
	compressList: function(source) {

		var temp = [];
		for(var i in source) source[i] && temp.push(source[i]); 
		angular.copy(temp,source);
	},

	/**
	 * parse an array of json objects and return an array of objects        
	 */
	parseJSONArray: function(source) {
		
		var result = {};
		for (var key in source) result[key] = JSON.parse(source[key]);
		return result;
	},


	/**
	 * split by space char, allowing for full strings inside quotes 
	 * http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
	 */
	splitWhiteSpaceOutsideQuotes : function(x) {

		var parts = [];
		x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0, g1, g2, g3) {
			parts.push(g1 || g2 || g3 || '');
		});	
		return parts;
	},

	/**
	 * does not support nesting
	 */
	extractSectionsinCurlys : function(x, keepCurlys) {

		if (keepCurlys) return x.match(/{([^}]+)}/g);
		else return x.match(/[^{}]+(?=\})/g);
	},

	getUid : function() {
		var n = Date.now();
		if (this.last != n) {
			this.last
			return n.toString()+'.0'
		} 
	}
	}
})

