
const config = require('../config');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi Google AI SDK dengan API Key dari config
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);


const botCapabilities = `
- **Membuat Stiker:** Bisa membuat stiker dari gambar atau video yang dikirim.
- **Musik & Lagu:** Mampu mencari dan memutar lagu dari YouTube berdasarkan judul.
- **Pencarian Gambar:** Bisa mencari gambar di Pinterest.
- **Peningkat Kualitas Gambar:** Mampu meningkatkan kualitas gambar menjadi lebih jernih (HD/Remini/Upscale).
- **AI Pembuat Gambar:** Saya bisa men-generate atau membuat gambar dari deskripsi teks. Gunakan perintah seperti 'imagine <deskripsi>'.
- **Asisten AI:** Tentu saja saya bisa menjawab pertanyaan umum, bercakap-cakap, dan memberikan saran.
- **Informasi Bot:** Memberikan informasi tentang status bot, owner, dan sisa limit harian.
- **Downloader:** Bisa mengunduh video dari link TikTok, Facebook, dan Instagram.
- **Kreatif:** Membuat meme dan stiker custom 'BRAT'.
- **Pencarian Info:** Mampu mencari informasi dari Wikipedia.
- **Filter AI:** Bisa mengubah foto menjadi gaya seni Ghibli.
- **Backup Script:** Bisa membantu Owner untuk mem-backup data script menjadi file .zip.
- **Screenshot Website:** Bisa mengambil tangkapan layar dari sebuah website jika diberi URL.
- **Top Up & Produk Digital:** Saat ini sedang dalam pemeliharaan (maintenance), tapi saya bisa melakukan top up game/e-wallet.
- **Pencarian Kode:** Mampu mencari kode dari platform Codeshare.
- **Arsip Web:** Bisa mengubah seluruh halaman website menjadi file .zip.
- **Konfigurasi Otomatis (Owner):** Owner bisa mengubah nama bot, nama owner, nomor, website, dan lainnya langsung melalui chat.
- **Pemahaman Gambar:** Mampu menganalisis, mendeskripsikan, dan menjawab pertanyaan tentang gambar yang dikirim oleh pengguna.
- **Analisis Link:** Mampu membaca, meringkas, dan menjawab pertanyaan tentang konten dari URL/link yang diberikan.
- **Pencarian Google:** Mampu mencari informasi real-time di internet.
- **Eksekusi Kode:** Mampu melakukan perhitungan matematika dan analisis data.
- **Membuat Admin Panel:** Mampu Membuat Akun Khusus Untuk Admin Panel Pterocdactyl
- **Produk Digital:** Mampu Memberikan Produk Digital Real Time Seperti Script Bot Wa/ Jasa Pembuatan Website ( maintenance )
- **Layanan PPOB:** Menyediakan Semua layanan PPOB sesuai keperluan seperti suntik sosmed dll
- **Penjualan Nokos:** Mampu Untuk Membeli Nomor Kosong Dari Sebuah Negara Dengan Real Time Dan full Otomatisasi
`;

