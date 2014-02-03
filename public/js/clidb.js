'use-strict';

angular.module('clidb',[])

.factory('db', ['$rootScope', 'socket.io', function($rootScope, socketio) {
	
	var service = { data: {}};

	service.classes = {};

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


	socketio.on('clidb.schema',function(id, schema){

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


	socketio.on('clidb.item',function(data){
		$rootScope.$apply(function(){
			if (!service.data[data.classkey]) service.data[data.classkey] = {};
			service.data[data.classkey][data.itemkey] = data.value;
		});
	});


	/**
	 * helpers        
	 */

	function parseJSONArray(source){
		var result = {};
		for (var key in source) result[key] = JSON.parse(source[key]);
		return result;
	}

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
				//else if schemas[s.properties[p].type] r[p] = resolve(schemas[s.properties[p].type]);
				else {r[p]='';}
			}
			return r
		} 
		else return 'example <'+s.type+'>';	
	}



	return service;

}])
