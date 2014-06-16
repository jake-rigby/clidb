angular.module('clidb.controllers',[])

.controller('clidb.JSONFormTypeOneController', ['$scope', '$routeParams', 'db', '$window', '$location', 'editStore', '$rootScope',
	function($scope, $routeParams, db, $window, $location, editStore, $rootScope) {

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

		//try {
			$scope.items = parse($scope.schema, $scope.obj, 0, $scope.path);
		//} catch (e) {
		//	$scope.items = [];
		//	$scope.error = e;
		//}

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

	// remove the reload warning if we leave the form editor - WARNING magic string!
	$rootScope.$on("$routeChangeSuccess", function(event, current, previous) {
		if (current.loadedTemplateUrl != 'partials/form.html' && previous.loadedTemplateUrl == 'partials/form.html')
		$window.onbeforeunload = null;
	})



	function parse(node, data, depth, path, pindex) {

		if (!path) path = [];
		
		var result = [], type, items, item, ref, ppath;

		if (node.$ref) node = tv4.getSchema(node.$ref); // <-- TODO catch errors

		if (node.properties) {

			for (var p in node.properties) {

				var prop = node.properties[p];
				if (prop.$ref) prop = tv4.getschema(prop.$ref); // <-- TODO catch errors

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

					// for objects we launch a new form, but  we have to call back to this one
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

		return result;
	}

	$scope.editChild = function(schema, path) {
		schemaHistory.push($scope.schema);
		$scope.schema = schema;
		$scope.path = angular.copy(path);
		init();
	}

	$scope.back = function() {
		if ($scope.path.length < 2)  return;
		$scope.path.pop();
		$scope.path.pop();
		$scope.schema = schemaHistory.pop();
		init();
	}

	$scope.save = function() {
		editStore.cb(null,  $scope.root);
		$window.history.back();
	}
	
	$scope.cancel = function() {
		editStore.cb('User cancelled', null);
		$window.history.back();
	}

	$scope.loadRefs = function(item) {
		db.exec('list', [item.ref], function(err, result) {
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
		var loc = $scope.obj,
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

	function getSchemaFromPath(path) {

		var schm = $scope.schema;

	}


}])