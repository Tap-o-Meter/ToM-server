var Line = require("./models/Line");
var Worker = require("./models/worker");
var Keg = require("../app/models/keg");
var Beer = require("../app/models/beer");
var fs = require("fs");
const path = require("path");
const config = require("../config");
const User = require("./models/user");
const { registerSale, redeemBenefitBeer } = require("./sales");
const { getOrCreateLine, buildDeviceInfo } = require("./lineService");
const workerLookup = require("./workerLookup");

// Carpeta de datos (local.json / .emergencyCard.json). Coincide con getSummary
// en routes.js. Override por env var sin tocar código si cambia la máquina.
const folder =
  process.env.DATA_FOLDER || "/home/tom/Documents/Beer_control/data";

module.exports = function(io, lineList, servingList, workerSockets, ioClient, selfpour_socket) {
  const findWorkerByCardId = (cardId) => Worker.findOne({ cardId }).exec();
  const findUserByCardId = (cardId) => User.findOne({ cardId }).exec();

  const convertUserToWorker = (user) => {
    const { _id, name, lastName, cardId, beers } = user;

    return { _id, nombre: name, apellidos: lastName, cardId, beers };
  };

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

  // Respuestas asíncronas del servicio selfpour a getWorker: registrado UNA
  // sola vez y compartido con el canal MQTT (ver workerLookup.js).
  workerLookup.attachSelfpour(selfpour_socket);

  io.on("connection", function(socket) {
    socket.on("chat message", function(msg) {
      io.emit("chat message", msg);
    });

    // socket.io.on("error", error => {
    //   console.log(error);
    // });

    // socket.on("getWorker", msg => {
    //   Worker.findOne({ cardId: msg.cardId }, (err, data) => {
    //     if (data) {
    //       socket.emit("validated user", { confirmation: "success", data });
    //     } else {
    //       socket.emit("validated user", { confirmation: "fail" });
    //     }
    //   });
    // });

    socket.on("getWorker", msg => {
      if (!msg || !msg.cardId) return;
      workerLookup.validateWorker(msg.cardId, (event, payload) =>
        socket.emit(event, payload)
      );
    });


    socket.on("sale_complete", msg => {
      if (!msg || !msg.kegId) return;
      if ((msg.workerId || "").length === 0) {
        selfpour_socket.emit("finished_pour", msg);
        return;
      }
      registerSale(msg)
        .then(({ keg, sale }) => {
          removeFromServing(msg.lineId);
          io.emit("sale-commited", { data: keg, doc: sale });
        })
        .catch(err => console.error("sale_complete:", err.message));
    });

    socket.on("setWorker", msg => {
      console.log("llegó a evento");
      Worker.findOne({ cardId: msg.cardId }, (err, data) => {
        if (data) {
          Line.findOne({ _id: msg.lineId }).then(line => {
            if (!line) return socket.emit("validated user", { confirmation: "fail" });
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
              if (err || !line)
                return socket.emit("errorServing", { msg: "Línea no existe" });
              const socketToEmit = io.sockets.connected[line.socketId];
              const arduinoConcept = config.options[concept];
              if (arduinoConcept === undefined)
                return socket.emit("errorServing", { msg: "Concepto inválido" });
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
        if (status && SocketToEmit) {
          SocketToEmit.emit("start", msg);
        }
      }
    });

    socket.on("getClient", msg => {
      if (!msg || !msg.cardId) return;
      workerLookup.validateClient(msg.cardId, (event, payload) =>
        socket.emit(event, payload)
      );
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
      redeemBenefitBeer(msg).catch(err =>
        console.error("redeemBeer:", err.message)
      );
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
                    try {
                      placeInfo = JSON.parse(jsonDoc);
                    } catch (e) {
                      console.error("client connected: local.json ilegible:", e.message);
                      placeInfo = null;
                    }
                    fs.readFile(
                      path.join(folder, ".emergencyCard.json"),
                      "utf8",
                      function(err, emergencyDoc) {
                        let emergencyCard = null;
                        try {
                          emergencyCard = JSON.parse(emergencyDoc);
                        } catch (e) {
                          console.error("client connected: .emergencyCard.json ilegible:", e.message);
                        }
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
                    try {
                      placeInfo = JSON.parse(jsonDoc);
                    } catch (e) {
                      console.error("worker connected: local.json ilegible:", e.message);
                      placeInfo = null;
                    }
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

    // Misma lógica que el setup MQTT (lineService): buscar/crear la línea y
    // devolverle su "device info", o disconnectedLine si no tiene barril.
    socket.on("setUp", function(msg) {
      if (!msg || !msg.id) return;
      getOrCreateLine(msg.id, socket.id)
        .then(({ line, created }) => {
          if (created) socket.emit("newLine", line);
          addLineToList(msg.id, socket.id);
          return buildDeviceInfo(line).then(info => {
            if (info) socket.emit("device info", info);
            else socket.emit("disconnectedLine");
          });
        })
        .catch(err => {
          console.error("setUp:", err);
          socket.emit("error", "Database error on update");
        });
    });


    socket.on("disconnect", function() {
      if (!removeLineFromList(socket.id)) {
        removeWorkerSocket(socket.id);
      }
    });
  });
};
