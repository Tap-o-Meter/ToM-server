// app/routes.js
var mongoose = require("mongoose");
var Place = require("../app/models/place");
var User = require("../app/models/user");
var Cita = require("../app/models/cita");
var Worker = require("../app/models/worker");
var path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary");
const cloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: "hwx5qacnd",
  api_key: "732127336931133",
  api_secret: "Jg40bHx0UIewDX5DjFU-uIQP9sY"
});

const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: "bnt",
  allowedFormats: ["jpg", "png"]
});
const parser = multer({
  storage: storage,
  limits: { fieldSize: 25 * 1024 * 1024 }
});

module.exports = function(app, passport) {
  app.get("/", function(req, res) {
    res.render("index.html"); // load the index.ejs file
  });

  app.post("/login", function(req, res, next) {
    passport.authenticate("local-login", function(err, user, info) {
      if (!user) {
        return res.json({ confirmation: "fail" });
      } else {
        if (user.type === "partner") {
          Place.findOne({ owner: user._id }, function(err, data) {
            if (err) {
              res.json({ confirmation: "fail" });
            } else {
              return res.json({
                confirmation: "success",
                data: { ...user._doc, place: data }
              });
            }
          });
        } else {
          return res.json({ confirmation: "success", data: user });
        }
      }
    })(req, res, next);
  });

  // process the signup form
  app.post("/signup", function(req, res, next) {
    passport.authenticate("local-signup", function(err, user, info) {
      if (!user) {
        return res.json({ confirmation: "fail" });
      } else {
        return res.json({ confirmation: "success", data: user });
      }
    })(req, res, next);
  });

  app.post("/uploadPicture", parser.array("image"), function(req, res) {
    console.log(req.files); // to see what is returned to you
    const urls = req.files.map(({ url }) => url);
    return res.json({ confirmation: "success", data: urls });
  });

  app.post("/uploadWorker", parser.array("image", 3), function(req, res) {
    const urls = req.files.map(({ url }) => {
      var ObjectId = mongoose.Types.ObjectId;
      var newWorker = new Worker();
      newWorker._id = new ObjectId().toString();
      const worker = { ...req.body, foto: url };
      worker.horarios = [{}, {}, {}];
      worker.turno = req.body.turno.split(",");
      Object.assign(newWorker, worker);
      newWorker
        .save()
        .then(data => res.json({ confirmation: "success", data }))
        .catch(err => res.json({ confirmation: "FAIL" }));
    });
  });

  app.post("/addPlace", function(req, res, next) {
    var newPlace = new Place();
    Object.assign(newPlace, req.body);
    User.findOneAndUpdate(
      { _id: { $regex: ".*" + req.body.owner }, type: "onProcess" },
      { $set: { type: "partner" } },
      { new: true, strict: false },
      (err, doc) => {
        if (doc) {
          newPlace.owner = doc._id;
          newPlace.categoria = req.body.categoria.split(",");
          newPlace.dias = req.body.dias.split(",");
          newPlace.horario = req.body.horario.split("-");
          newPlace.save(function(err) {
            if (doc) {
              res.json({ confirmation: "success", data: newPlace });
            } else {
              res.json({ confirmation: "fail", err: "onSave" });
            }
          });
        } else {
          res.json({ confirmation: "fail", err: "noUser" });
        }
      }
    );
  });

  app.get("/getPlaces", function(req, res, next) {
    Place.find({}, function(err, data) {
      if (err) {
        res.json({ confirmation: "fail" });
      } else {
        const places = JSON.parse(JSON.stringify(data));
        return res.json({ confirmation: "success", data: places });
      }
    });
  });

  app.post("/addPersonal", function(req, res) {
    var ObjectId = mongoose.Types.ObjectId;
    var newWorker = new Worker();
    newWorker._id = new ObjectId().toString();
    Object.assign(newWorker, req.body);
    newWorker.save(function(err, doc) {
      if (doc) {
        res.json({ confirmation: "success", data: newWorker });
      } else {
        console.log(err.message);
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.post("/getPersonal", function(req, res) {
    Worker.find({ workerAt: req.body.idPlace })
      .then(data => res.json({ confirmation: "success", data: data }))
      .catch(err => res.json({ confirmation: "FAIL" }));
  });

  app.post("/getWorker", function(req, res) {
    Worker.findOne({ _id: req.body.id })
      .then(data => res.json({ confirmation: "success", data: data }))
      .catch(err => res.json({ confirmation: "FAIL" }));
  });

  app.post("/updateHorarios", function(req, res) {
    const { id, index, horario } = req.body;
    Worker.findOne({ _id: id }, (err, data) => {
      if (data) {
        data.horarios[index] = horario;
        data.markModified("horarios");
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

  app.post("/makeAppointment", function(req, res, next) {
    const { fecha, idWorker, idPlace, idUser, hora } = req.body;
    var newCita = new Cita();
    var ObjectId = mongoose.Types.ObjectId;
    newCita._id = new ObjectId().toString();
    Object.assign(newCita, req.body);
    Worker.updateOne(
      {
        _id: idWorker,
        horarios: {
          $elemMatch: {
            fecha: fecha,
            datos: { $elemMatch: { disponible: true } }
          }
        }
      },
      { $set: { "horarios.$.datos.$[inner].disponible": false } },
      { arrayFilters: [{ "inner.hora": hora }] },
      (err, doc) => {
        if (doc.nModified > 0) {
          newCita.save(function(err, data) {
            if (data) {
              res.json({ confirmation: "success", data: data });
            } else {
              console.log("valio en segundo");
              res.json({ confirmation: "fail" });
            }
          });
        } else {
          console.log("valio en primero");
          res.json({ confirmation: "fail" });
        }
      }
    );
  });

  app.post("/getAppointments", function(req, res) {
    Cita.find(req.body, function(err, data) {
      if (data) {
        res.json({ confirmation: "success", data: data });
      } else {
        res.json({ confirmation: "fail" });
      }
    });
  });

  app.use(function(req, res, next) {
    res.status(404).send("Sorry cant find that!");
  });
};
//esto si está bien
