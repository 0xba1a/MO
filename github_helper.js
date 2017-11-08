const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');

var flatfile = require('flat-file-db');
var db = flatfile.sync('./fox.db');

var util = require('./util.js')

var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));

module.exports = {
    "verify_user": function(username) {
        var path = "/users/" + username;
        var res = github_get_req(path);
        if (res != null) {
            return true;
        } else {
            return false;
        }
    },
	
	"get_my_repo" : function() {
		test_get_my_repo();
	}
};

function github_get_req(path)
{
	var option = {
		host : "api.github.com",
		path : path,
		method : "GET"
	};

	var res = https_sync("GET", "https://api.github.com", option);

	if (res.statusCode == 200) {
		return true;
	} else {
		return false;
	}
}

/*** Test Functions ***/
function test_get_my_repo() {
	console.log("Starting test_get_my_repo");

	var option = {
		host : "api.github.com",
		path : "/user/repos",
		method : "GET"
		headers : {
			"Authorization" : "token " + CONST.github_token
		}
	};

	var res = https_sync("GET", "https://api.github.com", option);

	if (res.statusCode == 200) {
		console.log(res.getBody());
	} else {
		console.log("Error: " + res.statusCode);
}
