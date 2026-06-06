// server.js

// set up ======================================================================
// get all the tools we need
var express = require("express");
var app = express();
var fs = require("fs");
var http = require("http");
var https = require("https");
var mongoose = require("mongoose");
// var passport = require("passport");
var bodyParser = require("body-parser");
var cors = require("cors");
const Agenda = require("agenda");
var Client = require("./app/models/Client");
const config = require("./config");
const path = require("path");
mongoose.Promise = require("bluebird");

//var configDB = require("./config/database.js");
const CONNECTION_URI =
  process.env.MONGODB_URI || "mongodb://0.0.0.0:27017/beer_control"; // Heroku server
//var ipaddress = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var port = process.env.PORT || 3000;
var httpsPort = process.env.HTTPS_PORT || 3443;
const lineList = [];
var servingList = [];
const workerSockets = [];

// Red de seguridad: un error no capturado en cualquier callback async NO debe
// tumbar el proceso (eso desconectaría a todos los dispositivos a la vez).
process.on("uncaughtException", err => {
  console.error("uncaughtException (el proceso sigue vivo):", err);
});
process.on("unhandledRejection", reason => {
  console.error("unhandledRejection:", reason);
});

// Configuración SSL
let sslOptions;
try {
  sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'server.crt'))
  };
  console.log('SSL certificates loaded successfully');
} catch (error) {
  console.log('SSL certificates not found, running HTTP only');
  console.log('To enable HTTPS, create certificates in ./cert/ directory');
  sslOptions = null;
}

// Crear servidores HTTP y HTTPS
const httpServer = http.createServer(app);
const httpsServer = sslOptions ? https.createServer(sslOptions, app) : null;

// Socket.io con soporte para ambos servidores
const io = require("socket.io")({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Vincular Socket.IO a ambos servidores
io.attach(httpServer);
if (httpsServer) {
  io.attach(httpsServer);
}

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
app.use(express.static(path.join(__dirname, "public")));

// require("./config/passport")(passport); // pass passport for configuration

// set up our express application
app.use(cors());
app.options("*", cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
// app.use(passport.initialize());

// Cloud connection ============================================================
const CLOUD_SOCKET_URL =
  process.env.CLOUD_SOCKET_URL ||
  "https://chikilla-real-time-taps.herokuapp.com/";
const SELFPOUR_SOCKET_URL =
  process.env.SELFPOUR_SOCKET_URL || "http://192.168.1.79";

const ioClient = require("socket.io-client").connect(CLOUD_SOCKET_URL);

const selfpour_socket = require("socket.io-client").connect(SELFPOUR_SOCKET_URL);

// routes ======================================================================
require("./app/routes.js")(app, io);
require("./app/socketHandlers.js")(
  io,
  lineList,
  servingList,
  workerSockets,
  ioClient,
  selfpour_socket
);
// launch ======================================================================
httpServer.listen(port, function() {
  console.log('HTTP Server listening on port %d', port);
});

if (httpsServer) {
  httpsServer.listen(httpsPort, function() {
    console.log('HTTPS Server listening on port %d', httpsPort);
  });
}

module.exports = app;
