
function hlight(){
	console.log('exec');

	$('textarea').change(function() {
		console.log('changing');
		$('textarea').highlightTextarea({
			words: ['agent', 'vulputate']
		});
	});
}


angular.module('clidb.controllers',[])


.controller('TerminalController',['$scope', 'db', function($scope, db) {

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


.controller('ClassEditorController', ['$scope', '$routeParams', '$location', '$rootScope', 'db', '$modal', 'editStore', 'socket.io', '$window', 
	function ($scope, $routeParams, $location, $rootScope, db, $modal, editStore, socketio, $window) {

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

		$scope.back = function () {

			//$location.path('/');
			$window.history.back();
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


.controller('ItemEditorController', ['$scope', '$routeParams', 'db', '$window', '$location', 'editStore', '$rootScope', '$timeout', '$modal',
	function($scope, $routeParams, db, $window, $location, editStore, $rootScope, $timeout, $modal) {

	// if there is nothign in the editStore, the user probably refreshed - whatever, we need to go back to main page
	if (!editStore.obj || !editStore.schema) {
		$location.path('/flow-picker');
		return;
	}

	
	var idx = 0;

	var schemaHistory = [];

	$scope.key = $routeParams.key;
	$scope.schemaName = $routeParams.schemaName;
	$scope.schema = editStore.schema; //$routeParams.schema ? JSON.parse($routeParams.schema) : editStore.schema;
	$scope.path = $routeParams.path;
	$scope.root = editStore.obj; //$routeParams.obj ? JSON.parse($routeParams.obj) : editStore.obj;
	
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
			else throw 'invalid object path';
		}

		else {
			$scope.obj = $scope.root;
			$scope.path = [];
		}

		var valid = tv4.validate($scope.obj, $scope.schema);
		//console.log('validation results ', $scope.obj, $scope.schema, tv4.error, valid);

		try {
			$scope.items = parse($scope.schema, $scope.obj, 0, $scope.path);
		} catch (e) {
			$scope.items = [];
			$scope.error = e;
		}

	};

	init();
	
	// warn the user they will lose work if they refresh (TODO need to activate this only after edit)
	$window.onbeforeunload = function(evt) {
		var message = 'If you reload the page, your changes to the JSON object will be lost. Are you sure?';
		if (typeof evt == 'undefined') {
			evt = $window.event; // <-- user refreshes
		} 
		if (evt) {
			evt.returnValue = message; // <-- user cancelled
		}
		return message;
	}

	// remove the reload warning if we leave the item editor - WARNING magic string!
	$rootScope.$on("$routeChangeSuccess", function(event, current, previous) {
		if (current.loadedTemplateUrl != 'partials/item-editor.html' && previous.loadedTemplateUrl == 'partials/item-editor.html')
		$window.onbeforeunload = null;
	})



	function parse(node, data, depth, path, pindex) {

		if (!path) path = [];
		
		var result = [], type, items, item, ref, ppath;

		if (node.$ref) node = tv4.getSchema(node.$ref); // <-- TODO catch errors

		if (node.properties) {

			for (var p in node.properties) {

				var prop = node.properties[p];
				if (prop.$ref) prop = tv4.getSchema(prop.$ref); // <-- TODO catch errors

				type = prop.type;
				ref = prop.ref;
				items = prop.items;

				if (items && items.$ref) items = tv4.getSchema(items.$ref); // <-- TODO catch errors

				/* 
				 * items of type reference
				 * use 'ref' as opposed to '$ref' in a schema to
				 * indicate this is a key reference to a hash (so we can present a drop down of members)
				 * rather than a $ref to nest an external schema
				 */
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
				else if (type == 'array' || type == 'object') {

					// for objects we launch a new item editor, but  we have to call back to this one
					if (items && items.type == 'object') {						

						for (var v in data[p]) {

							if (Array.isArray(data[p])) v = Number(v);

							item = {
								title: p,
								index: v,
								type: 'object',
								value: JSON.stringify(data[p][v], undefined, 2),
								depth: depth,
								id: idx++,
								schema: node.properties[p].items,
								path: path.concat([p,v])
							}

							result.push(item);
						}
					}
					
					else for (var v in data[p]) {
			
						item = {
							title: p,
							foo:'bar',
							index: v, 
							type: items ? items.type : null,
							value: data[p][v], 
							depth: depth,
							id: idx++,
							path: path.concat([p,v])
						};

						result.push(item);
					}

					// a stub to add a new list item
					if (items && data[p]) {
						item = {
							title: p,
							index: data[p].length,
							id: idx++,
							template: db.create(items),
							newItemStubParentType: type,
							depth: depth,
							path: path.concat([p])
						}
						result.push(item);
					}
				}

				else {
					// unimplemented type
					console.log('To complete');
				}
			}
		}

		hlight();
		return result;
	}


	/**
	 * edit a child property of $scope.obj
	 */
	$scope.editString = function (prop) {
		$modal.open({
			templateUrl: 'partials/edit-string.html', 
			controller: 'editStringController',
			resolve: {
				name: function() {return 'Edit '+prop;},
				value: function  () {return $scope.obj[prop];}
			}
		})
		.result.then(function (result) {
			
			$scope.obj[prop] = result;
		
		}, function () {
			// Modal dismissed cb
		});
	}

	/**
	 * edit an element of a child property of $scope.obj
	 */
	$scope.editArrayString = function (prop, key) {
		$modal.open({
			templateUrl: 'partials/edit-string.html', 
			controller: 'editStringController',
			resolve: {
				value: function  () {return $scope.obj[prop][key];},
				name: function () {return 'Edit '+prop+' : '+key}
			}
		})
		.result.then(function (result) {
			
			$scope.obj[prop][key] = result;
		
		}, function () {
			// Modal dismissed cb
		});
	}

	$scope.editChild = function(schema, path) {
		schemaHistory.push($scope.schema);
		$scope.schema = schema;
		$scope.path = angular.copy(path);
		init();
	}

	$scope.back = function() {
		if ($scope.path.length < 2)  return $scope.save();
		$scope.path.pop();
		$scope.path.pop();
		$scope.schema = schemaHistory.pop();
		init();
	}

	$scope.save = function() {
		db.exec('set', [$scope.schemaName, $scope.key, $scope.root], function(err, success) {
			editStore.cb(null,  $scope.root);
			$timeout(function(){$window.history.back();}, 100);
		});
	}
	
	$scope.cancel = function() {
		editStore.cb('User cancelled', null);
		$window.history.back();
	}

	$scope.loadRefs = function(item) {
		db.exec('getclass', [item.ref], function(err, result) {
			item.refs = [];
			for (var key in result) item.refs.push(key);
		})
	}

	$scope.setRef = function(item, ref) {
		$scope.obj[item.title] = ref;
	}

	$scope.augmentList = function(path, template, key) {
		var loc = $scope.root,
			pcpy = angular.copy(path);
		while (pcpy.length && loc) {
			loc = loc[pcpy.shift()];
		}
		if (Array.isArray(loc)) loc.push(template);
		else if (key) loc[key] = template;
		path = angular.copy(path);
		path.pop();
		$scope.items = parse($scope.schema, $scope.obj, 0, path);
	}

	$scope.removeListItem = function(item) {
		var loc = $scope.root,
			path = angular.copy(item.path);
		while (path.length > 1 && loc) {
			loc = loc[path.shift()];
		}
		if (Array.isArray(loc)) {
			loc[path.shift()] = null;
			compressList(loc);
		} else if (loc) {
			delete loc[path.shift()];
		}
		//$scope.items = parse($scope.schema, $scope.obj, 0);
		init();
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

	function getSchemaFromPath(path) {

		var schm = $scope.schema;

	}
}])


/*
 * Modal Controllers
 */
.controller('editStringController',['$scope','$modalInstance','name','value',
	function($scope, $modalInstance, name, value){

	$scope.value = value;
	$scope.val = value;
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

