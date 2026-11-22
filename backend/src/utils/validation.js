/**
 * Validates whether a string matches a standard RFC 4122 UUID format (v1-v5).
 * @param {string} str
 * @returns {boolean}
 */
export const isValidUUID = (str) => {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
};

/**
 * Validates and parses a positive number or returns undefined if null/empty.
 * Throws an Error if value is not a valid number or negative.
 */
export const parsePrice = (value, fieldName = 'Price') => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    const error = new Error(`${fieldName} must be a valid non-negative number`);
    error.statusCode = 400;
    throw error;
  }
  return num;
};

/**
 * Validates and normalizes pagination parameters.
 */
export const parsePagination = (pageParam, limitParam) => {
  let page = 1;
  let limit = 10;

  if (pageParam !== undefined && pageParam !== '') {
    const parsedPage = parseInt(pageParam, 10);
    if (Number.isNaN(parsedPage) || parsedPage < 1) {
      const error = new Error('Page must be a positive integer greater than or equal to 1');
      error.statusCode = 400;
      throw error;
    }
    page = parsedPage;
  }

  if (limitParam !== undefined && limitParam !== '') {
    const parsedLimit = parseInt(limitParam, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      const error = new Error('Limit must be an integer between 1 and 100');
      error.statusCode = 400;
      throw error;
    }
    limit = parsedLimit;
  }

  return { page, limit, offset: (page - 1) * limit };
};

