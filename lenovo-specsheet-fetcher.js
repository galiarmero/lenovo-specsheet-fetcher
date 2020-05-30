const querystring = require("querystring");
const axios = require("axios");
const cheerio = require("cheerio");
const yaml = require("js-yaml");
const fs = require("fs");

const parse = (html) => {
  const $ = cheerio.load(html);
  const rows = $("#modeldetail > table:first-child tr");

  let details = {};
  rows.each(function () {
    const cells = $(this).children("td,th");
    details = {
      ...details,
      [cells.eq(0).text()]: cells.eq(1).text().replace(/"/g, '""'),
    };
  });

  return details;
};

const fetch = async (mtm) => {
  console.time(`[${mtm}] searched`);
  const response = await axios.post(
    `https://psref.lenovo.com/ajax/HomeHandler.ashx`,
    querystring.stringify({
      t: "PreSearchForPerformance",
      SearchContent: mtm,
      SearchType: "Model",
    })
  );
  console.timeEnd(`[${mtm}] searched`);

  if (response.data.length > 0) {
    try {
      console.time(`[${mtm}] fetched product page`);
      const res = await axios.get(
        `https://psref.lenovo.com${response.data[0].ProductPageLink}`,
        {
          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
          },
        }
      );
      console.timeEnd(`[${mtm}] fetched product page`);

      console.time(`[${mtm}] parsed`);
      const details = parse(res.data);
      console.timeEnd(`[${mtm}] parsed`);

      return details;
    } catch (e) {
      throw e;
    }
  } else {
    throw new Error(`[warn] Model ${mtm} was not found.`);
  }
};

const main = async () => {
  try {
    const { models, fields } = yaml.safeLoad(
      fs.readFileSync("config.yml", "utf8")
    );
    console.log(`[INFO] Done parsing config.yml\n`);
    console.time(`[INFO] Fetching finished for ${models.length} models`);

    let csv = fields.map((col) => `"${col}"`).join(",");
    for (let model of models) {
      try {
        console.log(`[INFO] Fetching specs for model ${model}`);
        console.time(`[${model}] total`);
        let details = await fetch(model);

        csv += "\n" + fields.map((col) => `"${details[col]}"`).join(",");

        console.timeEnd(`[${model}] total`);
        console.log("---");
      } catch (e) {
        console.error(`[ERROR] ${e}`);
      }
    }

    fs.writeFileSync("specs.csv", csv);
    console.log(`\n[INFO] Done generating specs.csv`);
    console.timeEnd(`[INFO] Fetching finished for ${models.length} models`);
  } catch (e) {
    console.error(`[ERROR] ${e}`);
  }
};

main();
