/** @type {import('next').NextConfig} */
export default {
  // Live search reads the brand list at runtime; the homepage reads picks and brand sites.
  outputFileTracingIncludes: {
    "/api/search": ["./data/brands.csv"],
    "/": ["./data/picks.txt", "./data/sites.json", "./data/brands.csv", "./data/discovered.csv"],
  },
};
