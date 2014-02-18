'use strict';
	

angular.module('public.filters',[])

.filter('orderObjectBy', function(){
	return function(input, attribute, reverse) {
		if (!angular.isObject(input)) return input;
		var array = [];
		for(var objectKey in input) {
			array.push(input[objectKey]);
		}
		array.sort(function(a, b){
			a = parseInt(a[attribute]);
			b = parseInt(b[attribute]);
			return reverse ? a - b : b - a;
		});
		return array;
	}
})

