const mongoose = require("mongoose");
const fs = require("fs");
const os = require("os");
const Line = require("./models/Line");
const Worker = require("./models/worker");
const Client = require("./models/Client.js");
const { Keg, Beer, Sale } = require("../app/models");

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
  const findClientByCardId = (cardId) => Client.findOne({ cardId }).exec();
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
    const index = servingList.findIndex((line) => line._id === lineId);
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

  const authenticateUser = async (cardId) => {
    const user = await User.findOne({ cardId: cardId });
    return user ? true : false;
  };

  const getUserCredit = async (id) => {
    const user = await User.findOne({ _id: id });
    return user ? user.credit : 0;
  };

  const deductUserCredit = async (id, concept) => {
    console.warn("deducting credit");
    const worker = await Worker.findOne({ _id: id });
    console.warn("Got worker");
    console.warn(worker.beers);

    if (worker) {
      if (!worker.isStaff) {
        const { pint, taster, flight } = worker.beers;
        switch (concept) {
          case "PINT":
            if (pint > 0) worker.beers.pint--;
            else io.emit("wtf", { worker, concept });
            break;
          case "TASTER":
            if (taster > 0) worker.beers.taster--;
            else io.emit("wtf", { worker, concept });
            break;
          case "FLIGHT":
            if (flight > 0) worker.beers.flight--;
            else io.emit("wtf", { worker, concept });
            break;
          default:
            break;
        }
        worker.markModified("beers");
        worker.save();
      }
    }
  };

  // Handle Socket Events
  const handleChatMessage = (socket) => {
    socket.on("chat message", (msg) => {
      io.emit("chat message", msg);
    });
  };

  const handleWorkerEvents = (socket) => {
    socket.on("getWorker", async (msg) => {
      try {
        let worker = await findWorkerByCardId(msg.cardId);
        if (!worker) {
          console.warn("No worker found");
          const client = await findClientByCardId(msg.cardId);
          if (client) {
            // cliento to worker conversion
            worker = {
              _id: client._id,
              nombre: client.name,
              apellidos: client.lastName,
              cardId: client.cardId,
              credit: 0,
              vip: true,
              beers: { pint: client.benefits.beers, taster: 0, flight: 0 },
            };
            console.warn("Client found: ", client);
          } else console.warn("No client found");
        }

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
      Client.findOne({ _id: msg.clientId }).then((client) => {
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

  const handleLineEvents = (socket) => {
    // Client_request_pour  ====> confirm_pour
    //                        ==> reject_pour

    socket.on("line_not_available", async function (msg) {
      io.emit("line_not_available", msg);
    });

    // Client requests to pour
    socket.on("client_request_pour", async function (msg) {
      try {
        const { lineId, userId, requestedVolume, concept } = msg;

        // Authenticate user and check credit
        const user = await Worker.findOne({ _id: userId }).exec();

        // if (!user || user.credit <= 0) {
        //   socket.emit("error", "User authentication failed or insufficient credit");
        //   return;
        // }

        // Find the keg associated with the selected line
        const line = await Line.findOne({ _id: lineId }).exec();
        if (!line) {
          socket.emit("error", "Invalid line selected");
          return;
        }

        const keg = await Keg.findOne({ _id: line.idKeg }).exec();
        if (!keg) {
          socket.emit("error", "Keg not found for the selected line");
          return;
        }

        // if (keg.available < requestedVolume) {
        //   socket.emit("error", "Not enough beer available");
        //   return;
        // }

        // Deduct the price for the requested volume from the user's credit
        // const beerPrice = await Beer.findOne({ _id: keg.beerId }).exec();
        // const cost = beerPrice.pricePerOZ * requestedVolume;
        // if (user.credit < cost) {
        //   socket.emit("error", "Not enough credit");
        //   return;
        // }

        // user.credit -= cost;
        // await user.save();

        // // check if line is not already pouring
        // if (isLineServing(lineId)) {
        //   socket.emit("line_busy", "Line is already pouring");
        //   return;
        // }

        // add line to serving list
        // addToServing({ lineId, userId, requestedVolume, concept }, socket.id);

        // socket.emit("request_accepted", {
        //   lineId,
        //   userId,
        //   requestedVolume,
        //   concept,
        // });

        // // Check if the line is connected to the server
        console.log(line.socketId);
        console.log(io.sockets.connected[line.socketId]);

        if (io.sockets.connected[line.socketId] === undefined) {
          socket.emit("line_not_available", { id: lineId });
          return;
        }

        io.to(line.socketId).emit("request_device", {
          volume: requestedVolume,
          userId,
          concept,
        });

        // Update keg's available volume (this should ideally be done after confirmation of pour completion)
        // keg.available -= requestedVolume;
        // await keg.save();

        // Optionally, emit a success message or other updates to the client
        // socket.emit('pour_started', { lineId, userId, requestedVolume });
      } catch (error) {
        console.error("Error handling client_request_pour:", error);
        socket.emit("error", "Server error while processing the request.");
      }
    });

    // ESP32 confirms it has started pouring
    socket.on("confirm_order", async function (msg) {
      try {
        // Validate the received message
        // if (
        //   !msg.lineId ||
        //   !msg.userId ||
        //   typeof msg.isAvailable === "undefined"
        // ) {
        //   console.error(`Incomplete confirmation message from ESP32`);
        //   socket.emit("error", "Incomplete confirmation message.");
        //   return;
        // }

        // // Check the availability status sent by the ESP32
        // if (!msg.isAvailable) {
        //   console.error(
        //     `ESP32 reports that Line ${msg.lineId} is not available for pouring`
        //   );
        //   socket.emit("error", "Line is not available.");
        //   return;
        // }

        // // Log the confirmation
        // console.log(
        //   `Pouring started for user ${msg.userId} on line ${msg.lineId}`
        // );

        // // Notify the user/display tablet that pouring is commencing
        // io.emit("pouring_commenced", {
        //   lineId: msg.lineId,
        //   userId: msg.userId,
        // });
        // //TODO: userSocketId
        // // io.to(userSocketId).emit('pouring_commenced', { lineId: msg.lineId, userId: msg.userId });  // userSocketId is the socket ID of the user's device or the display tablet

        io.emit("confirm_order", msg);
      } catch (error) {
        console.error("Error handling confirm_pour:", error);
        socket.emit("error", "Server error while processing the confirmation.");
      }
    });

    // ESP32 or client requests to stop pouring
    socket.on("client_stop", async function (msg) {
      try {
        // Validate the received message
        if (!msg.lineId /* || !msg.workerId */) {
          console.error(`Incomplete stop message from Android tablet`);
          socket.emit("error", "Incomplete stop message.");
          return;
        }

        // Notify the ESP32 line to stop pouring
        // io.to(msg.lineId).emit('stop_pouring', { reason: "User initiated stop" });

        // Log the stop action
        // console.log(`Pouring stopped by user ${msg.workerId} on line ${msg.lineId}`);

        // Store the sale in the DB
        // const sale = new Sale({
        //     workerId: msg.workerId,
        //     kegId: msg.kegId,
        //     concept: "Beer Sale",
        //     qty: msg.qty,
        //     date: new Date()
        // });

        // await sale.save();
        // console.log("Sale saved successfully");

        // Optionally, notify the user/display tablet about the successful stop and sale

        // get line info
        const line = await Line.findOne({ _id: msg.lineId }).exec();

        io.to(line.socketId).emit("stop_pour");

        // socket.emit('stop_pour', { lineId: msg.lineId, userId: msg.workerId });
      } catch (error) {
        console.error("Error handling stop_pour:", error);
        socket.emit("error", "Server error while processing the stop command.");
      }
    });

    // ESP32 updates the server about the pour status
    socket.on("update_status", function (msg) {
      try {
        const { lineId, pouredVolume } = msg;

        // Check again if user has enough credit
        const remainingCredit = 10; /* getUserCredit(userId) - pouredVolume; */
        if (remainingCredit <= 0) {
          socket.emit("stop_pour", { userId });
        }

        // Maybe log or update some real-time monitoring UI
        console.log(`Line ${lineId} has poured ${pouredVolume}ml`);

        io.emit("updated_pour_status", { pouredVolume, lineId });
      } catch (error) {
        console.error("Error in update_status:", error);
        socket.emit("error", "Internal server error");
      }
    });

    // ESP32 signals it has finished pouring
    socket.on("finished_pour", async function (msg) {
      try {
        io.emit("finished_pour", msg);

        var ObjectId = mongoose.Types.ObjectId;
        var newSale = new Sale();

        newSale._id = new ObjectId().toString();
        newSale.date = new Date();

        msg.clientId ? (newSale.clientId = msg.clientId) : null;
        newSale.qty = msg.totalPouredVolume;
        Object.assign(newSale, msg);

        await deductUserCredit(msg.workerId, msg.concept);


        Keg.findOne({ _id: msg.kegId }, (err, data) => {
          if (data) {
            console.log(data.available - msg.qty);
            data.available = data.available - msg.qty;
            switch (msg.concept) {
              case "TASTER":
                data.taster = data.taster + 1;
                break;
              case "FLIGHT":
                data.flight = data.flight + 1;
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
              if (doc) {
                io.emit("sale-commited", { data, doc });
                //res.json({ confirmation: "success", data: doc });
              }
            });
          }
        });        

        newSale.save((err, doc) => {
          if (doc) {
            io.emit("sale-commited", { doc });
            //res.json({ confirmation: "success", data: doc });
          }
        });

        // // Store the sale in the DB
        // const sale = new Sale({
        //     workerId: msg.workerId,
        //     kegId: msg.kegId,
        //     concept: msg.concept,
        //     qty: msg.qty,
        //     date: new Date()
        // });


      } catch (error) {
        console.error("Error in finished_pour:", error);
        socket.emit("error", "Internal server error");
      }
    });
  };

  // Main Connection Handler
  io.on("connection", function (socket) {
    handleDataEvents(socket);
    handleLineEvents(socket);
    handleChatMessage(socket);
    handleWorkerEvents(socket);
  });
};
