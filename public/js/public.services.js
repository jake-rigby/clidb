'use strict';
	
angular.module('public.services',[])

.factory('UserService',['$http','$rootScope','socket.io','$location',
	function($http,$rootScope,socketio,$location){
	
	var service = {user:null};
	
	$http({method: 'GET', url: servicesRoot+'/user'})
		.success(function(data, status,headers){
			if (status == 200 && data.hasOwnProperty('identifier') && data.hasOwnProperty('displayName')) service.user = data;
			else service.user = null; // 401
			$rootScope.$broadcast('userUpdated',service.user);
		})
		.error(function(data, status){
			service.user = null;
			$rootScope.$broadcast('userUpdated',null);
			console.log('login failed: '+status);
		})

	service.logout = function(){
		service.user = null;
		$rootScope.$broadcast('userUpdated',null);
		console.log('logout');
		$location.path(servicesRoot);
		// TODO - remove authentication frmo the session/ force a new one
	}

	service.reset = function(){
		socketio.emit('useradmin.reset');
		window.location.reload();
	}

	return service;
}])


.factory('socket.io',['$rootScope',function($rootScope){

	// connect and return the socket object
	var socket = io.connect(servicesRoot ? servicesRoot:'');
	socket.once('disconnect', function(){
		console.log('socket disconnected by server');
		$rootScope.$broadcast('socket.io.disconnected');
	});
	socket.on('connect',function(data){
		console.log('socket connected');
		$rootScope.$broadcast('socket.io.connected');
	});
	return socket;
}])

.factory('ConsoleService',['socket.io','$rootScope',function(socketio,$rootScope){

	var callbacks = {};

	var service = {
		
		commands : [],
		
		eval : function(x,cb){
			var id = service.commands.length;
			service.commands.push({cmd:x, idx:id});
			callbacks[id] = cb;
			socketio.emit('evaluate',x,id);
		}
	};

	socketio.on('evaluate.result',function(reply,err,id){
		$rootScope.$apply(function(){
			service.commands[id].reply = reply;
			if (callbacks[id]) {
				callbacks[id](err,reply);
				callbacks[id] = null;
			}
		},true);
	});

	return service;
}])
