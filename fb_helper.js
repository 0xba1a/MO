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
var yes_no_quick_reply = [{
    "content_type": "text",
    "title": "no",
    "payload": "no"
}, {
    "content_type": "text",
    "title": "yes",
    "payload": "yes"
}];

module.exports = {
    "process_event": function(event) {
        if (!util.db.has(event.sender.id)) {
            util.add_new_user(event.sender.id);
        }

        var user = util.db.get(event.sender.id);

        switch (user.stage) {
            case "NEW":
                util.send_plain_msg(event.sender.id, "Hi sir");
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
    }
};

function converse(event)
{
	/* Work on NLP */
	var confidence = 0;
	var intent;
	//var action;
	var action_on = "";
	var msg = event.message.text;
	var sender_id = event.sender.id;
	var entities = event.message.nlp.entities;
	var user = util.db.get(sender_id);

	if (user == null) {
		console.log("converse - lost user");
		util.delete_and_startover(sender_id);
		return;
	}

	/* Testing purpose only */
	switch (event.message.text) {
		case "test_get_my_repo":
			github.get_my_repo();
			break;
	}

	if (user.context == "") {

		for (entity in entities) {
	        //if (confidence > entity.confidence) {
	        //continue;
	        //}
			console.log("entity: " + entity);
			console.log("entity-0: " + entities[entity][0].value);

	        switch (entity) {
	            case "greetings":
	                //confidence = entity.confidence;
	                intent = entity;
	                break;
	            case "action":
	                intent = entities[entity][0].value;
	                break;
	            case "agenda_entry":
	                action_on = entities[entity][0].value;
	                break;
				case "intent":
					intent = entities[entity][0].value;
					break;
				case "repo":
					action_on = entities[entity][0].value;
					break;
				case "issue":
					action_on = entities[entity][0].value;
					break;
				case "comment":
					action_on = entities[entity][0].value;
					break;
	        }
	    }
		console.log("intent: " + intent);
		console.log("action_on: " + action_on);

	    switch (intent) {
	        case "greetings":
	            send_greetings(sender_id, msg);
	            break;
	        case "create":
	            do_create(sender_id, action_on, msg);
	            break;
	        case "delete":
	            do_delete(sender_id, action_on);
	            break;
	        case "change":
	            do_change(sender_id, action_on);
	            break;
			case "cancel":
				do_cancel(sender_id);
				break;
			default:
				util.not_understood(id);
	    }
	} else {
		for (entity in entities) {
			if ((entity == "intent") && (entities[entity][0].value == "cancel")) {
				do_cancel();
				return;
			}
		}

		switch (user.context) {
			case "CREATE":
				do_create(sender_id, msg.toLowerCase(), action_on);
				break;
			case "REPO":
				create_repo(sender_id, msg);
				break;
			case "ISSUE":
				create_issue(user, msg);
				break;
			default:
		}
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
		util.delete_and_startover(sender_id);
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
				msg = "Thank you sir. I have successfully identified you";
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

	util.send_plain_msg(sender_id, msg);
}

/* Cancel current operation */
function do_cancel(id)
{
	var user = util.db.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

	user.context = user.state = "";
	user.repo = {};
	util.update_db(id, user);
}

/* Create related functions */
function do_create(id, action_on, msg)
{
	console.log("do_create - action_on: " + action_on);

	var user = util.db.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

	switch (action_on) {
		case "":
			get_what_to_create(id);
			break;
		case "repo":
			user.context = "REPO";
			user.state = "";
			util.update_db(id, user);
			create_repo(id, action_on);
			break;
		case "issue":
			user.context = "ISSUE";
			user.state = "";
			util.update_db(id, user);
			create_issue(user, "");
			break;
		case "comment":
			user.context = "COMMENT";
			user.state = "";
			util.update_db(id, user);
			create_comment(id);
			break;
		default:
			user.context = user.state = "";
			util.update_db(id, user);
			util.not_understood(id);
	}
}

function get_what_to_create(id)
{
	var user = util.db.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

	user.context = "CREATE";
	user.state = "ASKED";
	util.update_db(id, user);
	util.send_plain_msg(id, "create what?");
}

function create_repo(id, msg)
{
	console.log("create_repo - msg : " + msg);
	var user = util.db.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

	/* create repo sequence */
	switch (user.state) {
		case "":
			user.state = "NAME";
			util.update_db(id, user);
			util.send_plain_msg(id, "repo name please");
			break;
		case "NAME":
			user.state = "DESCRIPTION";
			user.repo = {"name": msg};
			util.update_db(id, user);
			util.send_plain_msg(id, "What description I should add?");
			break;
		case "DESCRIPTION":
			user.state = "CREATE_CONFIRMATION";
			user.repo.description = msg;
			util.update_db(id, user);
			var confirm_msg = "Do you want to create a repo with name " + user.repo.name + "?";
			//util.send_plain_msg(id, confirm_msg);
			//setTimeout(util.send_quick_reply(id, confirm_msg, yes_no_quick_reply), 1000);
			util.send_quick_reply(id, confirm_msg, yes_no_quick_reply);
			break;
		case "CREATE_CONFIRMATION":
			user.context = user.state = "";
			util.update_db(id, user);
			if (msg == "yes") {
				github.create_repo(id);
			} else {
				do_cancel(id);
			}
			break;
		default:
			util.delete_and_startover(id);
	}
}


function do_delete(sender_id, action_on)
{
}

function do_change(sender_id, action_on)
{
}

function create_issue(user, data)
{
	var msg;
	switch (user.state) {
		case "":
			user.state = "TITLE";
			msg = "Issue title please";
			break;
		case "TITLE":
			user.issue.title = data;
			user.state = "DESCRIPTION";
			msg = "Describe it";
			break;
		case "DESCRIPTION":
			user.issue.description = data;
			util.update_db(user.id, user);
			github.create_issue(user.id);
			return;
	}

	util.update_db(user.id, user);
	util.send_plain_msg(user.id, msg);
}

function create_comment(id)
{
}

/* utility functions */
function send_greetings(id, msg)
{
	util.send_plain_msg(id, "Hello Sir");
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

	send_post_req(response);
}
