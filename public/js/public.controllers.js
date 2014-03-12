'use strict';
	
angular.module('public.controllers',[])

.controller('UserController',['$scope','UserService','$rootScope',function($scope,UserService,$rootScope){
	
	$scope.user = UserService.user;
	$scope.logout = UserService.logout;

	$scope.$on('userUpdated',function(event,user) {
		
		$scope.user = user;
	});

	$scope.reset = function() {
		
		UserService.reset();
	}

	$scope.exportClass = function(classkey) {
		console.log('expoert', classkey);
		UserService.export(classkey);
	}
}])
