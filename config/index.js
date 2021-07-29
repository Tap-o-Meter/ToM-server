module.exports = {
  levels: [0, 500, 1000],
  benefits: [
    { beers: 1 }, // reset semanal
    { beers: 1 }, //acomular semanal, reset mensual
    { beers: 6, degustation: true, newBeers: true }, //reset mensual
    { beers: 3, degustation: true, newBeers: true } //reset semanalmente
  ],
  specialBenefits: [{ special: 1 }, { special: 1 }]
};
