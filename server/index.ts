import { createApp } from "./app";
import { loadConfig } from "./config";

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
