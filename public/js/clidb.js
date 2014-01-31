'use-strict';

angular.module('clidb',[])

.factory('db', ['$rootScope', 'socket.io', function($rootScope, socketio) {

	var schema = {};
	var service = { data: {}};

	service.classes = {};

	service.setSchema = function(value) {		
		schema = value;
	}

	service.getSchema = function() {
		return schema;
	}

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
	service.describe = function(cls) {

	}


	/** TODO
	 * utility to create a minimal valid instance
	 * of the given schema
	 */
	service.stub = function(schema) {

	}


	/**
	 * socket listeners
	 */

	$rootScope.$on('socket.io.connected',function(){
		socketio.emit('clidb.getschema');
		socketio.emit('clidb.getall');
	});


	socketio.on('clidb.schema',function(data){
		service.setSchema(JSON.parse(data));
	});
	

	socketio.on('clidb.all',function(data){
		console.log(data)
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
