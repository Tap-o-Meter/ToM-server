// server.js

// set up ======================================================================
// get all the tools we need
var express = require("express");
var app = express();
var http = require("http").Server(app);
var mongoose = require("mongoose");
var passport = require("passport");
var bodyParser = require("body-parser");
mongoose.Promise = require("bluebird");

//var configDB = require("./config/database.js");
const CONNECTION_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/login"; // Heroku server
//var ipaddress = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var port = process.env.PORT || 3000;

// configuration ===============================================================
mongoose.connect(CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
app.engine("html", require("ejs").renderFile);

require("./config/passport")(passport); // pass passport for configuration

// set up our express application

app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(passport.initialize());

// routes ======================================================================
require("./app/routes.js")(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
http.listen(process.env.PORT || 3000, function() {
  console.log(
    "Express server listening on port %d in %s mode",
    this.address().port,
    app.settings.env
  );
});

module.exports = app;
