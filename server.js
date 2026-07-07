// server.js

// Carga variables desde .env (si existe) sin depender de paquetes externos.
// Las variables ya presentes en el entorno (p.ej. config vars de Heroku) tienen
// prioridad. Debe correr ANTES de require("./config").
(function loadDotEnv() {
  try {
    const _fs = require("fs");
    const _path = require("path");
    const envPath = _path.join(__dirname, ".env");
    if (!_fs.existsSync(envPath)) return;
    _fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (!match) return;
        const key = match[1];
        let val = match[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        )
          val = val.slice(1, -1);
        if (!(key in process.env)) process.env[key] = val;
      });
  } catch (e) {
    console.error("No se pudo cargar .env:", e.message);
  }
})();

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
// Los resets programados de beneficios (agenda weekly/monthly) viven en el
// plugin ToM Rewards, que es el dueño de los clientes VIP.

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

// MQTT: canal nuevo de las líneas; convive con Socket.IO ======================
const mqttBridge = require("./app/mqttBridge");
mqttBridge.init({ io, lineList, servingList, selfpour_socket });

// Eventos de dominio hacia plugins (ToM Rewards consume tom/events/*)
const events = require("./app/events");
events.setPublisher(mqttBridge.publishEvent);

// Plugin ToM Rewards: proxy /rewards/*, /capabilities y aliases legacy ========
require("./app/rewardsProxy")(app);

// routes ======================================================================
require("./app/routes.js")(app, io, mqttBridge);
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
