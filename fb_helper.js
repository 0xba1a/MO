const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');

var github = require('./github_helper.js');
var util = require('./util.js')

var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
var fb_url = "graph.facebook.com";
var path = "/v2.6/me/messages?access_token=" + CONST.page_access_token;

/** STAGES *
 * 1. NEW
 * 2. GITHUB_INIT
 * 3. CONVERSE
 * 4. START_OVER
 */

/** CONTEXT & STATES *
 * 1. REPO
 * 	a. NAME
 * 	b. DESCRIPTION
 * 	c. DELETE_CONFIRMATION
 * 2. ISSUE
 * 	a. DESCRIPTION
 * 	b. CLOSE_COMMENT
 * 3. COMMENT
 * 	a. COMMENT
 * 	b. ISSUE_NUMBER
 * 4. WAITING_FOR_GITHUB_USERNAME
 * 	a. NEW
 * 	b. ASKED
 * 	c. NOT_FOUND
 */

module.exports = {
    "process_event": function(event) {
        if (!util.db.has(event.sender.id)) {
            util.add_new_user(event.sender.id);
        }

        var user = util.db.get(event.sender.id);

        switch (user.stage) {
            case "NEW":
                module.exports.send_plain_msg(event.sender.id, "Hi sir");
			case "GITHUB_INIT":
            case "START_OVER":
                /* get Github username */
				//TODO: delay this message
                get_github_username(event);
                break;
            case "CONVERSE":
				converse(event);
                break;
            default:
                util.delete_and_startover(event.sender.id);
        }
    },

    "send_plain_msg": function(id, msg) {
        var res = {};
        util.add_recipient(res, id);
        util.add_msg(res, msg);
        send_post_req(fb_url, res);
    }
};

function converse(event)
{
	/* Test purpose */
	switch (event.message.text) {
		case "test_get_my_repo":
			github.get_my_repo();
			break;
	}
}

function get_github_username(event)
{
	var user;
	var res = {};
	var sender_id = event.sender.id;
	var msg;
	
	if (util.db.has(sender_id)) {
	    user = util.db.get(sender_id);
	} else {
		// FATAL!
		return;
	}

	switch (user.state) {
		case "NEW":
		    msg = "please provide your Github username";
			user.stage = "GITHUB_INIT";
		    user.context = "WAITING_FOR_GITHUB_UNAME";
		    user.state = "ASKED";
			util.update_db(sender_id, user);
		    break;
		case "ASKED":
		case "NOT_FOUND":
			var username = event.message.text;
			if (github.verify_user(username)) {
				util.add_username(user, username);
				msg = "I have successfully identified you";
				user.username = username;
				user.stage = "CONVERSE";
				user.context = user.state = "";
				util.update_db(sender_id, user);
			} else {
				msg = "Sorry. I can't find you sir. Please give proper username";
				user.state = "NOT_FOUND";
				util.update_db(sender_id, user);
			}
	}

	module.exports.send_plain_msg(sender_id, msg);
}

function send_response(event)
{
	var response = {};
	add_recipient(response, event.sender.id);

	switch (event.message.text.toLowerCase()) {
		case "hi":
		case "hello":
			add_msg(response, "hello sir");
			break;
		default:
			add_msg(response, "Sorry! I'm yet to evelove for your complex language");

	}

	send_post_req(url, response);
}

function send_post_req(url, message)
{
	console.log("sending request: " + JSON.stringify(message));

	var options = {
		hostname : url,
		port : 443,
		path : path,
		method : 'POST',
		headers : {
			'Content-Type' : 'application/json'
		}
	};

	console.log("sending response: " + JSON.stringify(options));

	var req = https.request(options, function(err, res, body) {
	});

	req.on('error', function(e) {
		console.log(`problem with request: ${e.message}`);
	});

	req.write(JSON.stringify(message));
	req.end();
}
