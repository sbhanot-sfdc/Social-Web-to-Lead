/*This script implements the Username/Password OAuth flow to login to Salesforce
and get an access token. The access token will be used to make REST API calls.
In order to setup OAuth authentication with Force.com, you'll need to first create a 
Remote Access Application in Salesforce. 

Next, set the following environment variables in Heroku (use the 'heroku config' command 
to manage your Heroku env. variables).

FORCE_DOT_COM_CLIENT_ID : The Client ID assigned to your Remote Access App in Salesforce
FORCE_DOT_COM_CLIENT_SECRET : The Client Secret assigned to your Remote Access App in Salesforce
FORCE_DOT_COM_USERNAME, FORCE_DOT_COM_PASSWORD : The username and password for the user record in 
Salesforce that will be used to create Lead records. Note that this user should have 'Create' 
privileges on the Lead object.
*/
var http = require('https');
var oauthResponse = {"access_token":null,"instance_url":null, "id":null, "refresh_token":null};
var hostname  = 'login.salesforce.com';

function getOAuthResponse() { return oauthResponse; }

function login(callback) {	

	//Construct the post data for the OAuth callout
	var post_data = 'grant_type=password&client_id='+process.env.FORCE_DOT_COM_CLIENT_ID+'&client_secret='+
					process.env.FORCE_DOT_COM_CLIENT_SECRET+'&username='+process.env.FORCE_DOT_COM_USERNAME+
					'&password='+process.env.FORCE_DOT_COM_PASSWORD;

	console.log(post_data);
	var options = {
		host: hostname,
		path: '/services/oauth2/token',
		method: 'POST',
		headers: {
			'host': hostname,
			'Content-Length': post_data.length,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept':'application/jsonrequest',
			'Cache-Control':'no-cache,no-store,must-revalidate'
		}
	};

	var req = http.request(options, function(res) {
		  console.log("statusCode: ", res.statusCode);
		  console.log("headers: ", res.headers);

		  res.on('data', function(data) {
		  	//Populate the oauthResponse variable with the OAuth access token and instance url
		    newResponse = JSON.parse(data);
		    oauthResponse.access_token = newResponse.access_token;
		    oauthResponse.instance_url = newResponse.instance_url;
		    oauthResponse.id = newResponse.id;
		    console.log("OAuth response::"+JSON.stringify(oauthResponse));
		 	});

		  res.on('end', function(d) {
		  	if (callback){callback(oauthResponse);}
		  });
		}).on('error', function(e) {
		  console.error(e);
		});

	req.write(post_data);
	req.end();
};

/*This function implements the Refresh OAuth Flow for Force.com. Note
that this function is not used in the current implementation of 
'Social Web 2 Lead' since the Username/Password flow does not support refreshing the access
token. 
*/
function refreshToken(callback) {
	console.log('Getting Refresh Token...');
	if (typeof(oauthResponse.refresh_token) == "undefined")
		return;

	var post_data = 'refresh_token='+oauthResponse.refresh_token+'&grant_type=refresh_token&client_id='+
					process.env.FORCE_DOT_COM_CLIENT_ID+'&client_secret='+process.env.FORCE_DOT_COM_CLIENT_SECRET;

	console.log(post_data);
	var options = {
		host: hostname,
		path: '/services/oauth2/token',
		method: 'POST',
		headers: {
			'host': hostname,
			'Content-Length': post_data.length,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept':'application/jsonrequest',
			'Cache-Control':'no-cache,no-store,must-revalidate'
		}
	};

	var req = http.request(options, function(res) {
		  console.log("statusCode: ", res.statusCode);

		  res.on('data', function(data) {
		    newResponse = JSON.parse(data);
		    oauthResponse.access_token = newResponse.access_token;
		    console.log("NEW ACCESS TOKEN::"+oauthResponse.access_token);
		 	});

		  res.on('end', function(d) {
		  	if(callback) {callback(oauthResponse);}
		  });

		}).on('error', function(e) {
		  console.error(e);
		});

	req.write(post_data);
	req.end();	
}

module.exports = {
  login: login,
  getOAuthResponse : getOAuthResponse,
  refreshToken : refreshToken
};