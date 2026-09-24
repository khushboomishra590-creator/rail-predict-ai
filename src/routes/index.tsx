import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/rail/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RailPredict AI — Dynamic ETA Intelligence" },
      { name: "description", content: "AI-powered dynamic ETA prediction and railway operations intelligence for Smart India Hackathon 2026." },
      { property: "og:title", content: "RailPredict AI — Dynamic ETA Intelligence" },
      { property: "og:description", content: "An AI railway control-room platform for dynamic train ETA prediction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
