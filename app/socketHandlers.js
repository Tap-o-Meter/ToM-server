var mongoose = require("mongoose");
var Line = require("./models/Line");
var Worker = require("./models/worker");
var Keg = require("../app/models/keg");
var Beer = require("../app/models/beer");
var Sale = require("../app/models/sale");
const Client = require("./models/Client.js");
var fs = require("fs");
const path = require("path");

module.exports = function(io, lineList, servingList, workerSockets, ioClient) {
  // Obtener la ruta actual y unirla con la carpeta 'data'
  const folder = path.join(process.cwd(), "data");

  const addLineToList = (id, socket) => {
    let index = lineList.findIndex(line => line.id === id);
    index === -1
      ? lineList.push({ id, socket })
      : (lineList[index].socket = socket);
    io.emit("lineConnected", { id, socket });
  };

  const removeLineFromList = socketId => {
    const index = lineList.findIndex(line => line.socket === socketId);
    if (index !== -1) {
      lineList.splice(index, 1);
      io.emit("lineDisconnected", { socket: socketId });
      return true;
    }
    return false;
  };

  const addWorkerSocket = (id, socket) => {
    let index = workerSockets.findIndex(worker => worker._id === id);
    index === -1
      ? workerSockets.push({ id, socket })
      : (workerSockets[index].socket = socket);
    io.emit("workerSocketRegistered", { id, socket });
  };

  const getWorkerSocket = workerId => {
    const index = workerSockets.findIndex(worker => worker.id === workerId);
    return index !== -1 ? workerSockets[index].socket : false;
  };

  const removeWorkerSocket = socketId => {
    const index = workerSockets.findIndex(worker => worker.socket === socketId);
    if (index !== -1) {
      const workerId = workerSockets[index].id;
      workerSockets.splice(index, 1);
      io.emit("workerSocketDeleted", { socket: socketId });
      return true;
    }
    return false;
  };

  const addToServing = (sell, workerSocket) => {
    // sell : {qty, concept, percentage, lineId, workerId}
    let index = servingList.findIndex(
      serving => serving.lineId === sell.lineId
    );
    if (index === -1) {
      servingList.push({ ...sell, workerSocket });
      return true;
    } else {
      return false;
    }
  };

  // Se corrige: ahora se busca en servingList y se usa la línea de ID
  const isLineServing = lineId => {
    const index = servingList.findIndex(serving => serving.lineId === lineId);
    return index !== -1;
  };

  const removeFromServing = lineId => {
    const index = servingList.findIndex(serving => serving.lineId === lineId);
    if (index !== -1) {
      servingList.splice(index, 1);
      io.emit("removedFromServing", { lineId });
    }
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
      if (msg.workerId.length > 0) console.warn(newSale);
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
              data.merma = data.merma + parseFloat(newSale.qty);
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
              removeFromServing(msg.lineId);
              io.emit("sale-commited", { data, doc });
            }
          });
        }
      });
    });

    socket.on("setWorker", msg => {
      console.log("llegó a evento");
      Worker.findOne({ cardId: msg.cardId }, (err, data) => {
        if (data) {
          Line.findOne({ _id: msg.lineId }).then(line => {
            const socketToEmit = io.sockets.connected[line.socketId];
            if (socketToEmit)
              socketToEmit.emit("validated user", { confirmation: "success", data });
            else {
              // Lógica adicional en caso de no encontrar el socket
            }
          });
        } else {
          socket.emit("validated user", { confirmation: "fail" });
        }
      });
    });

    socket.on("remoteSell", msg => {
      const { cardId, lineId, concept } = msg;
      Worker.findOne({ cardId }, (err, data) => {
        if (data) {
          if (!isLineServing(lineId)) {
            Line.findOne({ _id: lineId }, (err, line) => {
              const socketToEmit = io.sockets.connected[line.socketId];
              const arduinoConcept = config.options[concept];
              if (socketToEmit) {
                socketToEmit.emit("remoteSell", {
                  confirmation: "success",
                  data,
                  concept: arduinoConcept
                });
              } else {
                socket.emit("errorServing", { msg: "LL not connected" });
              }
            });
          } else {
            socket.emit("errorServing", { msg: "Línea ocupada" });
          }
        } else {
          socket.emit("errorServing", { msg: "No Worker Exist" });
        }
      });
    });

    socket.on("checkInSell", msg => {
      const workerSocket = getWorkerSocket(msg.workerId);
      if (workerSocket) {
        const SocketToEmit = io.sockets.connected[workerSocket];
        const status = addToServing(msg, workerSocket);
        if (status) {
          SocketToEmit.emit("start", msg);
        }
      }
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

    socket.on("updateData", async () => {
      try {
        const lines = await Line.find({}).sort({ noLinea: "asc" }).exec();
        const kegIds = lines.map(line => line.idKeg).filter(id => id);
        const kegs = await Keg.find({ _id: { $in: kegIds } }).exec();
        const beerIds = kegs.map(keg => keg.beerId);
        const beers = await Beer.find({ _id: { $in: beerIds } }).exec();
        ioClient.emit("update data", { kegs, lines, beers });
      } catch (error) {
        console.error("Error in updateData: ", error);
        ioClient.emit("error", "Failed to update data");
      }
    });

    socket.on("client connected", () => {
      Keg.find({ status: { $ne: "EMPTY" } }, function(err, data) {
        if (data) {
          Beer.find({}, function(err, beers) {
            if (beers) {
              Line.find({})
                .sort({ noLinea: "asc" })
                .exec()
                .then(lines => {
                  var placeInfo;
                  fs.readFile(path.join(folder, "local.json"), "utf8", function(
                    err,
                    jsonDoc
                  ) {
                    placeInfo = JSON.parse(jsonDoc);
                    fs.readFile(
                      path.join(folder, ".emergencyCard.json"),
                      "utf8",
                      function(err, emergencyDoc) {
                        const emergencyCard = JSON.parse(emergencyDoc);
                        ioClient.emit("chat message", {
                          lineList,
                          lines,
                          beers
                        });
                        socket.emit("Linelist", {
                          connectedLines: lineList,
                          data,
                          lines,
                          beers,
                          placeInfo,
                          emergencyCard
                        });
                      }
                    );
                  });
                });
            }
          });
        }
      });
    });

    socket.on("desk_manager_connected", () => {
      socket.emit("connectedLines", { connectedLines: lineList });
    });

    socket.on("worker connected", () => {
      addWorkerSocket("5eb7698b423ce36b02c7ab54", socket.id);
      Keg.find({ status: { $ne: "EMPTY" } }, function(err, data) {
        if (data) {
          Beer.find({}, function(err, beers) {
            if (beers) {
              Line.find({})
                .sort({ noLinea: "asc" })
                .exec()
                .then(lines => {
                  var placeInfo;
                  fs.readFile(path.join(folder, "local.json"), "utf8", function(
                    err,
                    jsonDoc
                  ) {
                    placeInfo = JSON.parse(jsonDoc);
                    socket.emit("Linelist", {
                      connectedLines: lineList,
                      kegs: data,
                      lines,
                      beers,
                      placeInfo
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
      if (err) {
        console.error("Error updating line:", err);
        return socket.emit("error", "Database error on update");
      }

      if (data) {
        // Línea existente: devolvemos info del dispositivo
        Keg.findOne({ _id: data.idKeg }, function(err, keg) {
          if (err) {
            console.error("Error finding keg:", err);
            return socket.emit("error", "Database error on keg lookup");
          }
          if (!keg) {
            return socket.emit("disconnectedLine");
          }

          Beer.findOne({ _id: keg.beerId }, function(err, beer) {
            if (err) {
              console.error("Error finding beer:", err);
              return socket.emit("error", "Database error on beer lookup");
            }
            if (!beer) {
              return socket.emit("disconnectedLine");
            }

            fs.readFile(
              path.join(folder, ".emergencyCard.json"),
              "utf8",
              function(err, emergencyDoc) {
                if (err) {
                  console.error("Error reading emergencyCard:", err);
                  return socket.emit("error", "File read error");
                }
                let emergencyCard;
                try {
                  emergencyCard = JSON.parse(emergencyDoc).cardId;
                } catch (parseErr) {
                  console.error("Error parsing emergencyCard:", parseErr);
                  return socket.emit("error", "JSON parse error");
                }

                socket.emit("device info", {
                  ...data._doc,
                  name:        beer.name,
                  style:       beer.style,
                  abv:         keg.abv,
                  ibu:         keg.ibu,
                  emergencyCard
                });
              }
            );
          });
        });

        addLineToList(msg.id, socket.id);
      }
      else {
        // No existía: creamos una nueva línea
        Line.findOne({})
          .sort({ noLinea: -1 })
          .exec(function(err, item) {
            if (err) {
              console.error("Error fetching last line:", err);
              return socket.emit("error", "Database error on line lookup");
            }

            // Si no hay ninguna línea, arrancamos en 1
            const nextNo = item ? item.noLinea + 1 : 1;

            const newLine = new Line({
              _id:       msg.id,
              socketId:  socket.id,
              noLinea:   nextNo
            });

            newLine.save(function(err, saved) {
              if (err) {
                console.error("Error saving new line:", err);
                return socket.emit("error", err.message);
              }

              socket.emit("newLine", saved);
              addLineToList(msg.id, socket.id);
            });
          });
      }
    }
  );
});


    socket.on("disconnect", function() {
      if (!removeLineFromList(socket.id)) {
        removeWorkerSocket(socket.id);
      }
    });
  });
};
