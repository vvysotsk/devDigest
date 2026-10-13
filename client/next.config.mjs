import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001",
  },
  // `src/vendor/shared` (a copy of the server's ESM contracts) re-exports with
  // `.js` specifiers (`./contracts/findings.js`) that point at `.ts` files.
  // Type-only imports are erased, but a runtime import (a zod schema or a
  // constant) makes webpack resolve them — map `.js` to the TS sources.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
