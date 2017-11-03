const fs = require('fs');
var flatfile = require('flat-file-db');
var db = flatfile.sync('./fox.db');
var CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
var url = "https://graph.facebook.com/v2.6/me/messages?access_token=" + CONST.page_access_token;

module.exports = {
	function processEvent(event) {
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
	console.log("sending request: " + message);

	var options = {
		url : url,
		method : 'POST',
		headers : {
			'Content-Type' : 'application/json'
		},
		json: message
	};

	request(options, function(err, res, body) {
		if (err) {
			console.log("post request failed");
		}
	});
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
