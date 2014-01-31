module.exports = function(expressApp) {
	var www = require('path').normalize(__dirname+'/../public');
	expressApp.use(require('express').static(www));
}