const fs = require('fs');
const https = require('https');
const https_sync = require('sync-request');
const exec = require('child_process').exec;

var util = require('./util.js');

var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));

module.exports = {
    "verify_user": function(username) {
        var path = "/users/" + username;
        var res = github_get_req(path);
		//console.log("res: " + JSON.stringify(res));
		if ((res != null) && (res.login == username)) {
            return true;
        } else {
            return false;
        }
    },

	"create_repo": function(id) {
		console.log("Github - create_repo: ");

		var user = util.db.get(id);
		if (user == null) {
			return null;
		}

		var req = {
			"name": user.repo.name,
			"description": user.repo.description,
			"private": false
		};

		github_post_req(id, "/user/repos", req);
		//github_setup_environment(id, user.repo.name);
	},

	"create_issue": function(id) {
		var user = util.db.get(id);
		if (user == null) {
			util.delete_and_startover(id);
			return;
		}

		var path = "/repos/l-fox/" + user.current_repo + "/issues";
		var data = {};
		data.title = user.issue.title;
		data.description = user.issue.description;
		github_post_req(id, path, data);
	},

	"add_comment": function(id) {
		var user = util.db.get(id);
		if (user == null) {
			util.delete_and_startover(id);
			return;
		}

		var path = "/repos/l-fox/" + user.current_repo + "/issues/" + user.comment.on_issue + "/comments";
		var data = {};
		data.body = user.comment.comment + " - " + user.username;
		github_post_req(id, path, data);
	},
	
	"get_my_repo" : function() {
		test_get_my_repo();
	}
};

//function github_setup_environment(id, repo_name)
//{
	//github_add_webhook(id, repo_name);
	////github_clone_repo(repo_name);
//}

function github_clone_repo(user, repo_name)
{

    /* run expect script */
	var cmd = "sh ./scripts/new_repo.sh " + repo_name + " " + CONST.rsa_passcode;
	exec('cmd', function(err, stdout, stderr) {
		//TODO: catch failure
	});

    msg = "done. You can clone the repo from " + user.repo.github_url;
    util.send_plain_msg(user.user_id, msg);

    /* Clear repo states */
    user.context = user.state = "";
    user.current_repo = user.repo;
    user.repo = {};
    util.update_db(user);
}

function github_add_webhook(id, repo_name)
{
	var path = "/repos/l-fox/" + repo_name + "/hooks";
	var data = {};
	data.name = "web";
	data.config = {};
	data.active = true;

	var user = util.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

    user.state = "WEBHOOK_SETUP";
    util.update_db(id, user);

	/* config configuration */
	data.config.url = "https://eastrivervillage.com:3003/github_hook";
	data.config.content_type = "json";

	github_post_req(id, path, data);
}

function github_post_req(id, path, obj)
{
    var username = CONST.github_username;
    var passw = CONST.github_token;
    var auth = 'Basic ' + new Buffer(username + ':' + passw).toString('base64');

    var options = {
        host: "api.github.com",
        path: path,
        method: "POST",
        headers: {
            'Authorization': auth,
            'User-Agent': 'curl/7.47.0',
            'Accept': '*/*'
        }
    };

    var req = https.request(options, function(res, err) {
        var data = "";

        if (err) {
            console.error("github_post_req - error :" + err);
			util.send_plain_msg(this.id, "Sorry. I couldn't complete the operation");

            var user = util.db.get(this.id);
            if (user == null) {
                util.delete_and_startover(this.id);
                return;
            }

			user.repo = user.issue = user.comment = {};
			util.update_db(this.id, user);
            return;
        }

        //console.log("github - https.request: " + data);
        //var json_obj = JSON.parse(data);
        //user.repo.github_url = json_obj.github_url;
        //util.update_db(this.id, user);

        //var msg = "repo created successfully. you can clone it from " + json_obj.github_url;
        //fb.send_plain_msg(this.id, msg);

        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
                    console.log("github_post_req - data: " + data);

                    var user = util.db.get(this.id);
                    if (user == null) {
                        util.delete_and_startover(this.id);
                        return;
                    }

                    var json_obj = JSON.parse(data);
                    if (user.context == "REPO") {
                        user.repo.github_url = json_obj.git_url;
                        util.update_db(this.id, user);

                        if (user.state == "CREATE_CONFIRMATION") {
                            var msg = "repo created successfully. Adding you as a collaborator";
                            util.send_plain_msg(this.id, msg);

                            github_add_collaborator(user.repo.name, id);
                        } else if (user.state == "WEBHOOK_SETUP") {
							var msg = "done. cloning the repo";
							util.send_plain_msg(user.user_id, msg);
							github_clone_repo(user, user.repo.name);
                        }
                    } else if (user.context == "ISSUE") {
                        util.send_plain_msg(this.id, "Issue #" + json_obj.number + " created successfully");
                        user.issue = {};
                        user.context = user.state = "";
                        util.update_db(this.id, user);
                    } else if (user.context == "COMMENT") {
				util.send_plain_msg(this.id, "comment added");
				user.context = user.state = "";
				util.update_db(this.id, user);
			}

		}.bind({
            "id": this.id
        }));

    }.bind({
        "id": id
    }));

    req.on('error', function(e) {
        console.log(`problem with request: ${e.message}`);
    });

    req.write(JSON.stringify(obj));
    req.end();
}

