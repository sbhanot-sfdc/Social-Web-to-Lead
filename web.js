var async   = require('async');
var express = require('express');
var util    = require('util');
var http = require('https');

// create an express webserver
var app = express.createServer(
	express.logger(),
	express.static(__dirname + '/public'),
	express.bodyParser(),
	express.cookieParser(),
	// set this to a secret value to encrypt session cookies
	express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),
	require('faceplate').middleware({
		app_id: process.env.FACEBOOK_APP_ID,
		secret: process.env.FACEBOOK_SECRET,
		scope:  'email'
	})
);


// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function() {
	console.log("Listening on " + port);
});

app.dynamicHelpers({
	'host': function(req, res) {
		return req.headers['host'];
	},
	'scheme': function(req, res) {
		req.headers['x-forwarded-proto'] || 'http'
	},
	'url': function(req, res) {
		return function(path) {
			return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(path);
		}
	},
	'url_no_scheme': function(req, res) {
		return function(path) {
			return '://' + app.dynamicViewHelpers.host(req, res) + path;
		}
	},
});

function render_page(req, res) {
	req.facebook.app(function(app) {
		req.facebook.me(function(user) {
			console.log('FB user is:'
                    +JSON.stringify(user));
			res.render('index.ejs', {
				layout:    false,
				req:       req,
				app:       app,
				user:      user
			});
		});
	});
}

function handle_facebook_request(req, res) {

	// if the user is logged in
	if (req.facebook.token) {

		async.parallel([
			function(cb) {
				// use fql to get a list of 50 friends
			  req.facebook.fql(
				'SELECT uid, name, first_name, last_name, pic_big, email FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) LIMIT 50', 
				function(result) {
					req.friends = result;
					cb();
			  });
			}
		], function() {
			render_page(req, res);
		});

	} else {
		render_page(req, res);
	}
}

app.get('/', handle_facebook_request);
app.post('/', handle_facebook_request);

//Get the version of the Force.com API that you want to use from the env. variable. 
//Default to v25.
var api = process.env.API || '25.0';
var oauth;
var nforce = require('nforce');


//Login to Force.com using the OAuth Username/Password Flow    
var sfdcOrg = nforce.createConnection({
	clientId: process.env.FORCE_DOT_COM_CONSUMER_KEY,
	clientSecret: process.env.FORCE_DOT_COM_CONSUMER_SECRET,
	redirectUri: 'http://localhost',
	apiVersion: api,  // optional, defaults to v24.0
	environment: 'production'  // optional, sandbox or production, production default
});

function sfdcAuthenticate(callback){
	console.log('Authenticate called');
	// authenticate using username-password oauth flow
	sfdcOrg.authenticate({ username: process.env.FORCE_DOT_COM_USERNAME, 
		password: process.env.FORCE_DOT_COM_PASSWORD }, function(err, resp){
		if(err) {
		  console.log('Error: ' + err.message);
		} else {
		  console.log('Access Token: ' + resp.access_token);
		  oauth = resp;
		}
		if(callback){
			callback();
		}
	});
}

sfdcAuthenticate();

app.post('/lead',function(request, response) {
    request.body.leadRec.Phone = request.body.Phone;
    //Create the Lead record in Salesforce
    createLead(request.body.leadRec, request, response);
    //addLead2Queue(request.body.leadRec, request, response);
});


function createLead(leadRec, request, response) {

 	console.log('Called Create Lead');
	var obj = nforce.createSObject('Lead', leadRec);
  	sfdcOrg.insert(obj, oauth, function(err, resp){
	    if (err) {
	      	console.log(err);
	    	if (err.statusCode == 401){
	    		console.log('Logging in again...');
	    		sfdcAuthenticate(createLead(leadRec, request, response));
	    	}
	    	else{
	    		response.send(err.message, 400);
	    	}		
	    } else {
	    	if (resp.success == true) {
	      		response.send('');        
	      	}
	  	}
  	});
}

/*
if (process.env.REDISTOGO_URL) {
	var rtg   = require('url').parse(process.env.REDISTOGO_URL);  
	var redis = require('redis').createClient(rtg.port, rtg.hostname);
	redis.auth(rtg.auth.split(':')[1]);
} else {
  	var redis = require('redis').createClient();
}

function addLead2Queue(leadRec, request, response){
	redis.lpush('leads',JSON.stringify(leadRec));
	response.send(''); 
}
*/


app.get('/offers', function(req, res) {
	queryOffer(req, res);
});

app.post('/offers', function(req, res) {
	queryOffer(req, res);
});

function queryOffer(req, res){
	sfdcOrg.query('select Offer_Number__c, Offer_Description__c from Offer__c '+
				  'where status__c = \'Active\' limit 10', 
				  oauth, 
				  function(err, resp){
			    	res.render("offers.ejs", 
			    			   { layout: false, offers: resp.records, req : req } );
			   	  });
}