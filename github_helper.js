const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');

var util = require('./util.js')

var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));

module.exports = {
    "verify_user": function(username) {
        var path = "/users/" + username;
        var res = github_get_req(path);
		if (res.login == username) {
            return true;
        } else {
            return false;
        }
    },

	"create_repo": function(id) {
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
		headers : {
			'Authorization' : auth,
			'Accept': '*/*'
		}
	};

	var res = https_sync("GET", "https://api.github.com", option);

	if (res.statusCode == 200) {
		return JSON.parse(res.getBody('utf8'));
	} else {
		return null;
	}
}

/*** Test Functions ***/
function test_get_my_repo()
{
	console.log("Starting test_get_my_repo");

	var username = CONST.github_username;
	var passw = CONST.github_token;
	var auth = 'Basic ' + new Buffer(username + ':' + passw).toString('base64');

	var option = {
		host : "api.github.com",
		path : "/user/repos",
		method : "GET",
		headers : {
			'Authorization' : auth,
			//'User-Agent': 'curl/7.47.0',
			'Accept': '*/*'
		}
	};

	var res = https_sync("GET", "https://api.github.com", option);

	if (res.statusCode == 200) {
		console.log(res.getBody('utf8'));
	} else {
		console.log("Error: " + res.statusCode);
	}
}
