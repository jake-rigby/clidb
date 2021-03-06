'use strict';


angular.module('clidb.directives',[])


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


/**
 * pretty print directive, place filtered results in <pre> tag
 */
.filter('pp', function() {
	return function(data) {
		return angular.toJson(data, true);
	}
})