const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const SMM_API_URL = process.env.SMM_API_URL || "https://smmpkpanel.com/api/v2";
const SMM_API_KEY = process.env.SMM_API_KEY || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const EASYPAISA = "03220225993";
const WHATSAPP = "923220225993";

const PACKAGES = {
  likes: [
    { qty: 1000, price: 150 },
    { qty: 5000, price: 500 },
    { qty: 10000, price: 900 }
  ],
  followers: [
    { qty: 1000, price: 350 },
    { qty: 5000, price: 1200 },
    { qty: 10000, price: 2000 }
  ]
};

async function smmRequest(params) {
  if (!SMM_API_KEY) throw new Error("SMM_API_KEY is not configured.");
  const body = new URLSearchParams({ key: SMM_API_KEY, ...params });
  const response = await fetch(SMM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("SMM API returned non-JSON response."); }
  if (!response.ok) throw new Error(`SMM API HTTP ${response.status}`);
  if (data?.error) throw new Error(data.error);
  return data;
}

function authAdmin(req) {
  const supplied = req.get("x-admin-key") || req.query.admin_key || "";
  return ADMIN_KEY && supplied === ADMIN_KEY;
}

function findService(services, type) {
  const tiktok = services.filter(s => String(s.category || "").toLowerCase().includes("tiktok"));
  const keywords = type === "likes"
    ? [/like/i, /likes/i]
    : [/follower/i, /followers/i];
  return tiktok.find(s => keywords.some(rx => rx.test(String(s.name || "")))) || null;
}

app.get("/api/config", (req, res) => {
  res.json({
    easypaisa: EASYPAISA,
    whatsapp: WHATSAPP,
    packages: PACKAGES
  });
});

app.get("/api/services", async (req, res) => {
  try {
    const data = await smmRequest({ action: "services" });
    const services = Array.isArray(data) ? data : [];
    const tiktok = services.filter(s => String(s.category || "").toLowerCase().includes("tiktok"));
    res.json({ ok: true, services: tiktok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/balance", async (req, res) => {
  if (!authAdmin(req)) return res.status(401).json({ ok:false, error:"Unauthorized" });
  try {
    res.json({ ok:true, data: await smmRequest({ action:"balance" }) });
  } catch(e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// Customer order: this endpoint places an order with the provider.
// For real-money operation, set PAYMENT_MODE=manual if you want admin confirmation first.
app.post("/api/order", async (req, res) => {
  try {
    const { type, packageQty, link, paymentReference } = req.body;
    if (!["likes","followers"].includes(type)) return res.status(400).json({ ok:false, error:"Invalid service type." });
    const qty = Number(packageQty);
    const pack = PACKAGES[type].find(p => p.qty === qty);
    if (!pack) return res.status(400).json({ ok:false, error:"Invalid package." });
    if (!/^https?:\/\/(www\.)?tiktok\.com\//i.test(String(link || "").trim()) &&
        !/^https?:\/\/vt\.tiktok\.com\//i.test(String(link || "").trim())) {
      return res.status(400).json({ ok:false, error:"Enter a valid TikTok URL." });
    }

    const services = await smmRequest({ action:"services" });
    const service = findService(Array.isArray(services) ? services : [], type);
    if (!service) return res.status(400).json({
      ok:false,
      error:`No TikTok ${type} service was found. Set the service ID manually in the server configuration.`
    });

    const min = Number(service.min || 0), max = Number(service.max || 0);
    if (qty < min || (max && qty > max)) {
      return res.status(400).json({ ok:false, error:`Selected quantity is outside provider limits (${min}–${max}).` });
    }

    // The provider receives the customer's TikTok link and quantity.
    // Payment is not automatically verified by this app.
    const order = await smmRequest({
      action:"add",
      service:String(service.service),
      link:String(link).trim(),
      quantity:String(qty)
    });

    res.json({
      ok:true,
      providerOrder: order,
      package: pack,
      providerService: {
        id: service.service,
        name: service.name,
        rate: service.rate,
        min: service.min,
        max: service.max
      },
      note:"Payment verification is separate; keep your Easypaisa receipt."
    });
  } catch(e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

app.post("/api/status", async (req, res) => {
  try {
    const order = String(req.body.order || "").trim();
    if (!order) return res.status(400).json({ ok:false, error:"Order ID is required." });
    const data = await smmRequest({ action:"status", order });
    res.json({ ok:true, data });
  } catch(e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

app.get("/health", (req,res) => res.json({ ok:true, app:"NIAZI TikTok Growth" }));

app.get("*", (req,res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`NIAZI TikTok Growth running on port ${PORT}`));
