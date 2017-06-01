// @flow

/**
 * Formats the params object as query params in the url
 */
export const formatQueryParams = (url: string, params: Object): string => {
  const paramStrings = [];

  if (!params) {
    return url;
  }

  Object.keys(params).forEach(function(key) {
    const value = params[key];

    // If it's an array, we need to push once for each item
    if (Array.isArray(value)) {
      paramStrings.push(...value.map(v => `${key}=${v}`));
    } else if (value !== undefined) {
      paramStrings.push(`${key}=${value}`);
    }
  });

  if (paramStrings.length === 0) {
    return url;
  }

  return `${url}?${paramStrings.join('&')}`;
};
