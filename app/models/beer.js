var mongoose = require("mongoose");

var beerSchema = mongoose.Schema({
  _id: String,
  image: { type: String, default: "" },
  cloudImage: { type: String, required: false },
  name: String,
  brand: String,
  style: String,
  type: String,
  abv: Number,
  ibu: Number,
  description: String,
  srm: Number
});

var BeerModel = mongoose.model("Beer", beerSchema);

module.exports = BeerModel;