function github_add_collaborator(repo_name, id)
{
	var user = util.db.get(id);
	if (user == null) {
		util.delete_and_startover(id);
		return;
	}

	user.state = "ADD_COLLABORATOR";

	var path = "/repos/l-fox/" + repo_name + "/collaborators/" + user.username;
	github_put_req(id, path, "");
}

function github_put_req(id, path, data)
{
    var username = CONST.github_username;
    var passw = CONST.github_token;
    var auth = 'Basic ' + new Buffer(username + ':' + passw).toString('base64');

    var options = {
        host: "api.github.com",
        path: path,
        method: "PUT",
        headers: {
            'Authorization': auth,
            'User-Agent': 'curl/7.47.0',
            'Accept': '*/*',
            'Content-length': data.length
        }
    };

    var req = https.request(options, function(res, err) {
        var data = "";

        if (err) {
            console.error("github_post_req - error :" + err);
            return;
        }

        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
            console.log("github_put_req - data: " + data);

            var user = util.db.get(this.id);
            if (user == null) {
                util.delete_and_startover(this.id);
                return;
            }

            var json_obj = JSON.parse(data);

            if ((user.context == "REPO") && (user.state == "ADD_COLLABORATOR")) {
                var added_username = json_obj.invitee.login;

                if (added_username == user.username) {
                    var msg = "Done! Please accept collaborator request in your github account";
                    util.send_plain_msg(this.id, msg);

                    setTimeout(function() {
                    	var msg = "setting up webhooks";
                        util.send_plain_msg(this.id, msg);
                        //github_setup_environment(this.id, user.repo.name);
						github_add_webhook(this.id, this.user.repo_name);
                    }.bind({
                        "id": this.id,
						"user": user
                    }), 1000);

                    /* Clear repo states */
                    //user.context = user.state = "";
                    //user.current_repo = user.repo;
                    //user.repo = {};
                    //util.update_db(user);
                } else {
                    var msg = "Error during adding you as a collaborator. Retrying...";
                    //TODO: Add retry mechanism with limit and delete repo if retry fails
                    util.send_plain_msg(this.id, msg);
                }
            }

        }.bind({
            "id": this.id
        }));

    }.bind({
        "id": id
    }));

    req.on('error', function(e) {
        console.log(`problem with request: ${e.message}`);
    });

    req.write(JSON.stringify(data));
    req.end();
}

function github_get_req(path)
{
	var username = CONST.github_username;
	var passw = CONST.github_token;
	var auth = 'Basic ' + new Buffer(username + ':' + passw).toString('base64');

	var option = {
		host : "api.github.com",
		path : path,
		method : "GET",
		headers : {
			'Authorization' : auth,
			'User-Agent': 'curl/7.47.0',
			'Accept': '*/*'
		}
	};

	var res = https_sync("GET", "https://api.github.com" + path, option);

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
