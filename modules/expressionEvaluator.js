
/**
 TODO

 MAKE THIS A UTILITY OF THE CLIDB PROJECT
 */

var tv4 = require('tv4');
tv4.addSchema(require('../public/schemas/api'));

module.exports = function(db) {

	var QID = 0;
	
	/*
	 * maintain the previous one result
	 */
	var editStore = {
		
		schema: {},
		obj: {}
	}

	/*
	 * instances are cached in classes, directly accessible through the data object
	 */
	var service = { data: {} };

	/* 
	 * Evaluate a ' ' delimied command expression (quotes accepted as one term)
	 * tags the resulting command/query with a session-unique id
	 * callbacks are indexed via this id
	 */	
	service.commands = {};

	/*
	 * callbacks are indexed in the callbacks dictionary via the unique command id
	 */
	var callbacks = {};


	service.resolveToString = function(x, cb) {

		try {

		var x = x,
			aborted = false,
			completed = false;

		var inners = extractSectionsinCurlys(x),
			outers = extractSectionsinCurlys(x, true);

		if (outers) {

			var replace = {};

			for (var i = 0; i < outers.length; i++) {
				replace[inners[i]] = outers[i];
			}

			for (var r in replace) {		
				(function(inner, outer) {
					service.eval(inner, function(err, result) {
						if (err) {
							if (cb) cb(err, null);
							return abort();
						}
						x = x.replace(new RegExp(inner, "g"), result);
						delete replace[inner];
						for (var j in replace) return;
						cb(null, x);
					}, ++QID); // <-- ensure we don't use same id
				})(r, replace[r]);
			}
		}

		else cb(null, x);

		} catch (e) {

			cb(e, null);
			return abort();
		}

		function abort() {
			var aborted = true;
		}
		
	}

	/**
	 * parse a command string (async)
	 * resolve parts within {} recursively
	 * split by ' ' space char
	 * first word is the command method id,
	 * remaining words are the parameters, described by api.json
	 */
	service.eval = function(x, cb, qid) {

		try {

		var x = x,
			aborted = false,
			completed = false;

		if (!qid) qid = getuid();

		var inners = extractSectionsinCurlys(x),
			replacers = extractSectionsinCurlys(x, true),
			results = {};

		if (replacers) for (var i = 0; i < replacers.length; i++) {

			var key = '$REPLACE$' + i;
			x = x.replace(replacers[i], key);
		}

		var parts = splitWhiteSpaceOutsideQuotes(x),
			cmd = parts.shift();

		if (replacers) for (var i = 0; i < replacers.length; i++) {		
			(function(y, key, index, results, callback) {
				service.eval(y, function(err, result) {
					inners[index] = undefined;
					if (err) {
						if (callback) callback(err, null);
						return abort();
					}
					results[key] = result;
					complete();
				}, getuid())
			})(inners[i], '$REPLACE$' + i, i, results, cb);
		}

		} catch (e) {

			cb(e, null);
		}

		function complete() {
			if (aborted || completed) return;
			for (var i in inners) if (inners[i]) return;
			for (i =  0; i < parts.length; i++) {
				var key = parts[i],
					result = results[parts[i]];
				if (result) {
					try { 
						result = JSON.parse(results[parts[i]])
					} catch (e) {
						result = results[parts[i]];
					}
					parts[i] = result;
				}
			}
			completed = true;
			service.exec(cmd, parts, cb, qid);			
		}

		complete();

		function abort() {
			var aborted = true;
		}

		return qid;
	}

	/**
	 * execute the specified command
	 * give the command an id if not provided
	 */
	service.exec = function(cmd, args, cb, qid) {

		//console.log('[expressionEvaluator] executing', cmd, args, 'a callback', qid);
		
		if (!qid) qid = getuid();

		var str = [cmd].concat(args.slice(0, args.length)).join(' ');
		
		/* index a generated callback 
		 * don't index commands with passed in callbacks, so we don't spam the console */
		if (!cb) service.commands[qid] = {cmd: str, idx: qid};
		callbacks[qid] = cb ? cb : service.callbacks[cmd];

		applyCommand(cmd, args, qid, cb);

		return qid;
	}

	/**
	 * when applying the command, make sure the api schema is satisfied
	 * otherwise notify of the error
	 */
	function applyCommand(cmd, args, id, cb) {

		var op = service.api[cmd],
			schm = tv4.getSchema('#'+cmd);

		//console.log('expressionEvaluator applycmd', cmd, Boolean(op), schm, args);

		if (op && schm && tv4.validate(args, schm)) { // <-- won't validate zero alength arrays
			
			args.push(id); // <-- ??
			op.apply(applyCommand, args);
		
		} else {
		
			var err = schm && tv4.error ?
				 tv4.error.message : 'unknown command : '+ cmd;
			linkCallback(err, null, id);
		}

		return id;
	}

	/**
	 * link async results to cached commands and their callbacks
	 */
	function linkCallback(err, reply, qid) {
	
		if (callbacks[qid]) {
			callbacks[qid](err, reply, qid);
			delete callbacks[qid];
	
		} else if (service.commands[qid]) {
			service.commands[qid].err = err;
			service.commands[qid].reply = reply;
		}
	}


	/**
	 * create a minimal instance described by a schema
	 */
 	function create(s) {

 		if (!s) return null
 		else if (s.type=='array') return [create(s.items)];
 		else if (s.type=='array') return [];
		else if (s.type=='object'){
			var r = {};
			for (var p in s.properties){
				
				if (s.properties[p].type=='object') r[p] = create(s.properties[p]);
				else if (s.properties[p].type=='number') r[p] = 0;
				else if (s.properties[p].type=='array') r[p] = create(s.properties[p]);
				else if (s.properties[p].type=='string') r[p]='';
				else if (s.properties[p].$ref && tv4.getSchema(s.properties[p].$ref)) r[p] = create(tv4.getSchema(s.properties[p].$ref));
				else r[p] = null;
				//else if schemas[s.properties[p].type] r[p] = create(schemas[s.properties[p].type]); // <-- search referenced schemas here
			}
			return r
		} 
		else return '';	
	}

	/*
	 * expose the create method
	 */
	service.create = create;


	/*
	 * the api methods
	 */
	service.api = {

		get : function(classkey, itemkey, qid) {
			db.getitem(classkey, itemkey, function(err, result) {
				linkCallback(err, result, qid);
			});
		},

		getp : function(classkey, itemkey, addr, qid) {
			db.getitem(classkey, itemkey, function(err, item) {
				console.log('[expressionEvaluator] getp', item);
				try { var result = JSON.parse(item); } catch (e) {
					result = item;
				}
				var path = addr.split('.');
				while (path.length && result && !err) {
					result = result[path.shift()];
				}
				linkCallback(result ? err : 'invalid address '+addr, result, qid);
			});
		},

		dlt : function(classkey, itemkey, qid) {
			db.deleteitem(classkey, itemkey, function(err, result) {
				linkCallback(err, result, qid);
			});
		},

		set : function(classkey, itemkey, value, qid) {
			db.setitem(classkey, itemkey, value, function(err, result) {
				linkCallback(err, result, qid);
			});
		},

		new : function(classkey, qid) {
			var schm = tv4.getSchema(classkey);
			if (!schm) return linkCallback('unable to find definition '+classkey, null, qid);
			var instance = create(schm);
			if (!instance) return linkCallback('error generating new  '+classkey, null, qid);
			linkCallback(null, instance, qid);
		},

		getclass : function(classkey, qid) {
			db.getclass(classkey, function(err, result) {
				linkCallback(err, result, qid);
			});
		},

		schema : function(schemaName, qid) {
			var schema = tv4.getSchema(schemaName);
			linkCallback(tv4.error ? tv4.error : schema ? null : 'unknown schema id', schema, qid); // <-- will tv4 throw this error for us?
		},

		result : function(qid) {
			linkCallback(null, editStore.obj, qid);
		}
	}

	/*
	 * respective callbacks for api methods 
	 * (these are all very similar, but some are different)
	 */
	service.callbacks = {

		get :  function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			editStore.obj = result;
			service.commands[id].err = err;
		},

		getp : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		dlt : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		set : function(err, result, id) {
			try { service.commands[id].reply = angular.fromJson(result); } catch (e) {
				service.commands[id].reply = result;
			}
			editStore.obj = result;
			service.commands[id].err = err;
		},

		new : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		list : function(err, result, id) {
			var reply = [],
				list = parseJSONArray(result);
			for (var key in list) reply.push(key);
			editStore.obj = result;
			service.commands[id].reply = reply;
			service.commands[id].err = err;
		},

		schema : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		help : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;
		},

		edit : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;			
		},

		result : function(err, result, id) {
			editStore.obj = result;
			service.commands[id].reply = result;
			service.commands[id].err = err;			
		},
	}

	return service;

}



