// app/models/user.js
// load the things we need
var mongoose = require("mongoose");

// define the schema for our user model
var userSchema = mongoose.Schema({
  _id: String,
  name: String,
  lastName: String,
  cardId: String,
  beers: {
    type: mongoose.Schema.Types.Mixed,
    default: { pint: 0, taster: 0, flight: 2 }
  },
});

// create the model for users and expose it to our app
module.exports = mongoose.model("User", userSchema);
