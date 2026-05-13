import { getServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_GAMBAR = {
  id: 1,
  topic: "University Library Environment",
  image_url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80",
  resolved_url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80",
  uploaded_at: new Date().toISOString()
};

export async function GET() {
  try {
    try {
      const supa = getServiceClient();
      const { count, error: cntErr } = await supa
        .from("gambar")
        .select("id", { count: "exact", head: true });
      if (cntErr || !count || count <= 0) {
        throw new Error("Gunakan fallback");
      }
      const offset = Math.floor(Math.random() * count);
      const { data, error } = await supa
        .from("gambar")
        .select("id, topic, image_url, uploaded_at")
        .range(offset, offset)
        .single();
      if (error || !data) throw new Error("Gunakan fallback");
      
      let resolved_url = null;
      try {
        if (typeof data?.image_url === "string" && /^https?:\/\//i.test(data.image_url)) {
          resolved_url = data.image_url;
        } else if (data?.image_url) {
          const p = data.image_url;
          const { data: signed } = await supa.storage.from("images").createSignedUrl(p, 60 * 60 * 24 * 7);
          resolved_url = signed?.signedUrl || null;
          if (!resolved_url) {
            const { data: pub } = supa.storage.from("images").getPublicUrl(p);
            resolved_url = pub?.publicUrl || null;
          }
        }
      } catch (_) {}
      return new Response(JSON.stringify({ ok: true, gambar: { ...data, resolved_url } }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (_) {
      return new Response(JSON.stringify({ ok: true, gambar: FALLBACK_GAMBAR }), { status: 200, headers: { "content-type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: true, gambar: FALLBACK_GAMBAR }), { status: 200, headers: { "content-type": "application/json" } });
  }
}
