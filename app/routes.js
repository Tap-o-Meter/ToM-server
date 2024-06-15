// app/routes.js
const fs = require("fs");
const path = require("path");
const multer = require("multer");
var mongoose = require("mongoose");
const config = require("../config");
var Keg = require("../app/models/keg");
const cloudinary = require("cloudinary");
var Beer = require("../app/models/beer");
var Sale = require("../app/models/sale");
var Line = require("../app/models/Line");
const { exec } = require("child_process");
var Stock = require("../app/models/stock");
var Worker = require("../app/models/worker");
const { publishEvent } = require('../config/mqRabbit');
const cloudinaryStorage = require("multer-storage-cloudinary");

const { cloud_name, api_key, api_secret } = config;
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error("Incorrect file");
    error.code = "INCORRECT_FILETYPE";
    return cb(error, false);
  }
  cb(null, true);
};

cloudinary.config({ cloud_name, api_key, api_secret });

const cloudinary_Storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: "Chikilla",
  allowedFormats: ["jpg", "png"]
});
const parser = multer({
  storage: cloudinary_Storage,
  limits: { fieldSize: 25 * 1024 * 1024 }
});

var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const logoPath = "/home/pi/Documents/dist";
    const mainPath = path.dirname(require.main.filename) + "/images";
    const destination =
      req.route.path === "/editPlaceInfo" ? logoPath : mainPath;
    cb(null, destination);
  },
  filename: function(req, file, cb) {
    const extensions = [".jpeg", ".jpg", ".png"];
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    const index = allowedTypes.findIndex(type => type.includes(file.mimetype));
    const imageName = req.route.path === "/editPlaceInfo" ? "logo" : Date.now();
    cb(null, imageName + extensions[index]);
  }
});

var upload = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: 1000000 }
});

