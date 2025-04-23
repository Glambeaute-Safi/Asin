const express = require("express");
const cors = require("cors");
const fs = require("fs");
const scrapeASIN = require("./scraper");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

let currentASIN = null;

// SSE endpoint to send current ASIN to frontend
app.get("/current-asin", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ asin: currentASIN })}\n\n`);
  }, 500);

  req.on("close", () => clearInterval(interval));
});

// Scrape route
app.post("/scrape", async (req, res) => {
  try {
    const asins = req.body.asins;
    const allResults = [];

    for (const asin of asins) {
      currentASIN = asin;
      console.log(`🔍 Scraping ${asin}`);
      const result = await scrapeASIN(asin);
      allResults.push(...result);
    }

    const csv = [
      ["ASIN", "Seller", "Price", "Condition"],
      ...allResults,
    ].map(row => row.join(",")).join("\n");

    const filePath = "results.csv";
    fs.writeFileSync(filePath, csv);

    res.download(filePath);
  } catch (error) {
    console.error("❌ Scrape failed:", error.message);
    res.status(500).send("Error: Failed to scrape.");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
