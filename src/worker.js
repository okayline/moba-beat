// moba-beat Worker. For now it only shows the ledger.
//   GET /api/ledger?before=ID&limit=N   the chain, newest first (N up to 100)
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/api/ledger") {
      const before = Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30));
      const { results } = await env.DB.prepare("SELECT id, kind, day, record, prev_hash, hash, created_at FROM ledger WHERE id < ? ORDER BY id DESC LIMIT ?").bind(before, limit).all();
      return json({ entries: results });
    }
    return json({ error: "Not found." }, 404);
  },
};
