Sample Facebook application for capturing Lead data in Salesforce.com
=====================================================================

This is a sample app showing how Web-to-Lead can be made social in Salesforce.com. This application is built on Heroku (using the [native Heroku-Facebook integration](http://blog.heroku.com/archives/2011/9/15/facebook/)) and lets you

- Add a 'Contact Me' functionality to a Facebook application or page that would result in a Lead being created in Salesforce.
- Tap into one of the most powerful features of a social network, a user's social graph, by letting users refer one of their Facebook friends.
- Make 'social' actionable by capturing data (i.e. Leads)

The application is built using Node.js, Bootstrap and Socket.io.

Installation and configuration
------------------------------
1. Follow the instuctions to create a [new Facebook application on Heroku](http://devcenter.heroku.com/articles/facebook). Choose Node.js as your programming language.
2. Use 'git clone' to fetch the source code for the sample template application that gets created by default on Heroku. 
3. Replace the sample application code with what's in this repo.
4. Create a new Remote Access Application in the Salesforce Org where you'd like the Lead records to be created.
5. Add the following Environment Variables to your Heroku application by using the 'heroku config:add' command
	- FORCE_DOT_COM_CLIENT_ID : The Client ID assigned to your Remote Access App in Salesforce
	- FORCE_DOT_COM_CLIENT_SECRET : The Client Secret assigned to your Remote Access App in Salesforce
	- FORCE_DOT_COM_USERNAME, FORCE_DOT_COM_PASSWORD : The username and password for the user record in Salesforce that will be used to create Lead records. You will also need to append the Security Token for the Salesforce user to the FORCE_DOT_COM_PASSWORD env. variable (e.g. 'mypasswordxxxxxx'). Note that this user should have 'Create' privileges on the Lead object. 
6. Commit all changes to your local git repo and deploy the new application to Heroku using 'git push heroku master'.