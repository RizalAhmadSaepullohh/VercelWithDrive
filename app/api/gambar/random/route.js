export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_GAMBAR = {
  id: 1,
  topic: "Describe this picture using complete sentences and clear descriptions. Explain who is in the picture, what is happening, and the overall atmosphere.",
  image_url: "/describe.jpg",
  resolved_url: "/describe.jpg",
  uploaded_at: new Date().toISOString()
};

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, gambar: FALLBACK_GAMBAR }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
