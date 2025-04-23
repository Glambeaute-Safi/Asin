const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function scrapeASIN(asin) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8'
  });

  const allOffers = [];

  try {
    const dpURL = `https://www.amazon.ae/dp/${asin}`;
    await page.goto(dpURL, { waitUntil: "networkidle2" });

    const mainData = await page.evaluate(() => {
      const price = document.querySelector("span.a-offscreen")?.innerText.trim() || "-";
      let seller = "-";
      const spans = Array.from(document.querySelectorAll("#shipFromSoldByAbbreviated_feature_div span.a-size-small"));
      spans.forEach((el, i) => {
        if (el.textContent.trim().toLowerCase() === "sold by:" && spans[i + 1]) {
          seller = spans[i + 1].textContent.trim();
        }
      });
      if (seller === "-") {
        const fallback = document.querySelector("#sellerProfileTriggerId");
        if (fallback) seller = fallback.innerText.trim();
      }
      return { seller, price };
    });

    allOffers.push([asin, mainData.seller, mainData.price, "New"]);
  } catch (err) {
    console.log(`❌ DP Error:`, err.message);
  }

  try {
    const aodURL = `https://www.amazon.ae/gp/aod/ajax/ref=dp_aod_ALL_mbc?asin=${asin}`;
    await page.goto(aodURL, { waitUntil: "networkidle2" });

    const offerExists = await page.$("div#aod-offer");
    if (offerExists) {
      const aodData = await page.evaluate(() => {
        const results = [];
        const blocks = document.querySelectorAll("div#aod-offer");
        blocks.forEach(block => {
          let seller = block.querySelector("#aod-offer-soldBy a")?.innerText.trim() || "-";
          if (seller === "-") {
            const fallback = block.querySelector("#aod-offer-soldBy")?.innerText;
            if (fallback?.toLowerCase().includes("amazon")) seller = "Amazon.ae";
          }
          let price = block.querySelector(".a-price .a-offscreen")?.innerText.trim();
          if (!price) {
            const whole = block.querySelector(".a-price-whole")?.innerText.trim();
            const fraction = block.querySelector(".a-price-fraction")?.innerText.trim();
            price = whole && fraction ? `AED ${whole}${fraction}` : "-";
          }
          const condition = block.querySelector("#aod-offer-heading span")?.innerText.trim() || "-";
          results.push({ seller, price, condition });
        });
        return results;
      });
      aodData.forEach(s => allOffers.push([asin, s.seller, s.price, s.condition]));
    }
  } catch (err) {
    console.log(`⚠️ AOD Error:`, err.message);
  }

  await browser.close();
  return allOffers;
}

module.exports = scrapeASIN;
