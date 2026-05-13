import { NextRequest } from "next/server";
import { json } from "../_utils/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_TUGAS = [
  {
    id: 1,
    judul: 'Tugas 1',
    kategori: 'Read Aloud Short',
    teks: 'The rapid advancement of technology has transformed the way we communicate with each other.',
    prep_time: 5,
    record_time: 10
  },
  {
    id: 2,
    judul: 'Tugas 2',
    kategori: 'Read Aloud Short',
    teks: 'With a tear in your eye, you will watch as your dress begins to tear.',
    prep_time: 5,
    record_time: 10
  },
  {
    id: 3,
    judul: 'Tugas 3',
    kategori: 'Read Aloud Long',
    teks: "You don't need to spend all of your hard earned money on bakery bread. Making your own bread at home is easy with the new Double Duty Dough Mixer by Berring. Unlike other bread machines that can be difficult to clean and store, the Double Duty Dough Mixer breaks down into five parts that can go directly into your dishwasher. This stainless steel appliance will mix dough for you in a fraction of the time it takes to knead dough by hand. The automated delay feature at the beginning of the mix cycle gives your ingredients time to reach room temperature, ensuring that your breads will rise as high as bakery bread. We guarantee that the accompanying Berring Best Breads recipe book will be a family favourite.",
    prep_time: 30,
    record_time: 75
  },
  {
    id: 4,
    judul: 'Tugas 4',
    kategori: 'Describe Picture',
    teks: 'Describe this picture using complete sentences and clear descriptions. Explain who is in the picture, what is happening, and the overall atmosphere.',
    prep_time: 30,
    record_time: 60
  },
  {
    id: 5,
    judul: 'Tugas 5',
    kategori: 'Free Speech Daily Life',
    teks: 'Do you think people should be held responsible for the consequences of what they say in daily life? Give an example to support your answer.',
    prep_time: 30,
    record_time: 90
  },
  {
    id: 6,
    judul: 'Tugas 6',
    kategori: 'Free Speech Specific Topic',
    teks: 'Discuss the course you enjoyed most at university, describe a course you found challenging, and explain whether you think universities should focus more on practical skills or theoretical knowledge.',
    prep_time: 30,
    record_time: 120
  }
];

export async function GET(req /** @type {NextRequest} */) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const index = searchParams.get("index");

  if (id) {
    const t = FALLBACK_TUGAS.find((x) => x.id === Number(id));
    return json({ ok: true, tugas: t || FALLBACK_TUGAS[0] });
  }
  if (index) {
    const idx = Math.max(1, Number(index));
    return json({ ok: true, tugas: FALLBACK_TUGAS[idx - 1] || FALLBACK_TUGAS[0] });
  }
  
  return json({ ok: true, tugas: FALLBACK_TUGAS });
}
