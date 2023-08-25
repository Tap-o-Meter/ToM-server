var mongoose = require("mongoose");

var kegSchema = mongoose.Schema({
  _id: String,
  beerId: String,
  abv: Number,
  ibu: Number,
  capacity: Number,
  available: Number,
  soldPints: { type: Number, default: 0 },
  taster: { type: Number, default: 0 },
  growlers: [Object],
  merma: { type: Number, default: 0 },
  prepared: Date,
  released: Date,
  status: { type: String, default: "FULL" },
  lastLine: { type: Object, required: false }
});

var KegModel = mongoose.model("Keg", kegSchema);

module.exports = KegModel;
