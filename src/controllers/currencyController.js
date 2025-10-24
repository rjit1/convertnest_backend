const axios = require('axios');
const logger = require('../utils/logger');
const { AppError, formatSuccessResponse } = require('../utils/helpers');

const API_KEY = process.env.EXCHANGERATE_API_KEY;
const BASE_URL = 'https://v6.exchangerate-api.com/v6';

/**
 * Get list of supported currencies
 * @route GET /api/currency/supported
 */
const getSupportedCurrencies = async (req, res, next) => {
  try {
    logger.info('Fetching supported currencies');

    const response = await axios.get(`${BASE_URL}/${API_KEY}/codes`);

    if (response.data.result !== 'success') {
      throw new AppError('Failed to fetch supported currencies', 500);
    }

    const currencies = response.data.supported_codes.map(([code, name]) => ({
      code,
      name,
    }));

    logger.info(`Successfully fetched ${currencies.length} currencies`);

    res.json(formatSuccessResponse({ currencies, count: currencies.length }));
  } catch (error) {
    logger.error('Error fetching supported currencies:', error);
    next(error);
  }
};

/**
 * Get latest exchange rates for a base currency
 * @route GET /api/currency/rates/:baseCurrency
 */
const getExchangeRates = async (req, res, next) => {
  try {
    const { baseCurrency } = req.params;

    if (!baseCurrency) {
      throw new AppError('Base currency is required', 400);
    }

    logger.info(`Fetching exchange rates for ${baseCurrency}`);

    const response = await axios.get(`${BASE_URL}/${API_KEY}/latest/${baseCurrency.toUpperCase()}`);

    if (response.data.result !== 'success') {
      throw new AppError(`Invalid currency code: ${baseCurrency}`, 400);
    }

    const data = {
      baseCurrency: response.data.base_code,
      lastUpdate: response.data.time_last_update_utc,
      nextUpdate: response.data.time_next_update_utc,
      rates: response.data.conversion_rates,
    };

    logger.info(`Successfully fetched rates for ${baseCurrency}`);
    res.json(formatSuccessResponse(data));
  } catch (error) {
    logger.error('Error fetching exchange rates:', error);
    if (error.response && error.response.status === 404) {
      next(new AppError('Invalid currency code', 400));
    } else {
      next(error);
    }
  }
};

/**
 * Convert amount from one currency to another
 * @route POST /api/currency/convert
 */
const convertCurrency = async (req, res, next) => {
  try {
    const { from, to, amount } = req.body;

    if (!from || !to || amount === undefined) {
      throw new AppError('Missing required fields: from, to, amount', 400);
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      throw new AppError('Amount must be a valid positive number', 400);
    }

    logger.info(`Converting ${parsedAmount} ${from} to ${to}`);

    const response = await axios.get(
      `${BASE_URL}/${API_KEY}/pair/${from.toUpperCase()}/${to.toUpperCase()}/${parsedAmount}`
    );

    if (response.data.result !== 'success') {
      throw new AppError('Invalid currency codes or conversion failed', 400);
    }

    const data = {
      from: response.data.base_code,
      to: response.data.target_code,
      amount: parsedAmount,
      convertedAmount: response.data.conversion_result,
      rate: response.data.conversion_rate,
      lastUpdate: response.data.time_last_update_utc,
      nextUpdate: response.data.time_next_update_utc,
    };

    logger.info(
      `Converted ${parsedAmount} ${from} to ${data.convertedAmount} ${to} (rate: ${data.rate})`
    );

    res.json(formatSuccessResponse(data));
  } catch (error) {
    logger.error('Error converting currency:', error);
    if (error.response && error.response.status === 404) {
      next(new AppError('Invalid currency codes', 400));
    } else {
      next(error);
    }
  }
};

/**
 * Get popular currency pairs with current rates
 * @route GET /api/currency/popular
 */
const getPopularPairs = async (req, res, next) => {
  try {
    logger.info('Fetching popular currency pairs');

    const popularPairs = [
      { from: 'USD', to: 'EUR', name: 'US Dollar to Euro' },
      { from: 'USD', to: 'GBP', name: 'US Dollar to British Pound' },
      { from: 'USD', to: 'JPY', name: 'US Dollar to Japanese Yen' },
      { from: 'USD', to: 'CNY', name: 'US Dollar to Chinese Yuan' },
      { from: 'USD', to: 'INR', name: 'US Dollar to Indian Rupee' },
      { from: 'EUR', to: 'USD', name: 'Euro to US Dollar' },
      { from: 'EUR', to: 'GBP', name: 'Euro to British Pound' },
      { from: 'GBP', to: 'USD', name: 'British Pound to US Dollar' },
    ];

    const ratesPromises = popularPairs.map(async (pair) => {
      try {
        const response = await axios.get(`${BASE_URL}/${API_KEY}/pair/${pair.from}/${pair.to}`);
        return {
          ...pair,
          rate: response.data.conversion_rate,
          lastUpdate: response.data.time_last_update_utc,
        };
      } catch (error) {
        logger.error(`Error fetching rate for ${pair.from}/${pair.to}:`, error.message);
        return { ...pair, rate: null, error: 'Failed to fetch rate' };
      }
    });

    const pairsWithRates = await Promise.all(ratesPromises);
    logger.info('Successfully fetched popular currency pairs');

    res.json(formatSuccessResponse({ pairs: pairsWithRates, count: pairsWithRates.length }));
  } catch (error) {
    logger.error('Error fetching popular pairs:', error);
    next(error);
  }
};

module.exports = {
  getSupportedCurrencies,
  getExchangeRates,
  convertCurrency,
  getPopularPairs,
};
