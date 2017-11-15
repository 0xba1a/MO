'use strict';

var PORT = 5003;
var CONST;

const
	express = require('express'),
	bodyParser = require('body-parser'),
	fs = require('fs'),
	app = express().use(bodyParser.json()),
	fb = require('./fb_helper.js');

app.listen(PORT, function() {
	CONST = JSON.parse(fs.readFileSync("./secret.json", 'UTF-8'));
	console.log("Listening");
});

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhookEvent = entry.messaging[0];
      console.log(JSON.stringify(webhookEvent));
	  fb.process_event(webhookEvent);
    });
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = CONST.verify_token;
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

/* Github webhook */
app.post('/github_hook', function(req, res) {
	var body = req.body;
    res.status(200).send('EVENT_RECEIVED');

	var jsonObj = JSON.parse(body);
	//var username = jsonObj.comment.user.login;
	var username = jsonObj.sender.login;
	var repo = jsonObj.repository.name;
	var commit_id = jsonObj.comment.commit_id;
	var commit_msg = jsonObj.comment.body;

	var user = util.get_user(username);
	if (user == null) {
		console.log("github_hook: can't identify user. exiting");
		repturn;
	}

	util.add_commit(user, repo, commit_id, commit_msg);
	util.pull_repo(repo);
});
