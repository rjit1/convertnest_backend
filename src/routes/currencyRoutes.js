const express = require('express');
const router = express.Router();
const {
  getSupportedCurrencies,
  getExchangeRates,
  convertCurrency,
  getPopularPairs,
} = require('../controllers/currencyController');

// Get supported currencies
router.get('/supported', getSupportedCurrencies);

// Get popular currency pairs
router.get('/popular', getPopularPairs);

// Get exchange rates for a base currency
router.get('/rates/:baseCurrency', getExchangeRates);

// Convert currency
router.post('/convert', convertCurrency);

module.exports = router;
