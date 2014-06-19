'use strict';


angular.module('clidb.editor',[])


// THIS DIRECTIVE SHOULD BE AVAILABLE ELSEWHERE
.directive('ngEnter', function() {
	return function(scope, element, attrs) {
		element.bind("keydown keypress", function(event) {
			if(event.which === 13) {
				scope.$apply(function(){
					scope.$eval(attrs.ngEnter, {'event': event});
				})
				event.preventDefault();
			}
		});
	}
})


.controller('ClassChooserController', ['$scope', '$location', 'db',
	function($scope, $location, db) {
		
		db.exec('list', [], function(err, result) {

			$scope.classes = result;
		});

		$scope.choose = function (classId) {

			$location.path('/class-editor').search({clas: classId});
		}
	}
])


.controller('ClassEditorController', ['$scope', '$routeParams', '$location', '$rootScope', 'db', '$modal', 'editStore', 'socket.io', 
	function ($scope, $routeParams, $location, $rootScope, db, $modal, editStore, socketio) {

		$scope.cls = $routeParams.clas;

		$scope.schema = tv4.getSchema('#'+$scope.cls);

		// a hack - if the user refreshes, and the schemas haven't loaded yet.. solve byu w3rapping tv4 in a service or directive
		socketio.on('clidb.schema', function() {
			$scope.schema = tv4.getSchema('#'+$scope.cls);
		});

		// tell the server what we want to update
		db.exec('getclass', [$scope.cls]);
		
		$scope.$watch(function () {
			return db.data[$scope.cls];
		}, function (items){
			$scope.items = {};
			for (var item in items) {
				$scope.items[items[item].id] = items[item].id;
			}
		}, true)

		$scope.home = function () {

			$location.path('/');
		}

		$scope.new = function () {
			$modal.open({
				templateUrl: 'partials/edit-string.html', 
				controller: 'editStringController',
				resolve: {
					value: function  () {return '';},
					name: function () {return 'New '+$scope.cls}
				}
			})
			.result.then(function (id) {
				db.exec('new', [$scope.cls], function (err, result) {
					result.id = id;
					if (err) return console.log(err);
					db.exec('edit', [$scope.cls, result], function (err, result) {
						if (err) return console.log(err);
						db.exec('set', [$scope.cls, id, result], function (err, setResult){
							console.log(err, setResult);
						});
					});
				});
			}, function () {
				// Modal dismissed cb
			});
		}

		$scope.edit = function (id) {
			db.exec('getc', [$scope.cls, id], function (err, result) {
				if (err) return console.log(err);
				db.exec('edit', [$scope.cls, result], function (err, success) {
					if (err) console.log('couldn\'t Save', err);
					else console.log('SAVED', success);
				})
			})
		}

		$scope.delete = function (id) {
			db.exec('dlt', [$scope.cls, id], function (err, result) {
				console.log('deleted ' + id);
			});
		}

		$scope.exportClass = function () {
			$modal.open({
				templateUrl: 'partials/confirm.html',
				controller: 'confirmController',
				resolve: {
					value: function () { 
						return 'When you press save in the editor, the changes you made are persisted in the database, and will appear in the game. If the database is reset, however, the changes will be lost. If you commit changes now, they will be rebuilt with the game on reset.'
					},
					name: function () { 
						return 'Commit All Flows'
					}
				}
			})
			.result.then(function (result) {
				if (result == true) {
					db.exec('export', [$scope.cls], function(err, success) {
						if (err) console.log('couldn\'t export', err);
						else console.log('EXPORTED', success);
					});
				}
			})
		}

		// this is three chained db calls and exposes a risk of loosing data - it should be transactionall on the db api
		$scope.rename = function (id, newId) {
			db.exec('get', [$scope.cls, id], function (err, result) {
				if (err) return console.log(err);
				db.exec('dlt', [$scope.cls, id], function (err, dltSuccess) {
					if (err) return console.log(err);
					db.exec('set', [$scope.cls, newId, result], function (err, success) {
						if (err) console.log('couldn\'t rename', err);
						else console.log('RENAMED', success);
					})
				})

			})
		}
	}
])


.controller('editStringController',['$scope','$modalInstance','name','value',
	function($scope, $modalInstance, name, value){

	$scope.value = value;
	$scope.name = name;

	$scope.ok = function(newValue) {
		$modalInstance.close(newValue);
	}

	$scope.cancel = function() {
		$modalInstance.dismiss();
	}

}])


.controller('confirmController', ['$scope','$modalInstance', 'name', 'value',
	function($scope, $modalInstance, name, value) {

	$scope.name = name;
	$scope.value = value;

	$scope.confirm = function() {
		$modalInstance.close(true);
	}

	$scope.cancel = function() {
		$modalInstance.dismiss();
	}
}])



