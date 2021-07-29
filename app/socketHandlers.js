var mongoose = require("mongoose");
var Line = require("./models/Line");
var Worker = require("./models/worker");
var Keg = require("../app/models/keg");
var Beer = require("../app/models/beer");
var Sale = require("../app/models/sale");
const Client = require("./models/Client.js");
var fs = require("fs");

module.exports = function(io, lineList) {
  addLineToList = (id, socket) => {
    let index = lineList.findIndex(line => line.id === id);
    index === -1
      ? lineList.push({ id, socket })
      : (lineList[index].socket = socket);
    io.emit("lineConnected", { id, socket });
  };

  removeLineFromList = socketId => {
    const index = lineList.findIndex(line => line.socket === socketId);
    index === -1 ? null : lineList.splice(index, 1);
    io.emit("lineDisconnected", { socket: socketId });
  };

  io.on("connection", function(socket) {
    socket.on("chat message", function(msg) {
      io.emit("chat message", msg);
    });

    socket.on("getWorker", msg => {
      Worker.findOne({ cardId: msg.cardId }, (err, data) => {
        if (data) {
          socket.emit("validated user", { confirmation: "success", data });
        } else {
          socket.emit("validated user", { confirmation: "fail" });
        }
      });
    });

    socket.on("sale_complete", msg => {
      var ObjectId = mongoose.Types.ObjectId;
      var newSale = new Sale();
      newSale._id = new ObjectId().toString();
      newSale.date = new Date();
      msg.clientId ? (newSale.clientId = msg.clientId) : null;
      Object.assign(newSale, msg);
      Keg.findOne({ _id: msg.kegId }, (err, data) => {
        if (data) {
          console.log(data.available - msg.qty);
          data.available = data.available - msg.qty;
          switch (msg.concept) {
            case "TASTER":
              data.taster = data.taster + 1;
              break;
            case "PINT":
              data.soldPints = data.soldPints + 1;
              break;
            case "GROWLER":
              data.growlers.push({ qty: newSale.qty });
              break;
            case "MERMA":
              data.merma += newSale.qty;
              break;
            default:
          }
          data.markModified("available");
          data.save();
          newSale.save((err, doc) => {
            if (msg.clientId) {
              Client.findOne({ _id: msg.clientId }, (err, client) => {
                if (client) {
                  client.beersDrinked++;
                  client.markModified("beersDrinked");
                  client.save();
                }
              });
            }
            if (doc) {
              io.emit("sale-commited", { data, doc });
              //res.json({ confirmation: "success", data: doc });
            }
          });
        }
      });
    });

    socket.on("getClient", msg => {
      Client.findOne({ cardId: msg.cardId }, (err, data) => {
        if (data) {
          socket.emit("validated client", { confirmation: "success", data });
        } else {
          socket.emit("validated client", { confirmation: "fail" });
        }
      });
    });

    socket.on("getBeersInfo", msg => {
      console.log(msg);
      var promises = msg.kegList.map(async function(kegId) {
        const keg = await Keg.findOne({ _id: kegId }).exec();
        console.log(keg);
        const beer = await Beer.findOne({ _id: keg.beerId }).exec();
        return { beer, keg };
      });
      Promise.all(promises)
        .then(function(results) {
          console.log("se armo");
          socket.emit("beersInfo", { data: results });
        })
        .catch(err => console.log(err.message));
    });

    socket.on("redeemBeer", msg => {
      console.log("llegó a evento");
      Client.findOne({ _id: msg.clientId }).then(client => {
        const beers = client.benefits.beers;
        client.benefits.beers = beers - 1;
        client.markModified("benefits");
        client.save();
        console.log("en teoría guardó consumo");
        var ObjectId = mongoose.Types.ObjectId;
        var newSale = new Sale();
        newSale._id = new ObjectId().toString();
        newSale.date = new Date();
        newSale.workerId = "N/A";
        newSale.concept = "PINT";
        newSale.qty = ".473";
        Object.assign(newSale, msg);
        Keg.findOne({ _id: msg.kegId }, (err, data) => {
          if (data) {
            data.available = data.available - msg.qty;
            data.soldPints = data.soldPints + 1;
            data.markModified("available");
            data.save();
            newSale.save((err, doc) => {});
          }
        });
      });
    });

    socket.on("client connected", () => {
      Keg.find({ status: { $ne: "EMPTY" } }, function(err, data) {
        if (data) {
          Beer.find({}, function(err, beers) {
            if (beers) {
              Line.find({}).then(lines => {
                var placeInfo;
                const folder = "/home/pi/Documents/Beer_control/data";
                fs.readFile(folder + "/local.json", "utf8", function(
                  err,
                  jsonDoc
                ) {
                  placeInfo = JSON.parse(jsonDoc);
                  fs.readFile(folder + "/.emergencyCard.json", "utf8", function(
                    err,
                    emergencyDoc
                  ) {
                    const emergencyCard = JSON.parse(emergencyDoc);
                    socket.emit("Linelist", {
                      connectedLines: lineList,
                      data,
                      lines,
                      beers,
                      placeInfo,
                      emergencyCard
                    });
                  });
                });
              });
            }
          });
        }
      });
    });

    socket.on("setUp", function(msg) {
      Line.findOneAndUpdate(
        { _id: msg.id },
        { $set: { socketId: socket.id } },
        { new: true },
        (err, data) => {
          if (data) {
            Keg.findOne({ _id: data.idKeg }, function(err, keg) {
              if (keg) {
                Beer.findOne({ _id: keg.beerId }, function(err, beer) {
                  if (beer) {
                    const folder = "/home/pi/Documents/Beer_control/data";
                    fs.readFile(
                      folder + "/.emergencyCard.json",
                      "utf8",
                      function(err, emergencyDoc) {
                        const emergencyCard = JSON.parse(emergencyDoc);
                        socket.emit("device info", {
                          ...data._doc,
                          name: beer.name,
                          style: beer.style,
                          abv: keg.abv,
                          ibu: keg.ibu,
                          emergencyCard: emergencyCard.cardId
                        });
                      }
                    );
                  }
                });
              } else {
                socket.emit("disconnectedLine");
              }
            });
            addLineToList(msg.id, socket.id);
          } else if (err) {
            console.log("Something wrong when updating data!");
          } else {
            Line.findOne({})
              .sort({ noLinea: -1 })
              .exec(function(err, item) {
                var newLine = new Line();
                newLine._id = msg.id;
                newLine.socketId = socket.id;
                newLine.noLinea = item.noLinea + 1;
                newLine.save(function(err) {
                  if (err) {
                    console.log(err.message);
                    socket.emit("chat message", err.message);
                  } else {
                    socket.emit("newLine", newLine);
                    addLineToList(msg.id, socket.id);
                  }
                });
              });
          }
        }
      );
    });

    socket.on("disconnect", function() {
      removeLineFromList(socket.id);
    });
  });
};
