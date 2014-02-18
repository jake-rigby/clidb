var app = angular.module('DealerBlackMarketIndex',['services.public'])
'use strict';
	
angular.module('public.controllers',[])

.controller('UserController',['$scope','UserService','$rootScope',function($scope,UserService,$rootScope){
	$scope.user = null;
	$scope.logout = UserService.logout;
	$scope.$on('userUpdated',function(event,user){
		$scope.user = user;
	})
	$scope.reset = function(){
		UserService.reset();
	}
}])

.controller('ConsoleController',['$scope','ConsoleService',function($scope,service){

	var idx = 0;

	$scope.submit = function(entry){
		service.eval(entry);
		$scope.cmd = null;
		idx = $scope.commands.length;
	}

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
		return service.commands;
	},function(commands){
		$scope.commands = commands;
	});

}])