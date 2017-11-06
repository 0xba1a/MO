const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');

var flatfile = require('flat-file-db');
var db = flatfile.sync('./fox.db');
var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
var url = "graph.facebook.com";
var path = "/v2.6/me/messages?access_token=" + CONST.page_access_token;

/** STAGES *
 * 1. NEW
 * 2. CONVERSE
 * 3. START_OVER
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
	"process_event" : function(event)
	{
		if (!db.has(event.sender.id)) {
		    add_new_user(event.sender.id);
		}

		user = db.get(event.sender.id);

		switch (user.stage) {
			case "NEW":
				send_plain_msg(event.sender.id, "Hi sir");
			case "START_OVER":
				/* get Github username */
				get_github_username(event);
				break;
			case "CONVERSE":
				break;
			default:
				delete_and_startover(event.sender.id);
		}
	}
};

function delete_and_startover(user_id)
{
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
}

function get_github_username(event)
{
	var user;
	var res = {};
	var sender_id = event.sender.id;
	var msg;
	
	if (db.has(sender_id)) {
	    user = db.get(sender_id);
	} else {
		// FATAL!
		return;
	}

	switch (user.state) {
		case "NEW":
			msg = "please provide your Github username";
		    user.context = "WAITING_FOR_GITHUB_UNAME";
		    user.state = "ASKED";
		    break;
		case "ASKED":
		case "NOT_FOUND":
			var username = event.message.text;
			if (verify_and_add_user(username)) {
				msg = "I have successfully identified you";
				user.username = username;
				user.stage = "CONVERSE";
				user.context = user.state = "";
			} else {
				msg = "Sorry. I can't find you sir. Please give proper username";
				user.state = "NOT_FOUND";
			}
	}

	send_plain_msg(sender_id, msg);
}

function verify_and_add_user(username)
{
	var path = "/users/" + username;
	var res = github_get_req(path);
	if (res != null) {
	    return true;
	} else {
	    return false;
	}
}

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

	//req.on("error") {
		//return null;
	//}

	//req.on("end");
}

function send_plain_msg(id, msg)
{
	var res = {};
	add_recipient(res, id);
	add_msg(res, msg);
	send_post_req(url, res);
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

function add_recipient(response, recipient)
{
	response.recipient = {};
	response.recipient.id = recipient;
}

function add_msg(response, message)
{
	response.message = {};
	response.message.text = message;
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

function add_new_user(userId)
{
	/* else add this new user */
	var newEmptyObject = {
		"username" : "",
		"repos" : "[]",
		"stage" : "NEW",
		"context" : "WAITING_FOR_GITHUB_USERNAME",
		"state" : "NEW"
	};

	db.put(userId, newEmptyObject);
	console.log("new user " + userId + " added");
}