/**
 * remove Boolean(val)==false elements from array and collaps down
 */
function compressList(source) {

	var temp = [];
	for(var i in source) source[i] && temp.push(source[i]); 
	angular.copy(temp,source);
}

/**
 * parse an array of json objects and return an array of objects        
 */
function parseJSONArray(source) {
	
	var result = {};
	for (var key in source) result[key] = JSON.parse(source[key]);
	return result;
}


/**
 * split by space char, allowing for full strings inside quotes 
 * http://stackoverflow.com/questions/10530532/regexp-to-split-by-white-space-with-grouping-quotes
 */
 function splitWhiteSpaceOutsideQuotes(x) {

	var parts = [];
	x.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function(g0, g1, g2, g3) {
		parts.push(g1 || g2 || g3 || '');
	});	
	return parts;
}

/**
 * does not support nesting
 */
function extractSectionsinCurlys(x, keepCurlys) {

	if (keepCurlys) return x.match(/{([^}]+)}/g);
	else return x.match(/[^{}]+(?=\})/g);
}


function addSchema(schema) {
	
	tv4.addSchema(id, schema);
	for (var def in schema.definitions) {
		tv4.addSchema(def,schema.definitions[def]);
	}
	if (qid) linkCallback(err, schema, qid);
}


var qidcntr = 0;

function getuid() {

	if (qidcntr > 1000000000) qidcntr = 0;
	return qidcntr++;
}


