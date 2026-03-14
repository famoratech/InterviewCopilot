import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/interview/", "/practice", "/optimizer"], // Hide internal tools
    },
    sitemap: "https://copilot.edgehit.ca/sitemap.xml", // REPLACE WITH YOUR DOMAIN
  };
}
