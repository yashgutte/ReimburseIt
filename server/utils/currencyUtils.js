// utils/currencyUtils.js

const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  // If currencies match, no conversion needed
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return amount;
  }

  try {
    // Fetch rates using the base currency of the expense
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency.toUpperCase()}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rates");
    }

    const data = await response.json();
    const rate = data.rates[toCurrency.toUpperCase()];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${toCurrency}`);
    }

    // Return the converted amount rounded to 2 decimal places
    return parseFloat((amount * rate).toFixed(2));
  } catch (error) {
    console.error("Currency Conversion Error:", error);
    throw new Error("Could not convert currency at this time.");
  }
};

module.exports = { convertCurrency };
