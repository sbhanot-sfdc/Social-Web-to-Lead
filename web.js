require.paths.unshift(__dirname + '/lib');

var everyauth = require('everyauth');
var express   = require('express');
var http = require('https');

var FacebookClient = require('facebook-client').FacebookClient;
var facebook = new FacebookClient();

var uuid = require('node-uuid');
//Get the version of the Force.com API that you want to use from the env. variable. Default to v23.
var api = process.env.API || '23.0';

// configure facebook authentication
everyauth.facebook
  .appId(process.env.FACEBOOK_APP_ID)
  .appSecret(process.env.FACEBOOK_SECRET)
  .scope('email')
  .entryPath('/')
  .redirectPath('/home')
  .findOrCreateUser(function() {
    return({});
  })

// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),
  // insert a middleware to set the facebook redirect hostname to http/https dynamically
  function(request, response, next) {
    var method = request.headers['x-forwarded-proto'] || 'http';
    everyauth.facebook.myHostname(method + '://' + request.headers.host);
    next();
  },
  everyauth.middleware(),
  require('facebook').Facebook()
);

// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});
app.use(express.bodyParser());

// create a socket.io backend for sending facebook graph data
// to the browser as we receive it
var io = require('socket.io').listen(app);

// wrap socket.io with basic identification and message queueing
// code is in lib/socket_manager.js
var socket_manager = require('socket_manager').create(io);

// use xhr-polling as the transport for socket.io
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});

//Login to Force.com using the OAuth Username/Password Flow    
var forceOAuth = require('force_dot_com_oauth');
forceOAuth.login(null);

// respond to GET /home
app.get('/home', function(request, response) {

  // detect the http method uses so we can replicate it on redirects
  var method = request.headers['x-forwarded-proto'] || 'http';

  // if we have facebook auth credentials

  if (request.session.auth) {

    // initialize facebook-client with the access token to gain access
    // to helper methods for the REST api
    var token = request.session.auth.facebook.accessToken;
    facebook.getSessionByAccessToken(token)(function(session) {

      // generate a uuid for socket association
      var socket_id = uuid();

      //Issue FQL query to retrieve upto 50 friends to display in the 
      //'Refer a friend' section
      session.restCall('fql.query', {
        query: 'SELECT uid, name, first_name, last_name, pic_big, email FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) LIMIT 50',
        format: 'json'
      })(function(result) {
        //Send the list of Facebook friends to the browser
        console.log('FB friends:'+JSON.stringify(result));
        socket_manager.send(socket_id, 'friends', result);
        console.log('Done sending');
      });

      // get information about the app itself
      session.graphCall('/' + process.env.FACEBOOK_APP_ID)(function(app) {
        console.log('FB user is'
                    +JSON.stringify(request.session.auth.facebook.user));
        // render the home page
        response.render('home.ejs', {
          layout:   false,
          token:    token,
          app:      app,
          user:     request.session.auth.facebook.user,
          home:     method + '://' + request.headers.host + '/',
          redirect: method + '://' + request.headers.host + request.url,
          socket_id: socket_id
        });

      });
    });

  } else {

    // not authenticated, redirect to / for everyauth to begin authentication
    response.redirect('/');

  }
});

app.post('/lead',function(request, response) {
    request.body.leadRec.Phone = request.body.Phone;
    //Create the Lead record in Salesforce
    createLead(request.body.leadRec, request, response);
});

app.post('/', function(request, response) {
    response.redirect('/home');
});

function createLead(leadRec, request, response) {

  console.log('Lead Record:'+JSON.stringify(leadRec));
  var data = '';
  var host = (require('url').parse(forceOAuth.getOAuthResponse().instance_url))['host'];
  var options = {
    host: host,
    path: '/services/data/v'+api+'/sobjects/Lead',
    method: 'POST',
    headers: {
      'Host': host,
      'Authorization': 'OAuth '+forceOAuth.getOAuthResponse().access_token,
      'Accept':'application/jsonrequest',
      'Cache-Control':'no-cache,no-store,must-revalidate',
      'Content-type':'application/json; charset=UTF-8'
    }

  }
  
  //Issue the Force.com REST API call to add a Lead record
  var req = http.request(options, function(res) {
      console.log("statusCode: ", res.statusCode);      

      res.on('data', function(_data) {
        data += _data;
      });

      res.on('end', function(d) {
        if (res.statusCode == 401){
          //Our Access Token has expired, and so we need to login again
          console.log('Logging in again...');
          forceOAuth.login(function(){createLead(leadRec, request, response);});
        }else if (res.statusCode != 201){
          //Force.com API returned an error. Display it to the user
          onsole.log('Error from Force.com:'+data);
          data = JSON.parse(data);
          console.log('Error message:'+data[0].message);
          response.send(data[0].message, 400);
        }else{    
          response.send(''); 
        }
      });

    }).on('error', function(e) {
      console.log(e);
    })
  req.write(JSON.stringify(leadRec));
  req.end();

}

