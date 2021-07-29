var mongoose = require("mongoose");
const config = require("../../config");

var clientsSchema = mongoose.Schema({
  _id: String,
  cardId: String,
  name: String,
  lastName: String,
  level: { type: Number, default: 1 },
  beersDrinked: { type: Number, default: 0 },
  // beersGiven: { type: Number, default: 0 },
  benefits: { type: mongoose.Schema.Types.Mixed, default: config.benefits[0] },
  clientSince: Date
});

var ClientsModel = mongoose.model("Clients", clientsSchema);

module.exports = ClientsModel;
