// FILE: gemini.js (VERSI UPGRADE)

const config = require('../config');
const axios = require('axios');

function getWaktuWIB() {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utcTime + (7 * 60 * 60 * 1000));
    const hari = wibTime.getDate();
    const bulanIndex = wibTime.getMonth();
    const tahun = wibTime.getFullYear();
    const jam = wibTime.getHours().toString().padStart(2, '0');
    const menit = wibTime.getMinutes().toString().padStart(2, '0');
    const namaBulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${hari} ${namaBulan[bulanIndex]} ${tahun} jam ${jam}:${menit} WIB`;
}

global.conversationHistories = {};

/**
 * Fungsi utama untuk berinteraksi dengan Gemini API.
 * Kini mendukung input teks saja atau teks + gambar.
 * @param {string} id_user - ID unik pengguna untuk histori percakapan.
 * @param {string} prompt - Teks prompt dari pengguna.
 * @param {Buffer} [imageBuffer=null] - Buffer gambar (opsional) untuk mode vision/OCR.
 * @returns {Promise<string>} - Respons teks dari AI.
 */
async function GEMINI_TEXT(id_user, prompt, imageBuffer = null) {
    // Tentukan model dan URL berdasarkan apakah ada gambar atau tidak
    const isVisionRequest = imageBuffer !== null;
    const model = isVisionRequest ? "gemini-pro-vision" : "gemini-2.5-pro"; // Gunakan model vision jika ada gambar
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`;

    try {
        let requestBody;

        if (isVisionRequest) {
            // =======================================================
            // LOGIKA BARU UNTUK PERMINTAAN DENGAN GAMBAR (OCR)
            // =======================================================
            console.log("Membuat request ke Gemini Vision API...");

            // Konversi buffer gambar ke format base64
            const imageBase64 = imageBuffer.toString('base64');

            requestBody = {
                contents: [
                    {
                        parts: [
                            { text: prompt }, // Prompt pengguna, misal: "Baca teks di gambar ini"
                            {
                                inline_data: {
                                    mime_type: "image/jpeg", // Asumsi jpeg, bisa juga diganti jadi png
                                    data: imageBase64
                                }
                            }
                        ]
                    }
                ]
            };
            // Catatan: Histori percakapan tidak digunakan untuk mode vision agar request tetap simpel.
            
        } else {
            // =======================================================
            // LOGIKA LAMA ANDA UNTUK PERMINTAAN TEKS SAJA
            // =======================================================
            if (!conversationHistories[id_user]) {
                conversationHistories[id_user] = [];
            }

            let initialContext = `Kamu adalah Resbot AI, asisten cerdas buatan tim dari Autoresbot (jika di tanya website tunjukkan autoresbot.com dan jika ada yang nanya waktu sekarang adalah @NOW ). Tugasmu adalah menjawab pertanyaan dengan baik, ramah, dan cerdas, serta jangan terlalu panjang dan terlalu pendek, apapun yang ditanyakan.`;
            initialContext = initialContext.replace('@NOW', getWaktuWIB());

            const fullPrompt = `${initialContext}\n${conversationHistories[id_user].join('\n')}\nUser: ${prompt}\nAI:`;

            requestBody = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: fullPrompt }]
                    }
                ]
            };
        }

        // Kirim request ke API
        const response = await axios.post(API_URL, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        // Ekstrak teks respons dari kandidat pertama
        const responseText = response.data.candidates[0].content.parts[0].text;

        // Hanya simpan history jika ini adalah percakapan teks biasa
        if (!isVisionRequest) {
            conversationHistories[id_user].push('User: ' + prompt);
            conversationHistories[id_user].push('AI: ' + responseText);

            if (conversationHistories[id_user].length > 10) {
                conversationHistories[id_user] = conversationHistories[id_user].slice(-10);
            }
        }

        return responseText;

    } catch (error) {
        // Blok error handling Anda yang sudah bagus, tidak perlu diubah
        console.error('Error generating AI content:', error.response ? error.response.data : error.message);
        
        const panduan = 'https://youtu.be/02oGg3-3a-s?si=ElXoKafRCG9B-7XD';
        const errorMessage = error.message || '';
        
        if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
            return `Jika melihat error ini, berarti apikey gemini terkena limit karena pengguna yang terlalu banyak. Silakan gunakan apikey gemini pribadi.\n\n${panduan}`;
        }
        if (errorMessage.includes('403') || errorMessage.includes('permission denied')) {
            return `Jika melihat error ini, berarti apikey gemini masih kosong atau salah. Silakan gunakan apikey gemini pribadi.\n\n${panduan}`;
        }

        return error.response?.data?.error?.message || errorMessage || 'Terjadi kesalahan pada sistem. Silakan coba lagi nanti.';
    }
}

module.exports = { GEMINI_TEXT };