import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  // Fumadocs needs MDX-aware page extensions
  pageExtensions: ["mdx", "ts", "tsx"],
};

export default withMDX(nextConfig);