module.exports = function(app, io) {
  app.get("/", function(req, res) {
    res.render("index.ejs"); // load the index.ejs file
  });

  function fileUpload(req, res, next) {
    parser.single("file")(req, res, next);
    upload.array("file")(req, res, () => null);
  }

  app.get("/getImage/:name", function(req, res) {
    const file =
      path.dirname(require.main.filename) + "/images/" + req.params.name;
    if (fs.existsSync(file)) res.sendFile(path.resolve(file));
    else res.status(422).json({ error: "There's no Image" });
  });

  app.post("/addPersonal", upload.single("file"), function(req, res) {
    var ObjectId = mongoose.Types.ObjectId;
    var newWorker = new Worker();
    newWorker._id = new ObjectId().toString();
    newWorker.foto = req.file ? req.file.filename : null;
    Object.assign(newWorker, req.body);
    Worker.findOne({ cardId: req.body.cardId })
      .then(data => {
        if (data) res.json({ confirmation: "fail", message: "user exist" });
        else {
          newWorker.save(function(err, doc) {
            if (doc) res.json({ confirmation: "success", data: newWorker });
            else res.json({ confirmation: "fail" });
          });
        }
      })
      .catch(err => res.json({ confirmation: "FAIL" }));
  });


  // app.post("/claim-benefit", function(req, res) {
  //   const { cardId, benefit, lineId } = req.body;
  //   console.warn("cardId: "+cardId);
  //   console.warn("benefit: "+benefit);
  //   console.warn("lineId: "+lineId);
  //   Client.findOne({ cardId: cardId })
  //     .then(data => {
  //       if (data) {
  //         switch (benefit) {
  //           case "beers":
  //             if (data.benefits.beers > 0) {
  //               Line.findOne({ _id: lineId }).then(line => {
  //                 console.warn("Sí llegó y encontró");
  //                 const socket = io.sockets.connected[line.socketId];
  //                 console.warn(io.sockets.connected);
  //                 console.warn("éste es el socket "+socket);
  //                 console.warn("y éste es el socketId "+line.socketId);

  //                 if (socket) socket.emit("claimBeer", data._id);
  //                 else {
  //                   const beers = data.benefits.beers;
  //                   data.benefits.beers = beers - 1;
  //                   data.markModified("benefits");
  //                   data.save();
  //                 }
  //               });
  //             }
  //             res.json({ confirmation: "success", data });
  //             break;
  //           default:
  //             break;
  //         }
  //       } else res.json({ confirmation: "fail" });
  //     })
  //     .catch(err => {
  //       res.json({ confirmation: "FAIL" });
  //     });
  // });


  app.post("/editPersonal", upload.single("file"), function(req, res) {
    Worker.findOne({ _id: req.body.id })
      .then(data => {
        if (data) {
          if (req.file && data.foto) {
            const mainPath = path.dirname(require.main.filename) + "/images/";
            fs.unlink(mainPath + data.foto, function(err) {});
          }
          data.nombre = req.body.nombre;
          data.apellidos = req.body.apellidos;
          data.cardId = req.body.cardId;
          data.foto = req.file ? req.files[0].filename : data.foto;
          data.markModified("cardId");
          data.save();
          res.json({ confirmation: "success", data });
        } else res.json({ confirmation: "fail" });
      })
      .catch(err => {
        console.log(err);
        res.json({ confirmation: "FAIL" });
      });
  });

  app.post("/deleteWorker", function(req, res) {
    Worker.remove({ _id: req.body.id })
      .then(err => {
        if (err) res.json({ confirmation: "fail" });
        else res.json({ confirmation: "success" });
      })
      .catch(err => res.json({ confirmation: "FAIL" }));
  });

  app.get("/getWorkers", function(req, res) {
    Worker.find({})
      .then(data => {
        if (data) res.json({ confirmation: "success", data });
        else res.json({ confirmation: "fail" });
      })
      .catch(err => res.json({ confirmation: "FAIL" }));
  });

  app.get("/getBeerInfo/:idKeg", function(req, res) {
    Keg.findOne({ _id: req.params.idKeg })
      .then(keg => {
        if (keg) {
          console.log(keg.beerId);
          Beer.findOne({ _id: keg.beerId }).then(beer => {
            if (beer)
              res.json({ confirmation: "success", data: { keg, beer } });
            else res.json({ confirmation: "fail" });
          });
        } else res.json({ confirmation: "fail" });
      })
      .catch(err => res.json({ confirmation: "FAIL" }));
  });

  app.get("/client-purchase/:clientId", function(req, res) {
    const fullDate = new Date();
    Sale.find({
      clientId: req.params.clientId,
      date: { $gte: new Date(fullDate.getFullYear(), fullDate.getMonth(), 1) }
    })
      .then(async sales => {
        console.log(sales);
        if (sales.length > 0) {
          const salesWithBeer = [];
          sales.map((sale, index) => {
            var beerName = "";
            Keg.findOne({ _id: sale.kegId }).then(keg => {
              if (keg) {
                Beer.findOne({ _id: keg.beerId }).then(beer => {
                  salesWithBeer.push({ ...sale._doc, beerName: beer.name });
                  if (index === sales.length - 1)
                    res.json({ confirmation: "success", data: salesWithBeer });
                });
              }
            });
          });
        } else res.json({ confirmation: "success", data: [] });
      })
      .catch(err => res.json({ confirmation: "FAIL" }));
  });

  app.get("/getStorage", function(req, res) {
    exec("df -h", (error, stdout, stderr) => {
      if (error || stderr) {
        console.log(`error: ${error.message}`);
        res.json({ confirmation: "fail" });
      } else res.json({ confirmation: "success", data: stdout });
    });
  });


  app.post("/getWorker", function(req, res) {
    console.warn(req.body);
    Worker.findOne({ cardId: req.body.cardId }, function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.post("/getLine", function(req, res) {
    Line.findOne({ _id: req.body.lineId }, function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.post("/editPlaceInfo", upload.single("file"), function(req, res) {
    const path = "/home/pi/Documents/Beer_control/data";
    fs.writeFile(
      path + "/local.json",
      JSON.stringify(req.body),
      "utf-8",
      function(err) {
        if (err) res.json({ confirmation: "fail" });
        else res.json({ confirmation: "success" });
      }
    );
  });

  app.post("/addEmergencyCard", function(req, res) {
    const path = "/home/pi/Documents/Beer_control/data";
    fs.writeFile(
      path + "/.emergencyCard.json",
      JSON.stringify(req.body),
      "utf-8",
      function(err) {
        if (err) res.json({ confirmation: "fail" });
        else {
          io.emit("addEmergencyCard", { data: req.body.cardId });
          res.json({ confirmation: "success" });
        }
      }
    );
  });

  app.post("/disconnectLine", function(req, res) {
    Line.findOne({ noLinea: req.body.noLinea }, function(err, data) {
      if (data) {
        Keg.findOne({ _id: data.idKeg }, function(err, keg) {
          if (keg) {
            keg.status = "DISCONNECTED";
            keg.markModified("status");
            keg.save();
          }
        });
        data.idKeg = "";
        data.markModified("idKeg");
        data.save();
        const socket = io.sockets.connected[data.socketId];
        if (socket) socket.emit("disconnectedLine");
        res.json({ confirmation: "success" });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.post("/deleteKeg", function(req, res) {
    Keg.findOne({ _id: req.body.id }, (err, keg) => {
      if (keg) {
        keg.status = "EMPTY";
        keg.markModified("status");
        keg.save();
        res.json({ confirmation: "success" });
      } else res.json({ confirmation: "fail" });
    });
  });

  app.post("/sale_completed", function(req, res) {
    var ObjectId = mongoose.Types.ObjectId;
    var newSale = new Sale();
    newSale._id = new ObjectId().toString();
    newSale.date = new Date();
    req.body.clientId ? (newSale.clientId = req.body.clientId) : null;
    Object.assign(newSale, req.body);
    Keg.findOne({ _id: req.body.kegId }, (err, data) => {
      if (data) {
        console.log(data.available - req.body.qty);
        data.available = data.available - req.body.qty;
        switch (req.body.concept) {
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
          // if (req.body.clientId) {
          //   Client.findOne({ _id: req.body.clientId }, (err, client) => {
          //     if (client) {
          //       client.beersDrinked++;
          //       client.markModified("beersDrinked");
          //       client.save();
          //     }
          //   });
          // }
          if (doc) {
            res.json({ confirmation: "success", data: doc });
          } else {
            res.json({ confirmation: "fail" });
          }
        });
      } else res.json({ confirmation: "fail" });
    });
  });

  ////////////////////////////////////////////////////////////////////
  //                                                                //
  //     Remember Asshole the CONCEPT is a INT those are in the     //
  //     screen.h in the ARDUINO CODE                               //
  //                                                                //
  ////////////////////////////////////////////////////////////////////

  app.post("/remote-sale", function(req, res) {
    const { cardId, lineId, concept } = req.body;
    Worker.findOne({ cardId }, (err, data) => {
      if (data) {
        // ======================== Here We must use some sort of conditional to watch the state of the line ========================
        if (true) {
          Line.findOne({ _id: lineId }, (err, line) => {
            const socket = io.sockets.connected[line.socketId];
            const arduinoConcept = config.options[concept];
            if (socket) {
              socket.emit("remoteSell", {
                confirmation: "success",
                data,
                concept: arduinoConcept
              });
              res.json({ confirmation: "success" });
            } else res.json({ confirmation: "LL not connected" });
          });
        } else res.json({ confirmation: "No Staff nor beers" });
      } else res.json({ confirmation: "No Worker Exist" });
    });
  });

  app.get("/sales/:from/:to", function(req, res) {
    const fullDate = new Date();
    var lastDay;
    if (req.params.to != null)
      lastDay = new Date(fullDate.getFullYear(), req.params.to, 1);
    else
      lastDay = new Date(fullDate.getFullYear(), salesPeriod.getMonth() + 1, 0);

    //  date: { $gte: salesPeriod, $lt: lastDay } },
    Sale.find(
      {
        date: {
          $gte: new Date(fullDate.getFullYear(), req.params.from, 1),
          $lt: lastDay
        }
      },
      (err, data) => {
        if (data) {
          res.json({ confirmation: "success", data: data });
        } else {
          res.json({ confirmation: "fail" });
        }
      }
    );
  });

  app.post("/connect-line", function(req, res) {
    const date = new Date();
    Line.findOne({ _id: req.body.id }, (err, line) => {
      if (line) {
        if (line.idKeg) {
          Keg.findOne({ _id: line.idKeg }, (err, oldKeg) => {
            if (oldKeg) {
              oldKeg.status = req.body.newStatus;
              oldKeg.lastLine = {
                noLinea: line.noLinea,
                date:
                  date.getFullYear() +
                  "/" +
                  date.getMonth() +
                  "/" +
                  date.getDate()
              };
              oldKeg.markModified("status");
              oldKeg.save();
            } else res.json({ confirmation: "fail" });
          });
        }
        Keg.findOne({ _id: req.body.newKeg }, (err, newKeg) => {
          if (newKeg) {
            newKeg.status = "CONNECTED";
            newKeg.markModified("status");
            newKeg.save();
            line.idKeg = req.body.newKeg;
            line.markModified("idKeg");
            line.save();
            //const socket = io.sockets.connected[line.socketId];
            io.emit("changeLine", { data: line });
            res.json({ confirmation: "success", data: line });
          } else res.json({ confirmation: "fail" });
        });
      } else res.json({ confirmation: "fail" });
    });
  });

  app.post("/keg_sales", function(req, res) {
    Sale.find({ kegId: req.body.kegId }, (err, data) => {
      if (err) {
        res.json({ confirmation: "fail" });
      } else {
        var promises = data.map(async function(sale) {
          const keg = await Keg.findOne({ _id: sale.kegId }).exec();
          const beer = await Beer.findOne({ _id: keg.beerId }).exec();
          return { ...sale._doc, beerName: beer.name };
        });

        Promise.all(promises)
          .then(function(results) {
            console.log("se armo");
            res.json({ confirmation: "success", data: results });
          })
          .catch(err => console.log(err.message));
      }
    });
  });

  app.post("/worker_sales", function(req, res) {
    const fullDate = new Date();
    const salesPeriod =
      req.body.period > -1
        ? new Date(fullDate.getFullYear(), req.body.period, 1)
        : new Date(fullDate.getFullYear(), fullDate.getMonth(), 1);
    const lastDay = new Date(
      fullDate.getFullYear(),
      salesPeriod.getMonth() + 1,
      0
    );
    Sale.find(
      { workerId: req.body.id, date: { $gte: salesPeriod, $lt: lastDay } },
      (err, data) => {
        if (err) {
          res.json({ confirmation: "fail" });
        } else {
          var promises = data.map(async function(sale) {
            const keg = await Keg.findOne({ _id: sale.kegId }).exec();
            const beer = await Beer.findOne({ _id: keg.beerId }).exec();
            return { ...sale._doc, beerName: beer.name };
          });

          Promise.all(promises)
            .then(function(results) {
              console.log("se armo");
              res.json({ confirmation: "success", data: results });
            })
            .catch(err => console.log(err.message));
        }
      }
    );
  });

  app.get("/placeLogo", function(req, res) {
    const folder = "/home/pi/Documents/dist/";
    var fileName;
    fs.readdirSync(folder).forEach(file => {
      if (file.includes("logo")) {
        console.log(folder + file);
        fileName = folder + file;
      }
    });
    if (fileName) res.sendFile(path.resolve(fileName));
    else res.status(422).json({ error: "There's no Image" });
  });

  app.get("/setPlaceLogo", function(req, res) {
    const folder = "/home/pi/Documents/dist/";
    var fileName;
    fs.readdirSync(folder).forEach(file => {
      if (file.includes("logo")) {
        console.log(folder + file);
        fileName = folder + file;
      }
    });
    if (fileName) res.sendFile(path.resolve(fileName));
    else res.status(422).json({ error: "There's no Image" });
  });

  app.post("/setSchedule", function(req, res) {
    const { id, horario } = req.body;
    Worker.findOne({ _id: id }, (err, data) => {
      const decodedData = JSON.parse(horario);
      if (data) {
        console.log(decodedData);
        data.horario = decodedData;
        data.markModified("horario");
        data.save((err, worker) => {
          if (worker) {
            res.json({ confirmation: "success", data: worker });
          } else {
            res.json({ confirmation: "FAIL" });
          }
        });
      } else {
        res.json({ confirmation: "FAIL" });
      }
    });
  });

  app.post("/upload", fileUpload, (req, res, next) => {
    res.json({ local: req.files[0].filename, cloud: req.file.secure_url });
  });

  app.post("/addKeg", function(req, res) {
    var responseFlag = 0;
    for (var i = 0; i < req.body.qty; i++) {
      const ObjectId = mongoose.Types.ObjectId;
      const newKeg = new Keg();
      newKeg._id = new ObjectId().toString();
      newKeg.available = req.body.capacity;
      // newKeg.image = req.file ? req.files[0].filename : null;
      Object.assign(newKeg, req.body);
      newKeg.save(function(err, doc) {
        responseFlag++;
        console.log(responseFlag + " " + req.body.qty);
        if (responseFlag == req.body.qty) {
          if (doc) {
            res.json({ confirmation: "success", data: newKeg });
          } else {
            res.json({ confirmation: "fail" });
          }
        }
      });
    }
  });
  ////////////////////////////////////////////////////////////////////////
  app.post("/addStock", upload.single("file"), function(req, res) {
    // local: req.files[0].filename, cloud: req.file.secure_url
    var ObjectId = mongoose.Types.ObjectId;
    var newStock = new Stock();
    newStock._id = new ObjectId().toString();
    newStock.image = req.file ? req.file.filename : null;
    Object.assign(newStock, req.body);
    newStock.save(function(err, doc) {
      if (doc) {
        res.json({
          confirmation: "success",
          data: newStock
          // file: req.files[0].filename,
          // path: path.dirname(require.main.filename)
        });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.get("/getStock", function(req, res) {
    Stock.find({}, function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.post("/deletStock", function(req, res) {
    Stock.remove({ _id: req.body.id }, function(err) {
      if (err) {
        res.json({ confirmation: "fail" });
      } else {
        res.json({ confirmation: "success" });
      }
    });
  });

  app.post("/subtract_inventory", function(req, res) {
    const items = req.body.items;
    items.forEach(item => {
      Stock.findOne({ _id: item.id }, (err, data) => {
        if (err) res.json({ confirmation: "fail" });
        else {
          data.volume = data.volume - item.value;
          data.markModified("volume");
          data.save();
        }
      });
      res.json({ confirmation: "success" });
    });
  });

  app.post("/add_inventory", function(req, res) {
    const items = req.body.items;
    items.forEach(item => {
      Stock.findOne({ _id: item.id }, (err, data) => {
        if (err) res.json({ confirmation: "fail" });
        else {
          data.volume = data.volume + parseInt(item.value);
          data.markModified("volume");
          data.save();
        }
      });
      res.json({ confirmation: "success" });
    });
  });

  ////////////////////////////////////////////////////////////////////////

  app.get("/getKegs", function(req, res) {
    Keg.find({ status: { $ne: "EMPTY" } }, function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.post("/addBeer", fileUpload, function(req, res) {
    // local: req.files[0].filename, cloud: req.file.secure_url
    console.warn(req.body);

    var ObjectId = mongoose.Types.ObjectId;
    var newBeer = new Beer();
    newBeer._id = new ObjectId().toString();
    newBeer.image = req.file ? req.files[0].filename : null;
    newBeer.cloudImage = req.file ? req.file.secure_url : null;
    newBeer.srm = req.body.srm[0];
    newBeer.ibu = req.body.ibu[0];
    newBeer.abv = req.body.abv[0];
    newBeer.name = req.body.name[0];
    newBeer.brand = req.body.brand[0];

    newBeer.style = req.body.style[0];
    newBeer.type = req.body.type[0];
    newBeer.description = req.body.description[0]; //////   --------------------------> description cambiar a description !!!!!!!!!!!!!
    console.warn(req.body);
    newBeer.save(function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail", err });
      }
    });
  });

  app.post("/editBeer", fileUpload, function(req, res) {
    Beer.findOne({ _id: req.body.id[0] }).then(data => {
      if (data) {
        if (req.file && data.image) {
          const mainPath = path.dirname(require.main.filename) + "/images/";
          fs.unlink(mainPath + data.image, function(err) {});
        }
        data.name = req.body.name[0];
        data.brand = req.body.brand[0];
        data.style = req.body.style[0];
        data.type = req.body.type[0];
        data.abv = req.body.abv[0];
        data.ibu = req.body.ibu[0];
        data.description = req.body.description[0]; //////   --------------------------> description cambiar a description !!!!!!!!!!!!!
        data.srm = req.body.srm[0];
        data.image = req.file ? req.files[0].filename : data.image;
        data.cloudImage = req.file ? req.file.secure_url : data.cloudImage;
        data.markModified("name");
        data.save();
        res.json({ confirmation: "success", data });
      } else res.json({ confirmation: "fail" });
    });
  });

  app.get("/getBeers", function(req, res) {
    Beer.find(req.body, function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.get("/getSummary", function(req, res) {
    Keg.find({ status: { $ne: "EMPTY" } }, function(err, kegs) {
      if (kegs) {
        Beer.find({}, function(err, beers) {
          if (beers) {
            Line.find({})
              .sort({ noLinea: "asc" })
              .exec()
              .then(lines => {
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

                    const fullDate = new Date();

                    const salesPeriod = new Date(
                      fullDate.getFullYear(),
                      fullDate.getMonth(),
                      1
                    );

                    const lastDay = new Date(
                      fullDate.getFullYear(),
                      salesPeriod.getMonth() + 1,
                      0
                    );

                    Sale.find(
                      { date: { $gte: salesPeriod, $lt: lastDay } },
                      (err, sales) => {
                        if (sales) {
                          Stock.find({}, function(err, stock) {
                            if (stock) {
                              Worker.find({}).then(workers => {
                                if (workers)
                                  res.json({
                                    confirmation: "success",
                                    data: {
                                      kegs,
                                      lines,
                                      beers,
                                      placeInfo,
                                      emergencyCard,
                                      sales,
                                      stock,
                                      workers
                                    }
                                  });
                                else res.json({ confirmation: "fail" });
                              });
                            } else res.json({ confirmation: "fail" });
                          });
                        } else res.json({ confirmation: "fail" });
                      }
                    );
                  });
                });
              });
          } else res.json({ confirmation: "fail" });
        });
      } else res.json({ confirmation: "fail" });
    });
  });

  app.use((err, req, res, next) => {
    if (err.code === "INCORRECT_FILETYPE") {
      res.status(422).json({ error: "Only beer_data/images are allowed" });
      return;
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(422).json({ error: "Allow file size is 500KB" });
      return;
    }
  });

  app.use(function(req, res, next) {
    res.status(404).send("Sorry cant find that!");
  });
};
//esto si está bien
