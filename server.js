// server.js

// get all the tools we need
var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var cors = require("cors");
const Agenda = require("agenda");
var Client = require("./app/models/Client");
const config = require("./config");
mongoose.Promise = require("bluebird");

// const CONNECTION_URI =
//   process.env.MONGODB_URI || "mongodb://0.0.0.0:27017/tapOmeter";
const CONNECTION_URI =
  process.env.MONGODB_URI || "mongodb://beer-control.local:27017/beer_control"; // Heroku server
var port = process.env.PORT || 3000;
const lineList = [];
var servingList = [];
const workerSockets = [];

mongoose.connect(CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const clients = mongoose.connection.collection("clients");

const agenda = new Agenda({ db: { address: CONNECTION_URI } });

agenda.define("weekly", async job => {
  console.log("algo está pasando en semana");
  await Client.update(
    { level: 1 },
    { $set: { benefits: config.benefits[0] } },
    { multi: true }
  ).exec();
  await Client.update(
    { level: 4 },
    { $set: { benefits: config.benefits[3] } },
    { multi: true }
  ).exec();
  await Client.update(
    { level: 2 },
    { $inc: { "benefits.beers": config.benefits[1].beers } },
    { multi: true }
  ).exec();
});

agenda.define("monthly", async job => {
  console.log("algo está pasando en mes");
  await Client.update(
    { level: 2 },
    { $set: { benefits: config.benefits[1] } },
    { multi: true }
  ).exec();
  await Client.update(
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
app.use(express.static(__dirname + "/public")); // Fixed the path here
app.use(express.static("public"));

app.use(cors());
app.options("*", cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));

const ioClient = require("socket.io-client").connect(
  "https://chikilla-real-time-taps.herokuapp.com/"
);

require("./app/routes.js")(app, io);
require("./app/socketHandlers.js")(
  io,
  lineList,
  servingList,
  workerSockets,
  ioClient
);

http.listen(port, function() {
  console.log(
    "Express server listening on port %d in %s mode",
    this.address().port,
    app.settings.env
  );
});

module.exports = app;