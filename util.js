const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');

var flatfile = require('flat-file-db');
var db = flatfile.sync('./fox.db');

//var github = require('./github_helper.js');
//var util = require('./util.js')

var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
var url = "graph.facebook.com";
var path = "/v2.6/me/messages?access_token=" + CONST.page_access_token;

module.exports = {

    "add_new_user": function(user_id) {
        var newEmptyObject = {
			"user_id": user_id,
            "username": "",
            "repos": "[]",
            "stage": "NEW",
            "context": "WAITING_FOR_GITHUB_USERNAME",
            "state": "NEW"
        };
		module.exports.update_db(user_id, newEmptyObject);
        console.log("new user " + user_id + " added");
    },

    "add_recipient": function(response, recipient) {
        response.recipient = {};
        response.recipient.id = recipient;
    },

    "add_msg": function(response, message) {
        response.message = {};
        response.message.text = message;
    },

	"add_quick_reply": function(response, message, quick_replies) {
		module.exports.add_msg(response, message);
		response.message.quick_replies = quick_replies;
	},

	"add_username": function(user, username) {
		user.username = username;
		module.exports.update_db(user.user_id, user);
	},

	"update_db": function(id, object) {
		console.log(id);
		console.log(JSON.stringify(object));
		//db.del(id);
		db.put(id, object);
	}
};

module.exports.db = db;
