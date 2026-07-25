/** @type {import('next').NextConfig} */
const nextConfig = {
  // Marsa/Rifqa is Arabic-first — the html lang/dir attributes are set in
  // the root layout, not here. This config is intentionally minimal so the
  // API-route migration doesn't accidentally couple to frontend concerns.
};

export default nextConfig;
