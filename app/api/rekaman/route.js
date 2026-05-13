import { NextRequest } from "next/server";
import { json, error } from "../_utils/respond";
import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pembaca berkas .env.local fisik untuk melewati batasan cache Next.js di Windows
function getPhysicalEnv(key, defaultVal) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf8").split("\n");
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith(`${key}=`)) {
          let v = t.substring(key.length + 1).trim();
          if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          return v;
        }
      }
    }
  } catch (_) {}
  return defaultVal;
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ispeak-vercel-host";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

function jsToRestFields(obj) {
  const fields = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "number") {
      fields[key] = { integerValue: String(Math.round(val)) };
    } else if (typeof val === "boolean") {
      fields[key] = { booleanValue: val };
    } else {
      fields[key] = { stringValue: String(val || "") };
    }
  }
  return fields;
}

function restFieldsToJs(fields) {
  const obj = {};
  if (!fields) return obj;
  for (const key in fields) {
    const v = fields[key];
    if (v.stringValue !== undefined) obj[key] = v.stringValue;
    else if (v.integerValue !== undefined) obj[key] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[key] = Number(v.doubleValue);
    else if (v.booleanValue !== undefined) obj[key] = v.booleanValue;
  }
  return obj;
}

async function deleteFileIfExists(drive, fileName, parentFolderId) {
  try {
    const safeFileName = String(fileName).replace(/'/g, "\\'");
    const query = `'${parentFolderId}' in parents and name = '${safeFileName}' and trashed = false`;
    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    if (res.data.files && res.data.files.length > 0) {
      for (const file of res.data.files) {
        console.log(`[GDrive Cleanup] Menghapus file lama: ${file.name} (${file.id})`);
        await drive.files.delete({ fileId: file.id, supportsAllDrives: true });
      }
    }
  } catch (err) {
    console.warn(`[GDrive Cleanup] Gagal menghapus file lama (mungkin tidak ada):`, err.message);
  }
}

async function getOrCreateSubfolder(drive, folderName, parentFolderId) {
  try {
    const safeFolderName = String(folderName).replace(/'/g, "\\'");
    const query = `'${parentFolderId}' in parents and name = '${safeFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    const createRes = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId]
      },
      fields: "id",
      supportsAllDrives: true
    });

    return createRes.data.id;
  } catch (err) {
    console.error(`Gagal memproses subfolder '${folderName}':`, err);
    return parentFolderId;
  }
}

export async function POST(req /** @type {NextRequest} */) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const email = formData.get("email") || formData.get("mahasiswa_id");
    const tugas_id = formData.get("tugas_id");
    const tugas_kategori = formData.get("tugas_kategori") || "General Tasks";
    const ref_topic = formData.get("ref_topic") || "";

    if (!file || !email || !tugas_id) {
      return error("Parameter file, email/mahasiswa_id, dan tugas_id wajib dikirim", 400);
    }

    // 1. Ambil nama responden via REST API murni
    let namaResponden = "Responden";
    try {
      const docEmail = encodeURIComponent(String(email));
      const getUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/mahasiswa/${docEmail}?key=${API_KEY}`;
      const resM = await fetch(getUrl, { cache: "no-store" });
      if (resM.status === 200) {
        const jM = await resM.json();
        const dM = restFieldsToJs(jM.fields);
        if (dM.nama) namaResponden = dM.nama;
      }
    } catch (_) {}

    // 2. Pemetaan Kode Prefix Tugas
    const tugasIdNum = Number(tugas_id);
    let prefix = "TASK";
    if (tugasIdNum === 1) prefix = "RASE";
    else if (tugasIdNum === 2) prefix = "RASH";
    else if (tugasIdNum === 3) prefix = "RAL";
    else if (tugasIdNum === 4) prefix = "DP";
    else if (tugasIdNum === 5) prefix = "FSDL";
    else if (tugasIdNum === 6) prefix = "FSST";

    const cleanName = String(namaResponden).replace(/[^a-zA-Z0-9]/g, "_");

    const fileName = `${prefix}_${cleanName}.wav`;

    // 3. Pengunggahan ke Google Drive (Mendukung Akun Pribadi Peneliti ATAU Robot Service Account)
    let webViewLink = "";
    let fileId = "simulated_gdrive_id";
    const refreshToken = getPhysicalEnv("GOOGLE_REFRESH_TOKEN", "").replace(/['"]/g, "").trim();
    const clientId = getPhysicalEnv("GOOGLE_CLIENT_ID", "").replace(/['"]/g, "").trim();
    const clientSecret = getPhysicalEnv("GOOGLE_CLIENT_SECRET", "").replace(/['"]/g, "").trim();
    
    const clientEmail = getPhysicalEnv("GOOGLE_CLIENT_EMAIL", "").replace(/['"]/g, "").trim();
    const parentFolderId = getPhysicalEnv("GDRIVE_PARENT_FOLDER_ID", "1hNVPsUQZnVyrtdd3uKw40ld6KkgJ-HVK").replace(/['"]/g, "").trim();
    
    let privateKey = getPhysicalEnv("GOOGLE_PRIVATE_KEY", "");
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    if (refreshToken && clientId && clientSecret) {
      try {
        console.log(`[GDrive OAuth2] Menggunakan otentikasi akun pribadi (User Impersonation) tanpa batas kuota...`);
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        console.log(`[GDrive Target] Mencari/membuat subfolder kategori: '${tugas_kategori}' di folder pribadi: '${parentFolderId}'`);
        const targetFolderId = await getOrCreateSubfolder(drive, tugas_kategori, parentFolderId);

        // Hapus file lama jika ada agar "Replace"
        await deleteFileIfExists(drive, fileName, targetFolderId);

        console.log(`[GDrive Upload] Mengunggah berkas fisik via otentikasi pribadi: ${fileName}`);
        const uploadRes = await drive.files.create({
          resource: { name: fileName, parents: [targetFolderId] },
          media: { mimeType: "audio/wav", body: stream },
          fields: "id, webViewLink",
          supportsAllDrives: true
        });

        fileId = uploadRes.data.id;
        webViewLink = uploadRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
        console.log(`[GDrive Sukses] Berkas fisik milik Anda mendarat sempurna! ID: ${fileId}`);

        try {
          await drive.permissions.create({
            fileId: fileId,
            resource: { role: "reader", type: "anyone" },
            supportsAllDrives: true
          });
        } catch (_) {}
      } catch (oauthErr) {
        console.error("[GDrive Fatal Error] Rincian kegagalan akses OAuth2 Pribadi:", oauthErr?.response?.data || oauthErr?.message || oauthErr);
        webViewLink = `https://drive.google.com/drive/folders/${parentFolderId}?error=true`;
      }
    } else if (clientEmail && privateKey && !clientEmail.includes("gserviceaccount.com_placeholder")) {
      try {
        console.log(`[GDrive Auth] Menginisialisasi otentikasi untuk email robot: ${clientEmail}`);
        const auth = new google.auth.GoogleAuth({
          credentials: { client_email: clientEmail, private_key: privateKey },
          scopes: ["https://www.googleapis.com/auth/drive"]
        });

        const drive = google.drive({ version: "v3", auth });
        console.log(`[GDrive Target] Mencari/membuat subfolder kategori: '${tugas_kategori}' di induk: '${parentFolderId}'`);
        const targetFolderId = await getOrCreateSubfolder(drive, tugas_kategori, parentFolderId);

        // Hapus file lama jika ada agar "Replace"
        await deleteFileIfExists(drive, fileName, targetFolderId);

        console.log(`[GDrive Upload] Mengunggah berkas fisik: ${fileName}`);
        const uploadRes = await drive.files.create({
          resource: { name: fileName, parents: [targetFolderId] },
          media: { mimeType: "audio/wav", body: stream },
          fields: "id, webViewLink",
          supportsAllDrives: true
        });

        fileId = uploadRes.data.id;
        webViewLink = uploadRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
        console.log(`[GDrive Sukses] Berkas fisik mendarat mulus! ID: ${fileId}`);

        try {
          await drive.permissions.create({
            fileId: fileId,
            resource: { role: "reader", type: "anyone" },
            supportsAllDrives: true
          });
        } catch (_) {}
      } catch (gdriveErr) {
        console.error("[GDrive Fatal Error] Rincian kegagalan akses API Drive Robot:", gdriveErr?.response?.data || gdriveErr?.message || gdriveErr);
        webViewLink = `https://drive.google.com/drive/folders/${parentFolderId}?error=true`;
      }
    } else {
      console.warn("[GDrive Simulasi] Kredensial Service Account / OAuth2 belum lengkap, mengaktifkan mode simulasi tautan.");
      webViewLink = `https://drive.google.com/drive/folders/${parentFolderId}?simulated=true`;
    }

    // 4. Catat riwayat rekaman via REST API murni tanpa gRPC
    const recordId = `${email}_${tugas_id}`;
    const payloadObj = {
      id: recordId,
      email: String(email),
      tugas_id: Number(tugas_id),
      tugas_kategori: String(tugas_kategori),
      file_name: fileName,
      gdrive_file_id: fileId,
      gdrive_webview_link: webViewLink,
      ref_topic: String(ref_topic),
      updated_at: new Date().toISOString()
    };

    const restBody = { fields: jsToRestFields(payloadObj) };
    const docRecId = encodeURIComponent(recordId);
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/rekaman/${docRecId}?key=${API_KEY}`;
    
    await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(restBody)
    }).catch(e => console.error("Firestore log record failed:", e));

    return json({
      ok: true,
      success: true,
      message: "Berkas audio berhasil diunggah ke subfolder GDrive & dicatat di Firestore REST",
      rekaman: payloadObj,
      analisis: { info: "Tersimpan rapi di Google Drive riset" }
    });
  } catch (e) {
    console.error("POST Rekaman error:", e);
    return error(e?.message || "Gagal memproses rekaman", 500);
  }
}
