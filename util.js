const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');
const exec = require('child_process').exec;

var flatfile = require('flat-file-db');
var db = flatfile.sync('./fox.db');

var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
var fb_url = "graph.facebook.com";
var path = "/v2.6/me/messages?access_token=" + CONST.page_access_token;

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

    "add_new_user": function(user_id) {
        var newEmptyObject = {
            "user_id": user_id,
            "username": "",
            "current_repo": null,
            "repos": "[]",
            "stage": "NEW",
            "context": "WAITING_FOR_GITHUB_USERNAME",
            "state": "NEW",
            "repo": {},
            "issue": {},
            "comment": {}
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
    },

    /* Facebook communication functions */
    "send_post_req": function(message) {
        console.log("sending request: " + JSON.stringify(message));

        var options = {
            hostname: fb_url,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        console.log("sending response: " + JSON.stringify(options));

        var req = https.request(options, function(err, res, body) {});

        req.on('error', function(e) {
            console.log(`problem with request: ${e.message}`);
        });

        req.write(JSON.stringify(message));
        req.end();
    },

    "send_plain_msg": function(id, msg) {
        //TODO: Add message type. Mandatory from May/2018
        var res = {};
        module.exports.add_recipient(res, id);
        module.exports.add_msg(res, msg);
        module.exports.send_post_req(res);
    },

    "send_quick_reply": function(id, msg, quick_replies) {
        var res = {};
        module.exports.add_recipient(res, id);
        module.exports.add_quick_reply(res, msg, quick_replies);
        module.exports.send_post_req(res);
    },

    "not_understood": function(id) {
        module.exports.send_plain_msg(id, "Sorry sir. I'm yet to evolve for your sophisticated language");
    },

    "delete_and_startover": function(user_id) {
        if (!db.has(user_id)) {
            /* Not possible. yet */
            util.add_new_user(user_id);
        }

        var user = db.get(user_id);
        var msg = "Sorry sir. I forget you. Lets startover";
        module.exports.send_plain_msg(user_id, msg);

        user.stage = "START_OVER";
        user.context = user.state = "NEW";
        module.exports.update_db(user_id, user);
        msg = "Hii sir";
        module.exports.send_plain_msg(user_id, msg);
    },

    "get_user": function(username) {
        for (key in db.keys()) {
            user = db.get(key);
            if (user.username == username) {
                return user;
            }
        }

        return null;
    },

    "add_commit": function(user, repo, commit_id, commit_msg) {

		if (user.repos[repo].commits == null) {
			user.repos[repo].commits = [];
		}

		var commit_obj = {"id": commit_id, "msg": commit_msg};
		user.repos[repo].commits.push(commit_obj);

		if (user.context == "ASK_FOR_ISSUE_CLOSURE") {
			//Do nothing if user didn't answer for previous question
			return;
		}
		else {
		    //TODO: Verify there are open issues
		    var msg = "You recently made new commits. Do they fix any issues?";
		    module.exports.send_quick_reply(user.user_id, msg, yes_no_quick_reply);
		    user.context = "ASK_FOR_ISSUE_CLOSURE";
		    module.exports.update_db(user.user_id, user);
		}

    },

    "pull_repo": function(repo) {
        var cmd = "sh ~/MO/scripts/repo_pull.sh " + repo + " " + CONST.rsa_passcode;
        exec(cmd, function(err, stdout, stderr) {
            //TODO: catch failure
            console.log("stdout: " + stdout);
            console.log("stderr: " + stderr);
        });
    },

	"clear_commits": function(user) {
		if (user.current_repo == null) {
			//can't possible - FATAL
		}

		user.context = "";
		user.repos[user.current_repo].commits = null;
		module.exports.update_db(user.user_id, user);
	}
};

module.exports.db = db;
