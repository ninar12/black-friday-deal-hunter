/** @type {import('next').NextConfig} */
export default {
  // Live search reads the brand list at runtime.
  outputFileTracingIncludes: { "/api/search": ["./data/brands.csv"] },
};
