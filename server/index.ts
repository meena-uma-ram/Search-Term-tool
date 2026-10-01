import { createApp } from "./app";
import { loadConfig } from "./config";

// `--production` lets `npm start` work on every OS without setting NODE_ENV in the shell.
if (process.argv.includes("--production")) process.env.NODE_ENV = "production";
const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`Search Terms Cleaner API listening on http://localhost:${config.port}`);
  console.log(
    config.googleAds
      ? `Google Ads integration enabled (API ${config.googleAds.apiVersion}).`
      : "Google Ads not configured: serving synthetic demo data only.",
  );
});
