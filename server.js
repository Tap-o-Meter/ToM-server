// server.js

// set up ======================================================================
// get all the tools we need
var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io").listen(http);
var mongoose = require("mongoose");
var passport = require("passport");
var bodyParser = require("body-parser");
var cors = require("cors");
mongoose.Promise = require("bluebird");

//var configDB = require("./config/database.js");
const CONNECTION_URI =
  process.env.MONGODB_URI || "mongodb://0.0.0.0:27017/beer_control"; // Heroku server
//var ipaddress = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var port = process.env.PORT || 3000;
const lineList = [];
// configuration ===============================================================
mongoose.connect(CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
app.set("views", __dirname + "/views");
app.engine("html", require("ejs").renderFile);
app.use(express.static(__dirname + "public"));
app.use(express.static("public"));

require("./config/passport")(passport); // pass passport for configuration

// set up our express application
app.use(cors());
app.options("*", cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(passport.initialize());

// routes ======================================================================
require("./app/routes.js")(app, passport, io); // load our routes and pass in our app and fully configured passport
require("./app/socketHandlers.js")(io, lineList);
// launch ======================================================================
http.listen(process.env.PORT || 3000, function() {
  console.log(
    "Express server listening on port %d in %s mode",
    this.address().port,
    app.settings.env
  );
});

module.exports = app;
