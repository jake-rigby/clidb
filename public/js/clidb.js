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
		socketio.emit('clidb.setitem', cls, key, instance);
		//service.data[cls][key] = instance;
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


	/** TODO
	 * get the schema node describing instances
	 * of type @param cls
	 */
	service.getSchema = function(cls) {
		return tv4.getSchema(cls);
	}


	/** TODO
	 * utility to create a minimal valid instance
	 * of the given schema
	 */
	service.stub = function(cls) {

	}


	/**
	 * socket listeners
	 */

	$rootScope.$on('socket.io.connected',function(){
		socketio.emit('clidb.getschema');
		socketio.emit('clidb.getall');
	});


	socketio.on('clidb.schema',function(id, schema){
		var schema = JSON.parse(schema);
		tv4.addSchema(id, schema);
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


	return service;

}])
