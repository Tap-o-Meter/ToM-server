// server.js

var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var cors = require("cors");
mongoose.Promise = require("bluebird");
const { connectRabbitMQ } = require("./config/mqRabbit.js");

const CONNECTION_URI = "mongodb://mongo:27017/tap-o-meter";
console.warn("la mierda esra", process.env.MONGO_URI);
var port = process.env.PORT || 3000;
const lineList = [];
var servingList = [];
const workerSockets = [];


setTimeout(() => {
  mongoose.connect(CONNECTION_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
}, 10000); // Espera 10 segundos antes de intentar conectarse a MongoDB


app.use(express.static(__dirname + "/public")); // Fixed the path here
app.use(express.static("public"));

app.use(cors());
app.options("*", cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));

const ioClient = require("socket.io-client").connect(
  "https://chikilla-real-time-taps.herokuapp.com/"
);

connectRabbitMQ();
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