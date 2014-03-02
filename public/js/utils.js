utils = {

	days: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
	months: ['January','February','March','April','May','June','July','August','September','October','November','December'],

	formatDisplayDate: function(utcms) {

		var d = new Date(utcms);
		return d.getHours()+':'+d.getMinutes()+' '+this.days[d.getDay()]+' '+this.months[d.getMonth()]+' '+d.getFullYear();
	},

	/**
	 * remove Boolean(val)==false elements from array and collaps down
	 */
	compressList: function(source) {

		var temp = [];
		for(var i in source) source[i] && temp.push(source[i]); 
		angular.copy(temp,source);
	},

	/**
	 * parse an array of json objects and return an array of objects        
	 */
	parseJSONArray: function(source) {
		
		var result = {};
		for (var key in source) result[key] = JSON.parse(source[key]);
		return result;
	},


	/**
	 * split by space char, allowing for full strings inside quotes 
	 * http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
	 */
	splitWhiteSpaceOutsideQuotes : function(x) {

		var parts = [];
		x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0, g1, g2, g3) {
			parts.push(g1 || g2 || g3 || '');
		});	
		return parts;
	},

	/**
	 * does not support nesting
	 */
	extractSectionsinCurlys : function(x, keepCurlys) {

		if (keepCurlys) return x.match(/{([^}]+)}/g);
		else return x.match(/[^{}]+(?=\})/g);
	}

	getUid : function() {
		var n = Date.now();
		if (this.last != n) {
			this.last
			return n.toString()+'.0'
		} 
	}

}