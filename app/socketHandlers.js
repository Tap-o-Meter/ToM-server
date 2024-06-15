const mongoose = require("mongoose");
const fs = require("fs");
const os = require("os");
const Line = require("./models/Line");
const Worker = require("./models/worker");
const { Keg, Beer, Sale } = require("../app/models");
const { publishEvent } = require("../config/mqRabbit");

module.exports = function (io, lineList, servingList, workerSockets, ioClient) {
  // Utility Functions
  const findIndexByKeyValue = (list, key, value) =>
    list.findIndex((item) => item[key] === value);
  const readJSONFile = (path) => {
    return new Promise((resolve, reject) => {
      fs.readFile(path, "utf8", (err, data) => {
        if (err) return reject(err);
        resolve(JSON.parse(data));
      });
    });
  };

  // Database Helper Functions
  const findWorkerByCardId = (cardId) => Worker.findOne({ cardId }).exec();
  const getKegs = () => Keg.find({ status: { $ne: "EMPTY" } }).exec();
  const getBeers = () => Beer.find({}).exec();
  const getSortedLines = () => Line.find({}).sort({ noLinea: "asc" }).exec();

  // Socket Management Functions
  const addLineToList = (id, socket) => {
    let index = findIndexByKeyValue(lineList, "id", id);

    index === -1
      ? lineList.push({ id, socket })
      : (lineList[index].socket = socket);
    io.emit("lineConnected", { id, socket });
  };

  const removeLineFromList = (socketId) => {
    const index = lineList.findIndex((line) => line.socket === socketId);
    if (index !== -1) {
      lineList.splice(index, 1);
      io.emit("lineDisconnected", { socket: socketId });
      return true;
    }
    return false;
  };

  const addWorkerSocket = (id, socket) => {
    let index = workerSockets.findIndex((worker) => worker._id === id);
    index === -1
      ? workerSockets.push({ id, socket })
      : (workerSockets[index].socket = socket);
    io.emit("workerSocketRegistered", { id, socket });
  };

  const getWorkerSocket = (workerId) => {
    const index = workerSockets.findIndex((worker) => worker.id === workerId);
    return index !== -1 ? workerSockets[index].socket : false;
  };

  const removeWorkerSocket = (socketId) => {
    const index = workerSockets.findIndex(
      (worker) => worker.socket === socketId
    );
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
      (serving) => serving.lineId === sell.lineId
    );
    if (index === -1) {
      servingList.push({ ...sell, workerSocket });
      return true;
    } else {
      return false;
    }
  };

  const isLineServing = (lineId) => {
    const index = workerSockets.findIndex((line) => line.socket === socketId);
    return index !== -1;
  };

  const removeFromServing = (lineId) => {
    const index = servingList.findIndex((serving) => lineId === serving.lineId);
    index === -1 ? null : servingList.splice(index, 1);
    io.emit("removedFromServing", { lineId });
  };

  function fetchLocalData(socket, kegs, lines, beers) {
    const folder = `${os.homedir()}/Documents/Beer_control/data`;
    fs.readFile(`${folder}/local.json`, "utf8", (err, jsonDoc) => {
      if (err) {
        // Handle error.
        console.error("Error reading local.json:", err);
        return;
      }

      console.log(jsonDoc);
      const placeInfo = JSON.parse(jsonDoc);
      socket.emit("Linelist", {
        connectedLines: lineList, // Make sure lineList is accessible and defined
        kegs,
        lines,
        beers,
        placeInfo,
      });
    });
  }

  // Handle Socket Events
  const handleChatMessage = (socket) => {
    socket.on("chat message", (msg) => {
      io.emit("chat message", msg);
    });
  };

  const handleWorkerEvents = (socket) => {
    socket.on("getWorker", async (msg) => {
      try {
        const worker = await findWorkerByCardId(msg.cardId);
        socket.emit(
          "validated user",
          worker
            ? { confirmation: "success", data: worker }
            : { confirmation: "fail" }
        );
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("setWorker", (msg) => {
      console.log("llegó a evento");
      Worker.findOne({ cardId: msg.cardId }, (err, data) => {
        if (data) {
          Line.findOne({ _id: msg.lineId }).then((line) => {
            const socket = io.sockets.connected[line.socketId];
            if (socket)
              socket.emit("validated user", { confirmation: "success", data });
            else {
              // const beers = data.benefits.beers;
              // data.benefits.beers = beers - 1;
              // data.markModified("benefits");
              // data.save();
            }
          });
        } else {
          socket.emit("validated user", { confirmation: "fail" });
        }
      });
    });

    socket.on("remoteSell", (msg) => {
      const { cardId, lineId, concept } = msg;
      Worker.findOne({ cardId }, (err, data) => {
        if (data) {
          if (!isLineServing(lineId)) {
            Line.findOne({ _id: lineId }, (err, line) => {
              const socket = io.sockets.connected[line.socketId];
              const arduinoConcept = config.options[concept];
              if (socket) {
                socket.emit("remoteSell", {
                  confirmation: "success",
                  data,
                  concept: arduinoConcept,
                });
              } else {
                socket.emit("errorServing", { msg: "LL not connected" });
              } // res.json({ confirmation: "LL not connected" });
            });
          } else {
            socket.emit("errorServing", { msg: "Línea ocupada" });
          } //res.json({ confirmation: "No Staff nor beers" });
        } else {
          socket.emit("errorServing", { msg: "No Worker Exist" });
        } //res.json({ confirmation: "No Worker Exist" });
      });
    });

    socket.on("checkInSell", (msg) => {
      const workerSocket = getWorkerSocket(msg.workerId);
      if (workerSocket) {
        const SocketToEmit = io.sockets.connected[workerSocket];
        const status = addToServing(msg, workerSocket);
        if (status) {
          SocketToEmit.emit("start", msg);
        }
        // ============================== Handle with some sort of shit if cannot find client ==============================
      }
      // ============================== Handle with some sort of shit if cannot find client ==============================
    });

    socket.on("getClient", async (msg) => {
      try {
        const client = await findClientByCardId(msg.cardId);
        socket.emit(
          "validated user",
          client
            ? { confirmation: "success", data: client }
            : { confirmation: "fail" }
        );
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("redeemBeer", (msg) => {
      console.log("llegó a evento");
      publishEvent("sale_events", {
        type: "redeemBeer",
        data: { clientId: msg.clientId },
      });

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
  };

  const handleDataEvents = (socket) => {
    socket.on("getBeersInfo", (msg) => {
      console.log(msg);
      var promises = msg.kegList.map(async function (kegId) {
        const keg = await Keg.findOne({ _id: kegId }).exec();
        console.log(keg);
        const beer = await Beer.findOne({ _id: keg.beerId }).exec();
        return { beer, keg };
      });
      Promise.all(promises)
        .then(function (results) {
          console.log("se armo");
          socket.emit("beersInfo", { data: results });
        })
        .catch((err) => console.log(err.message));
    });

    socket.on("updateData", () => {
      Keg.find({ status: "CONNECTED" }, function (err, kegs) {
        if (kegs) {
          Beer.find({}, function (err, beers) {
            if (beers) {
              Line.find({})
                .sort({ noLinea: "asc" })
                .exec()
                .then((lines) => {
                  console.log(JSON.stringify({ kegs, lines, beers }));
                  ioClient.emit("update data", { kegs, lines, beers });
                });
            }
          });
        }
      });
    });

    socket.on("client connected", async () => {
      try {
        const [kegs, beers, lines] = await Promise.all([
          getKegs(),
          getBeers(),
          getSortedLines(),
        ]);

        if (kegs && beers) {
          const folder = `${os.homedir()}/Documents/Beer_control/data`;
          const placeInfo = await readJSONFile(`${folder}/local.json`);
          const emergencyCard = await readJSONFile(
            `${folder}/.emergencyCard.json`
          );

          ioClient.emit("chat message", {
            lineList,
            lines,
            beers,
          });

          socket.emit("Linelist", {
            connectedLines: lineList,
            data: kegs,
            lines,
            beers,
            placeInfo,
            emergencyCard,
          });
        }
      } catch (err) {
        console.error("Error during client connection:", err);
      }
    });

    socket.on("desk_manager_connected", () => {
      socket.emit("connectedLines", { connectedLines: lineList });
    });

    socket.on("worker connected", async () => {
      addWorkerSocket("5eb7698b423ce36b02c7ab54", socket.id);
      // If you later need to use msg.id instead, remember to make sure 'msg' is defined and accessible.

      try {
        const kegs = await getKegs();
        const beers = await getBeers();
        const lines = await getSortedLines();

        if (kegs && beers && lines) {
          fetchLocalData(socket, kegs, lines, beers);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    });

    socket.on("setUp", function (msg) {
      Line.findOneAndUpdate(
        { _id: msg.id },
        { $set: { socketId: socket.id } },
        { new: true },
        (err, data) => {
          if (data) {
            Keg.findOne({ _id: data.idKeg }, function (err, keg) {
              if (keg) {
                Beer.findOne({ _id: keg.beerId }, function (err, beer) {
                  if (beer) {
                    const folder = "/home/tom/Documents/Beer_control/data";
                    fs.readFile(
                      folder + "/.emergencyCard.json",
                      "utf8",
                      function (err, emergencyDoc) {
                        const emergencyCard = JSON.parse(emergencyDoc);
                        console.warn(emergencyDoc);
                        // const emergencyCard = "";
                        socket.emit("device info", {
                          ...data._doc,
                          name: beer.name,
                          style: beer.style,
                          abv: keg.abv,
                          ibu: keg.ibu,
                          emergencyCard: emergencyCard.cardId,
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
              .exec(function (err, item) {
                var newLine = new Line();
                newLine._id = msg.id;
                newLine.socketId = socket.id;
                newLine.noLinea = item.noLinea + 1;
                newLine.save(function (err) {
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

    socket.on("disconnect", function () {
      if (!removeLineFromList(socket.id)) {
        removeWorkerSocket(socket.id);
      }
    });
  };

  // Main Connection Handler
  io.on("connection", function (socket) {
    handleChatMessage(socket);
    handleWorkerEvents(socket);
    handleDataEvents(socket);
  });
};
