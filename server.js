// server.js

// set up ======================================================================
// get all the tools we need
var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var mongoose = require("mongoose");
// var passport = require("passport");
var bodyParser = require("body-parser");
var cors = require("cors");
const Agenda = require("agenda");
var Client = require("./app/models/Client");
const config = require("./config");
mongoose.Promise = require("bluebird");

//var configDB = require("./config/database.js");
const CONNECTION_URI =
  process.env.MONGODB_URI || "mongodb://0.0.0.0:27017/beer_control"; // Heroku server
//var ipaddress = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var port = process.env.PORT || 3000;
const lineList = [];
var servingList = [];
const workerSockets = [];
// configuration ===============================================================
mongoose.connect(CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const clients = mongoose.connection.collection("clients");
// Scheduled tasks =============================================================
const agenda = new Agenda({ db: { address: CONNECTION_URI } });

agenda.define("weekly", async job => {
  console.log("algo está pasando en semana");
  var Client = require("./app/models/Client");
  Client.update(
    { level: 1 },
    { $set: { benefits: config.benefits[0] } },
    { multi: true }
  ).exec();
  Client.update(
    { level: 4 },
    { $set: { benefits: config.benefits[3] } },
    { multi: true }
  ).exec();
  Client.update(
    { level: 2 },
    { $inc: { "benefits.beers": config.benefits[1].beers } },
    { multi: true }
  ).exec();
});
agenda.define("monthly", async job => {
  console.log("algo está pasando en mes");
  var Client = require("./app/models/Client");
  const config = require("./config");
  Client.update(
    { level: 2 },
    { $set: { benefits: config.benefits[1] } },
    { multi: true }
  ).exec();
  Client.update(
    { level: 3 },
    { $set: { benefits: config.benefits[2] } },
    { multi: true }
  ).exec();
});

agenda.on("ready", function() {
  agenda.every("1 week", "weekly");
  agenda.every("1 month", "monthly");

  agenda.start();
});

app.set("views", __dirname + "/views");
app.engine("html", require("ejs").renderFile);
app.use(express.static(__dirname + "public"));
app.use(express.static("public"));

// require("./config/passport")(passport); // pass passport for configuration

// set up our express application
app.use(cors());
app.options("*", cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
// app.use(passport.initialize());

// Cloud connection ============================================================
const ioClient = require("socket.io-client").connect(
  "https://chikilla-real-time-taps.herokuapp.com/"
  //"http://192.168.0.5:3000/"
);

// routes ======================================================================
require("./app/routes.js")(app, io);
require("./app/socketHandlers.js")(
  io,
  lineList,
  servingList,
  workerSockets,
  ioClient
);
// launch ======================================================================
http.listen(process.env.PORT || 3000, function() {
  console.log(
    "Express server listening on port %d in %s mode",
    this.address().port,
    app.settings.env
  );
});

module.exports = app;
