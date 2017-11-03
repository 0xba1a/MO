const fs = require('fs');
const https = require('https');

var flatfile = require('flat-file-db');
var db = flatfile.sync('./fox.db');
var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
var url = "graph.facebook.com";
var path = "/v2.6/me/messages?access_token=" + CONST.page_access_token;

module.exports = {
	"processEvent" : function(event) {
		addIfNewUser(event.sender.id);
		sendResponse(event);
	}
};

function sendResponse(event) {
	var response = {};
	addRecipient(response, event.sender.id);

	switch (event.message.text.toLowerCase()) {
		case "hi":
		case "hello":
			addMessage(response, "hello sir");
			break;

	}

	sendPostReq(url, response);
}

function addRecipient(response, recipient) {
	response.recipient = {};
	response.recipient.id = recipient;
}

function addMessage(response, message) {
	response.message = {};
	response.message.text = message;
}

function sendPostReq(url, message) {
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

	req.on('error', (e) ==> {
		console.log(`problem with request: ${e.message}`);
	});

	req.write(JSON.stringify(message));
	req.end();
}

function addIfNewUser(userId) {
	if (db.has(userId)) {
		//do nothing
		return;
	}

	/* else add this new user */
	var newEmptyObject = {
		"username" : "",
		"repos" : "[]"
	};

	db.put(userId, newEmptyObject);
	console.log("new user " + userId + " added");
}