function getWaktuWIB() {
    const now = new Date();
    const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hari = wibTime.getDate();
    const bulanIndex = wibTime.getMonth();
    const tahun = wibTime.getFullYear();
    const jam = wibTime.getHours().toString().padStart(2, '0');
    const menit = wibTime.getMinutes().toString().padStart(2, '0');
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${hari} ${namaBulan[bulanIndex]} ${tahun} jam ${jam}:${menit} WIB`;
}

global.conversationHistories = {};

// --- DEKLARASI ALAT (TOOLS) UNTUK GEMINI ---
const tools = [
  { "google_search": {} } // Code Interpreter sudah bawaan di model 1.5 Pro
];

/**
 * Fungsi utama untuk chat teks, analisis gambar, URL, dan penggunaan tools.
 * @param {string} id_user - ID unik pengguna.
 * @param {string} prompt - Teks prompt dari pengguna.
 * @param {boolean} isGroup - Apakah pesan berasal dari grup.
 * @param {string} remoteJid - JID dari chat.
 * @param {Buffer} [imageBuffer=null] - Buffer gambar (opsional).
 * @returns {Promise<string>} - Respons teks dari AI.
 */
async function GEMINI_TEXT(id_user, prompt, isGroup, remoteJid, imageBuffer = null) {
    try {
        const isVisionRequest = imageBuffer !== null;
        const modelName = isVisionRequest ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
        const model = genAI.getGenerativeModel({ model: modelName, tools: isVisionRequest ? undefined : tools });

        if (isVisionRequest) {
            console.log(`[GEMINI VISION] Menganalisis gambar dengan prompt: "${prompt || '(tidak ada prompt teks)'}"`);
            const imageParts = [{ inlineData: { mimeType: 'image/jpeg', data: imageBuffer.toString('base64') } }];
            const textPrompt = prompt || "Tolong deskripsikan gambar ini secara detail. Apa saja yang kamu lihat?";
            const result = await model.generateContent([textPrompt, ...imageParts]);
            return result.response.text();
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlsFound = prompt.match(urlRegex);
        if (urlsFound && urlsFound[0]) {
            const url = urlsFound[0];
            console.log(`[GEMINI URL] URL terdeteksi: ${url}. Memulai caching...`);
            sock.sendMessage(remoteJid, { text: `🔎 URL terdeteksi! Saya sedang membaca konten dari link tersebut...` });
            const urlContent = await genAI.caching.cacheContent({ model: 'models/gemini-1.5-pro-latest', content: { parts: [{ text: `Analisis konten dari URL ini: ${url}` }] }, ttl: { seconds: 3600 } });
            const newPrompt = prompt.replace(url, `(berdasarkan konten yang sudah saya analisis)`);
            const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: newPrompt }] }], cachedContent: urlContent.name });
            return result.response.text();
        }

        if (!conversationHistories[id_user]) conversationHistories[id_user] = [];
        
        let initialContext = `Kamu adalah Resbot AI, asisten cerdas buatan tim dari Autoresbot. Waktu sekarang adalah @NOW. Jawablah pertanyaan dengan ramah dan cerdas. PENTING: Kamu memiliki beberapa kemampuan khusus yang sudah diprogram. Gunakan informasi di bawah ini untuk menjawab pertanyaan terkait kemampuanmu. Jika diminta melakukan sesuatu yang ada di daftar, berikan instruksi cara menggunakannya. Jika tidak ada, katakan kamu belum bisa melakukannya.
            Contoh:
            - User: "bisa buat gambar ga?" -> AI: "Tentu, saya bisa! Cukup ketik 'imagine' diikuti deskripsi gambar yang Anda inginkan."
            - User: "bisa masakin nasi goreng?" -> AI: "Maaf, sebagai AI saya belum bisa memasak nasi goreng."`;
        initialContext += `\n\n=== KEMAMPUAN LOKAL YANG KAMU MILIKI ===\n${botCapabilities}\n=================================`;
        initialContext = initialContext.replace('@NOW', getWaktuWIB());
        
        const fullHistory = [
            { role: "user", parts: [{ text: initialContext }] },
            { role: "model", parts: [{ text: "Tentu, saya mengerti. Saya akan menggunakan semua kemampuan saya, termasuk mencari di Google dan menjalankan kode jika diperlukan. Ada yang bisa dibantu?" }] },
            ...conversationHistories[id_user]
        ];
        
        const chat = model.startChat({ history: fullHistory });
        const result = await chat.sendMessage(prompt);
        const responseText = result.response.text();

        conversationHistories[id_user].push({ role: "user", parts: [{ text: prompt }] });
        conversationHistories[id_user].push({ role: "model", parts: [{ text: responseText }] });
        if (conversationHistories[id_user].length > 10) {
            conversationHistories[id_user] = conversationHistories[id_user].slice(-10);
        }
        return responseText;

    } catch (error) {
        console.error("🚫 Error di GEMINI_TEXT:", error);
        return `Maaf, terjadi kesalahan saat memproses permintaan Anda: ${error.message}`;
    }
}

async function GEMINI_IMAGE(prompt, numberOfImages = 1) {
    try {
        // Model preview khusus untuk generasi gambar, sesuai dokumentasi Anda
        // Kita gunakan nama yang lebih stabil jika '2.5' tidak ada, yaitu 'gemini-1.5-flash'
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" }); 
        
        console.log(`[GEMINI NATIVE IMAGE] Memulai generasi gambar untuk: "${prompt}"`);
        
        // Buat prompt lengkap dengan instruksi untuk generasi gambar
        const fullPrompt = `Tolong buatkan gambar berdasarkan deskripsi berikut: ${prompt}. Pastikan hasilnya berkualitas tinggi dan fotorealistis.`;

        // Panggil metode 'generateContent'
        const result = await model.generateContent(fullPrompt);
        
        const response = await result.response;

        // Periksa apakah ada 'parts' di dalam respons
        if (!response.candidates?.[0]?.content?.parts) {
            // Jika tidak ada 'parts', kemungkinan ada teks penolakan
            const rejectionText = response.text();
            throw new Error(`Model AI menolak prompt. Alasan: ${rejectionText}`);
        }

        // Filter untuk mengambil hanya bagian yang berisi data gambar (inlineData)
        const imageParts = response.candidates[0].content.parts.filter(part => part.inlineData);

        if (imageParts.length === 0) {
            throw new Error('Model AI tidak menghasilkan gambar. Coba prompt yang berbeda atau lebih sederhana.');
        }

        console.log(`[GEMINI NATIVE IMAGE] Berhasil mendapatkan ${imageParts.length} gambar.`);
        
        // Konversi setiap gambar dari base64 menjadi Buffer
        const imageBuffers = imageParts.map(part => {
            const base64Image = part.inlineData.data;
            return Buffer.from(base64Image, "base64");
        });

        return imageBuffers;

    } catch (error) {
        console.error("🚫 Error di GEMINI_IMAGE (Native):", error);
        throw new Error(error.message || 'Terjadi kesalahan internal pada modul AI gambar.');
    }
}

// Pastikan kedua fungsi diekspor
module.exports = { GEMINI_TEXT, GEMINI_IMAGE };