const axios = require("axios");
const supabase = require("./db");

async function checkStock() {
  try {
    const res = await axios.get("https://numbros.shop/jj/prices.json");

    for (const country in res.data) {
      const count = res.data[country].count || 0;

      const { data } = await supabase
        .from("stock_status")
        .select("*")
        .eq("country", country)
        .single();

      if (!data || data.last_count !== count) {
        await supabase.from("notifications").insert({
          type: "stock",
          message: `تغير المخزون في ${country} إلى ${count}`
        });

        await supabase.from("stock_status").upsert({
          country,
          last_count: count,
          last_check: new Date()
        });
      }
    }
  } catch (e) {
    console.log("Stock check error");
  }
}

module.exports = checkStock;