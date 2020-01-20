var mongoose = require("mongoose");

var placeSchema = mongoose.Schema({
  name: String,
  dias: [String],
  logo: String,
  fondo: String,
  calificacion: Number,
  categoria: [String],
  horario: [String],
  owner: String,
  direccion: String,
  telefono: String
});

var PlaceModel = mongoose.model("Place", placeSchema);

// deviceSchema.pre("save", function(next) {
//   var self = this;
//   DeviceModel.find({ _id: self.id }, function(err, docs) {
//     if (!docs.length) {
//       next();
//       console.log("wtf");
//     } else {
//       console.log("user exists: ", self.id);
//       next(new Error("User exists!"));
//     }
//   });
// });

module.exports = PlaceModel;
