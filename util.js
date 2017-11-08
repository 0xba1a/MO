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

    "add_new_user": function(userId) {
        var newEmptyObject = {
            "username": "",
            "repos": "[]",
            "stage": "NEW",
            "context": "WAITING_FOR_GITHUB_USERNAME",
            "state": "NEW"
        };
        db.put(userId, newEmptyObject);
        console.log("new user " + userId + " added");
    },

    "delete_and_startover": function(user_id) {
        var user;

        if (!db.has(user_id)) {
            /* Not possible */
            return;
        } else {
            user = db.get(user_id);
        }

        var msg = "Sorry sir. I forget you. Lets startover";
        send_plain_msg(user_id, msg);

        user.stage = "START_OVER";
        msg = "Hii sir";
        send_plain_msg(user_id, msg);
    },

    "add_recipient": function(response, recipient) {
        response.recipient = {};
        response.recipient.id = recipient;
    },

    "add_msg": function(response, message) {
        response.message = {};
        response.message.text = message;
    }
};
