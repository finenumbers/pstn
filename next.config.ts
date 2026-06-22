import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pino", "pg", "exceljs"],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
