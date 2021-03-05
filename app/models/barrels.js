var mongoose = require("mongoose");

var barrelSchema = mongoose.Schema({
  _id: String,
  image: String,
  name: String,
  brand: String,
  style: String,
  abv: Number,
  ibu: Number,
  availableLiters: Number,
  soldLiters: { type: Number, default: 0 },
  barrelCapacity: Number,
  soldPints: { type: Number, default: 0 },
  taster: { type: Number, default: 0 }
});

var BarrelModel = mongoose.model("Barrel", barrelSchema);

module.exports = BarrelModel;
