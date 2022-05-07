module.exports = {
  levels: [0, 500, 1000],
  cloud_name: "hcpa6zqmt",
  api_key: "447648935843875",
  api_secret: "-JiG1FQU-wIEbwfzi3hyfGkrrfo",
  benefits: [
    { beers: 1 }, // reset semanal
    { beers: 1 }, //acomular semanal, reset mensual
    { beers: 6, degustation: true, newBeers: true }, //reset mensual
    { beers: 3, degustation: true, newBeers: true } //reset semanalmente
  ],
  specialBenefits: [{ special: 1 }, { special: 1 }],
  options: {
    flight: 6, //----> this must be change to 1oz
    tasters: 7, //----> this must be change to 4oz
    Oz_32: 8,
    Oz_64: 9,
    Oz_128: 10,
    Oz_8: 16,
    Oz_10: 17,
    beers: 18, //----> this must be change to 12oz
    merma: 3
  }
};
