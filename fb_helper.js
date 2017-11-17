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
			return;
		case "test_db":
			console.log(JSON.stringify(util.db.keys()));
			var keys = util.db.keys();
			for (i = 0; i < keys.length; i++) {
				console.log("key: " + keys[i]);
			}
			return;
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
				util.not_understood(sender_id);
	    }
	} else {
		for (entity in entities) {
			if ((((entity == "intent") || (entity == "action")) &&
						(entities[entity][0].value == "cancel")) ||
						(entity == "cancel")) {
				do_cancel(sender_id);
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
			case "COMMENT":
				create_comment(user, msg);
				break;
			case "ASK_FOR_ISSUE_FIX":
				if (msg == "yes") {
					take_commit_and_ask_for_fix(user);
				}
				else {
					util.clear_commits(user);
				}
				break;
			case "ASKING_COMMITS":
			    solve_issue_with_commit(user, msg);
				break;
			default:
		}
	}
}

function solve_issue_with_commit(user, msg)
{
	switch (user.state) {
		case "ASKED":
		    if (msg == "yes") {
		        util.send_plain_msg(user.user_id, "which issue it solves?");
		        user.state = "ISSUE_NUMBER_ASKED";
		        util.update_db(user.user_id, user);
		    } else {
		        user.repos[current_repo].commits.splice(0, 1);
		        if (user.repos[current_repo].commits.length == 0) {
		            user.repos[current_repo].commits = null;
					user.context = user.state = "";
					util.update_db(user.user_id, user);
		        } else {
		            take_commit_and_ask_for_fix(user);
		        }
		    }
		    break;
		case "ISSUE_NUMBER_ASKED":
			if (isNaN(msg)) {
				util.send_plain_msg(user.user_id, "provide only the issue number");
				return;
			}

			user.issue.number = msg;
			user.state = "CLOSE_COMMENT_ASKED";
			util.update_db(user.user_id, user);
			util.send_plain_msg(user.user_id, "provide close description");
			break;
		case "CLOSE_COMMENT_ASKED":
			user.issue.close_comment = msg;
			user.state = "CLOSE_ISSUE";
			util.update_db(user.user_id, user);
			//send a call-back and call it from github function
			//the call-back should call take_commit_and_ask_for_fix()
			github.close_issue(user.user_id);
			break;
	}
}

function take_commit_and_ask_for_fix(user)
{
	var commits = user.repos[user.current_repo].commits;

	if (commits == null) {
		// end of recursive call
		return;
	}

	user.context = "ASKING_COMMITS";
	user.state = "ASKED";
	util.update_db(user.user_id, user);

	var commit = commits[0];
	var msg = "Does the commit with commit message \"" + commit.msg + "\" solve an issue?";
	util.send_quick_reply(user.user_id, msg, yes_no_quick_reply);
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
			setTimeout(function() {
				util.send_plain_msg(this.id, msg);
			}.bind( {"id": sender_id, "msg": msg}), 1000 );
			return;
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
	console.log ("Cancelling current operation");

	var user = util.db.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

	user.context = user.state = "";
	user.repo = {};
	user.issue = {};
	user.comment = {};
	util.update_db(id, user);

	util.send_plain_msg(id, "cancelled the current operation sir");
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
			create_comment(user, "");
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
			var confirm_msg = "Do you want to create a new repo with name " + user.repo.name + "?";
			//util.send_plain_msg(id, confirm_msg);
			//setTimeout(util.send_quick_reply(id, confirm_msg, yes_no_quick_reply), 1000);
			util.send_quick_reply(id, confirm_msg, yes_no_quick_reply);
			break;
		case "CREATE_CONFIRMATION":
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
	        if (user.current_repo != null) {
	            user.state = "TITLE";
	            msg = "Issue title please";
	        } else {
	            user.state = "SET_REPO";
	            msg = "On which repo?";
	        }
	        break;
		case "SET_REPO":
			user.state = "";
			user.current_repo = data;
			util.update_db(user.user_id, user);
			create_issue(user, "");
			return;
		case "TITLE":
			user.issue.title = data;
			user.state = "DESCRIPTION";
			msg = "Describe it";
			break;
		case "DESCRIPTION":
			user.issue.description = data;
			util.update_db(user.user_id, user);
			github.create_issue(user.user_id);
			return;
	}

	util.update_db(user.user_id, user);
	util.send_plain_msg(user.user_id, msg);
}

function create_comment(user, data)
{
	var msg;

	switch (user.state) {
		case "":
			if (user.current_repo != null) {
				user.state = "ISSUE_NO";
				msg = "issue number please";
	        } else {
	            user.state = "SET_REPO";
	            msg = "On which repo?";
	        }
			break;
		case "SET_REPO":
			user.state = "";
			user.current_repo = data;
			util.update_db(user.user_id, user);
			create_comment(user, "");
			return;
		case "ISSUE_NO":
			if (isNaN(data)) {
				msg = "please provide a valid integer represents issue number";
				break;
			}
			user.comment.on_issue = data;
			msg = "you comment please";
			user.state = "COMMENT";
			break;
		case "COMMENT":
			user.comment.comment = data;
			util.update_db(user.user_id, user);
			github.add_comment(user.user_id);
			return;
	}

	util.update_db(user.user_id, user);
	util.send_plain_msg(user.user_id, msg);
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
