var api = process.env.API || '25.0';

var http = require('https');
var nforce = require('nforce');
var oauth;

if (process.env.REDISTOGO_URL) {
  var rtg   = require('url').parse(process.env.REDISTOGO_URL);  
  var redis = require('redis').createClient(rtg.port, rtg.hostname);
  redis.auth(rtg.auth.split(':')[1]);
} else {
    var redis = require('redis').createClient();
}

//Login to Force.com using the OAuth Username/Password Flow    
var sfdcOrg = nforce.createConnection({
  clientId: process.env.FORCE_DOT_COM_CONSUMER_KEY,
  clientSecret: process.env.FORCE_DOT_COM_CONSUMER_SECRET,
  redirectUri: 'http://localhost',
  apiVersion: api,  // optional, defaults to v24.0
  environment: 'production'  // optional, sandbox or production, production default
});

function sfdcAuthenticate(callback){
  // authenticate using username-password oauth flow
  sfdcOrg.authenticate({ username: process.env.FORCE_DOT_COM_USERNAME, 
                         password: process.env.FORCE_DOT_COM_PASSWORD }, 
                         function(err, resp){
                            if(err) {
                              console.log('Error: ' + err.message);
                            } else {
                              console.log('Access Token: ' + resp.access_token);
                              oauth = resp;
                              redis.llen('leads', function(err, total) {
                                console.log('Length is:'+total);
                                var leads = new Array();
                                for(var i=0;i<total;i++) {
                                  redis.lpop('leads', function(err, x) {
                                          console.log('lead is '+x);
                                          leads.push(JSON.parse(x));
                                          if (leads.length == total){
                                             insertLeads(leads);
                                          }
                                      });
                                }
                            });
                          }
                          if(callback){
                            callback();
                          }
                        });
}

sfdcAuthenticate();


function insertLeads(leadRecords) {
  var data = '';
  var host = (require('url').parse(oauth.instance_url))['host'];
  console.log('Host:'+host);
  var options = {
    host: host,
    path: '/services/apexrest/bulk_lead_insert/',
    method: 'POST',
    headers: {
      'Host': host,
      'Authorization': 'OAuth '+oauth.access_token,
      'Accept':'application/jsonrequest',
      'Cache-Control':'no-cache,no-store,must-revalidate',
      'Content-type':'application/json'
    }

  }
  
  //Issue the Apex REST API call to add the Lead records
  var req = http.request(options, function(res) {
      console.log("statusCode: ", res.statusCode);      

      res.on('data', function(_data) {
        data += _data;
      });

      res.on('end', function(d) {
        if (res.statusCode != 200){
          //Force.com returned an error. Display it to the user
          console.log('Error from Force.com:'+data);
        }
      });

    }).on('error', function(e) {
      console.log(e);
    });

  var l = {};
  l.leads=leadRecords;  
  req.write(JSON.stringify(l));
  req.end();
}