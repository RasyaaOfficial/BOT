// Owner Bot : autoresbot.com

const config                        = require('../config');
const ApiAutoresbot                 = require('api-autoresbot');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const api                           = new ApiAutoresbot(config.API_KEY);
const { writeFile }                 = require('fs').promises;
const moment                        = require('moment');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const { execSync } = require('child_process')
const mime = require('mime-types')
const crypto                        = require('crypto');
const { 
    downloadMediaMessage,
    prepareWAMessageMedia,      // <-- Tambahkan ini
    generateWAMessageFromContent, // <-- Tambahkan ini
    proto                       // <-- Tambahkan ini
} = require('baileys');
const url                           = require('url');
const pino                          = require("pino");
const logger                        = pino({ level: "silent" });
const { sendImageAsSticker }        = require("./exif");
const { getSession, updateSession, resetSession } = require("./session");
const { GEMINI_TEXT }               = require("./gemini");
const { searchSong }                = require('./ytdl');
const { getBuffer, displayMenu,log, checkUrlType }    = require('./utils');
const { HDR, TIKTOK, SEARCH_IMAGE, FACEBOOK, IG }           = require('./features');
const { detectLink }                                        = require('./detect');
const  { setActiveFitur, getActiveFitur, resetActiveFitur } = require('./activeFeatures');
const { addUser, editUser, deleteUser, getUser, resetUsersJson, checkLimit, reduceLimit, getUserPremium, getAllUsers } = require('./users');

// addUser, editUser(remoteJid, 5);, deleteUser(remoteJid), getUser, isPremiumUser, checkLimit,reduceLimit



/**
 * Function to download media message, save to a file with a random name, and return the buffer
 * @param {Object} message - The message object from which to download media
 * @param {Object} sock - The socket object for handling media reupload
 * @param {string} directory - The directory where the file should be saved
 * @param {Object} logger - The logger object (optional)
 * @returns {Buffer} - The buffer of the downloaded media
 */
async function downloadAndSaveMedia(message, sock, logger) {
    try {
        const directory = './tmp';

        // Menghasilkan nama file acak
        const randomFileName = crypto.randomBytes(16).toString('hex') + '.jpg';
        const filePath = path.join(directory, randomFileName);
        
        // Mengunduh media
        const buffer = await downloadMediaMessage(message, 'buffer', {}, {
            logger,
            reuploadRequest: sock.updateMediaMessage
        });
        
        // Menyimpan buffer ke file
        await writeFile(filePath, buffer);
        
        // Mengembalikan objek yang berisi buffer dan path
        return { buffer, filePath };
    } catch (error) {
        throw new Error('Error downloading and saving media: ' + error.message);
    }
}

async function downloadQuotedMedia(message, folderPath) {

    const directory = './tmp';


    const { downloadContentFromMessage } = require("baileys");
 
    try {
        // Validasi apakah pesan mengutip media
        if (
            !message.message ||
            !message.message.extendedTextMessage ||
            !message.message.extendedTextMessage.contextInfo ||
            !message.message.extendedTextMessage.contextInfo.quotedMessage
        ) {
            console.log("Pesan ini tidak mengutip media.");
            return null;
        }

        const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;

        let mediaType = '';
        let mediaMessage = null;

        // Deteksi jenis media
        if (quotedMessage.imageMessage) {
            mediaType = 'image';
            mediaMessage = quotedMessage.imageMessage;
        } else if (quotedMessage.videoMessage) {
            mediaType = 'video';
            mediaMessage = quotedMessage.videoMessage;
        } else if (quotedMessage.audioMessage) {
            mediaType = 'audio';
            mediaMessage = quotedMessage.audioMessage;
        } else if (quotedMessage.documentMessage) {
            mediaType = 'document';
            mediaMessage = quotedMessage.documentMessage;
        } else if (quotedMessage.stickerMessage) {
            mediaType = 'sticker';
            mediaMessage = quotedMessage.stickerMessage;
        } else if (quotedMessage.viewOnceMessageV2) {
            mediaType = 'image';
            mediaMessage = message.message.extendedTextMessage.contextInfo.quotedMessage.viewOnceMessageV2.message.imageMessage;
        } else {
            return null;
        }

        // Unduh media
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);

        // Tentukan nama file dan ekstensi
        const fileName = mediaMessage.fileName || `${mediaType}_${Date.now()}`;
        const extensionMap = {
            image: '.jpg',
            video: '.mp4',
            audio: '.mp3',
            sticker: '.webp',
        };
        const fileExtension = mediaType === 'document'
            ? path.extname(mediaMessage.fileName || '.bin')
            : extensionMap[mediaType] || '';

        // Tambahkan ekstensi jika belum ada
        const finalFileName = fileName.endsWith(fileExtension) ? fileName : `${fileName}${fileExtension}`;
        const filePath = path.join(directory, finalFileName);

        // Simpan file
        const fileBuffer = [];
        for await (const chunk of stream) {
            fileBuffer.push(chunk);
        }
        // fs.writeFileSync(filePath, Buffer.concat(fileBuffer));

        const buffer = Buffer.concat(fileBuffer);
        await writeFile(filePath, buffer);
        //return finalFileName;

          // Mengembalikan objek yang berisi buffer dan path
          return { buffer, filePath };
    } catch (error) {
        console.error("Gagal mengunduh media:", error);
        return null;
    }
}

// let isSendingReply = false; // flag status

function isValidJid(jid) {
    return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us');
  }


const tmpFilePath = path.join(__dirname, 'tmp', 'orders.json');

setInterval(() => {
if (fs.existsSync(tmpFilePath)) {
const orderData = JSON.parse(fs.readFileSync(tmpFilePath, 'utf8'));

Object.keys(orderData).forEach(key => {
const createdAt = new Date(orderData[key].createdAt).getTime();
const currentTime = Date.now();

if (currentTime - createdAt > 300000) {
const payId = orderData[key].payId;

delete orderData[key];
fs.writeFileSync(tmpFilePath, JSON.stringify(orderData, null, 2));
}
});

fs.writeFileSync(tmpFilePath, JSON.stringify(orderData, null, 2));
}
}, 5000);

function generateRandomNumber(min, max) {
return Math.floor(Math.random() * (max - min + 1)) + min;
}


async function uploadToImgBB(buffer) {
    if (!config.imgbb_api_key) {
        throw new Error('API Key untuk ImgBB belum diatur di config.js');
    }

    try {
        // 1. Siapkan body permintaan dalam format URL-encoded
        // Ini adalah cara yang lebih stabil untuk mengirim data base64 ke banyak API
        const body = new URLSearchParams();
        body.append('key', config.imgbb_api_key);
        body.append('image', buffer.toString('base64'));
        body.append('name', `ghibli-upload-${Date.now()}`); // Opsional: beri nama

        // 2. Lakukan permintaan POST dengan header yang benar
        const response = await axios.post('https://api.imgbb.com/1/upload', body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!response.data || !response.data.data || !response.data.data.url) {
            // Coba tampilkan pesan error dari API jika ada
            const errorMessage = response.data?.error?.message || 'Respons API ImgBB tidak valid.';
            throw new Error(errorMessage);
        }
        
        return response.data.data.url;

    } catch (error) {
        console.error("🚫 Upload ImgBB Gagal:", error.response ? error.response.data : error.message);
        // Teruskan pesan error yang lebih spesifik jika ada
        const apiError = error.response?.data?.error?.message || error.message;
        throw new Error(`Gagal mengunggah gambar ke ImgBB: ${apiError}`);
    }
}
const generateRandomText = (length) => {
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let text = '';
for (let i = 0; i < length; i++) {
text += characters.charAt(Math.floor(Math.random() * characters.length));
}
return text;
}


const toRupiah = (angka) => {
return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const sendReply = async (sock, remoteJid, rule, message) => {
    try {
        // contoh:
        if (!isValidJid(remoteJid)) {
            return console.log('JID tidak valid, tidak mengirim:', remoteJid);
        }

        // if (isSendingReply) {
        //     console.log('Masih dalam proses, return false');
        //     return false;
        // }
        // isSendingReply = true; // tandai bahwa proses sedang berjalan
        
        //await new Promise(resolve => setTimeout(resolve, 4000));
        // isSendingReply = false;
        
        const { message_type, reply_text, image_url, footer, button_data } = rule;

        // Send text message
        if (message_type === 'text') {
            await sock.sendMessage(remoteJid, { text: reply_text }, { quoted: message });

            // Send image message
        } else if (message_type === 'image' && image_url) {
            await sock.sendMessage(remoteJid, {
                image: { url: image_url },
                caption: reply_text || ''
            }, { quoted: message });

            // Send document message
        } else if (message_type === 'document' && image_url) {
            const fileName = path.basename(image_url); // Get file name from URL
            const mimeType = mime.lookup(fileName); // Get MIME type from file extension

            // Send text before document if available
            if (reply_text && reply_text.trim() !== '') {
                await sock.sendMessage(remoteJid, { text: reply_text }, { quoted: message });
            }

            await sock.sendMessage(remoteJid, {
                document: { url: image_url },
                fileName,
                mimetype: mimeType
            }, { quoted: message });
        } else if (message_type === 'native_flow_button') { // Tombol List / Flow
            await sock.sendMessage(remoteJid, {
                text: reply_text,
                footer: footer,
                buttons: rule.buttons,
                headerType: 1
            }, { quoted: message });
        } else if (message_type === 'carousel_button') { // Tombol Carousel
             await sock.sendMessage(remoteJid, {
                text: reply_text,
                footer: footer,
                templateButtons: rule.templateButtons,
                headerType: 1
            }, { quoted: message });
        }else if (message_type === 'sticker' && image_url) {
            const options = {
                packname: config.sticker_packname,
                author: config.sticker_author
            };
            await sendImageAsSticker(sock, remoteJid, image_url, options, message);

        }else if (message_type === 'vn' && image_url) {
            await sock.sendMessage(remoteJid,
                { audio: image_url, mimetype: 'audio/mp4', ptt: true },
                { quoted: message }
            );
        }else if (message_type === 'native_button' && rule.buttons) {
    await sock.sendMessage(remoteJid, {
        interactiveMessage: {
            body: { text: rule.reply_text },
            footer: { text: rule.footer },
            header: {
                title: "",
                hasMediaAttachment: true,
                imageMessage: {
                    url: rule.image_url
                }
            },
            nativeFlowMessage: {
                buttons: rule.buttons
            }
        }
    }, { quoted: message });
}

if (rule.action && rule.action.features === 'removebg_official') {
    try {
        const formData = new FormData();
        formData.append('image_file', rule.action.content, 'image.jpg');
        formData.append('size', 'auto');

        const { data } = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': 'N6nMWn3cJon9zQoJ4u15Dzap'
            },
            responseType: 'arraybuffer', // karena hasilnya gambar
            maxBodyLength: Infinity
        });

        // Kirim hasil PNG ke user
        await sock.sendMessage(remoteJid, {
            image: Buffer.from(data),
            caption: '✅ Background berhasil dihapus!'
        }, { quoted: message });

    } catch (e) {
        await sock.sendMessage(remoteJid, {
            text: e.message || config.error.THROW
        }, { quoted: message });
    }

    resetActiveFitur(remoteJid, "removebg");
}

if (rule.action && rule.action.features === 'set_global_config') {
    try {
        const { key: configKeyToUpdate, oldValue, newValue } = rule.action.content;

        console.log(`[SET_CONFIG] Memulai proses. Kunci: ${configKeyToUpdate}, Nilai Lama: "${oldValue}", Nilai Baru: "${newValue}"`);
        
        const projectRoot = path.resolve(__dirname, '..');
        let filesModifiedCount = 0;
        let filesScannedCount = 0;

        // Fungsi helper untuk "meloloskan" karakter khusus dari string agar aman digunakan di Regex
        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // Buat Regex yang aman dari nilai lama. Flag 'gi' membuatnya Global (mengganti semua) dan Case-Insensitive (tidak peduli huruf besar/kecil).
        const oldValRegex = new RegExp(escapeRegExp(oldValue), 'gi');

        // Fungsi rekursif untuk memindai semua direktori
        const scanAndReplace = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                
                // Abaikan folder-folder berat
                if (['node_modules', '.git', 'session', 'tmp'].includes(item)) continue;
                
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                    scanAndReplace(fullPath); // Masuk ke sub-folder
                } 
                // Hanya proses file yang relevan
                else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.json') || item.endsWith('.txt'))) {
                    filesScannedCount++;
                    let fileContent = fs.readFileSync(fullPath, 'utf8');
                    let hasChanged = false;

                    if (oldValRegex.test(fileContent)) {
                        // Ganti semua kemunculan nilai lama dengan nilai baru
                        fileContent = fileContent.replace(oldValRegex, newValue);
                        hasChanged = true;
                    }
                    
                    // --- PERLAKUAN KHUSUS UNTUK CONFIG.JS ---
                    // Ini penting untuk memastikan variabel di config.js sendiri juga terupdate dengan benar
                    if (path.basename(fullPath) === 'config.js') {
                        const configRegex = new RegExp(`(${configKeyToUpdate}:\\s*['"\`]).*?(['"\`])`);
                        if (configRegex.test(fileContent)) {
                            const finalNewValue = isNaN(newValue) ? `${newValue}` : newValue;
                            const newFileContent = fileContent.replace(configRegex, `$1${finalNewValue}$2`);
                            if (newFileContent !== fileContent) {
                                fileContent = newFileContent;
                                hasChanged = true;
                            }
                        }
                    }

                    // Hanya tulis kembali ke disk jika benar-benar ada perubahan
                    if (hasChanged) {
                        fs.writeFileSync(fullPath, fileContent, 'utf8');
                        console.log(`[SET_CONFIG] Mengubah file: ${fullPath}`);
                        filesModifiedCount++;
                    }
                }
            }
        };

        // Mulai proses
        scanAndReplace(projectRoot);
        
        // Update nilai di objek config yang sedang berjalan
        config[configKeyToUpdate] = newValue;
        
        await sock.sendMessage(remoteJid, {
            text: `✅ Proses selesai!\n\nTotal file dipindai: *${filesScannedCount}*\nTotal file diubah: *${filesModifiedCount}*\n\nBot akan segera restart dengan konfigurasi baru.`
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Set Config Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal mengubah konfigurasi.\n\n*Alasan:* ${error.message}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'filter_hitam') {
    let mediaInfo = null;
    let mediaPath = null;
    try {
        // 1. Unduh gambar
        mediaInfo = rule.action.source === 'direct' 
            ? await downloadAndSaveMedia(message, sock, logger)
            : await downloadQuotedMedia(message);
        
        if (!mediaInfo || !mediaInfo.buffer) {
            throw new Error('Gagal mengunduh gambar.');
        }
        mediaPath = mediaInfo.filePath;
        const base64Image = mediaInfo.buffer.toString('base64');
        
        // 2. Panggil API
        const response = await axios.post("https://negro.consulting/api/process-image", {
            filter: "hitam",
            imageData: "data:image/png;base64," + base64Image
        });

        if (!response.data || !response.data.processedImageUrl) {
            throw new Error('API tidak mengembalikan hasil gambar.');
        }

        // 3. Konversi hasil base64 menjadi buffer
        const resultBuffer = Buffer.from(response.data.processedImageUrl.replace("data:image/png;base64,", ""), "base64");
        
        // 4. Kirim gambar hasil
        await sock.sendMessage(remoteJid, { image: resultBuffer, caption: `Selesai, filter *hitam* telah diterapkan.` }, { quoted: message });

    } catch (error) {
        console.error("🚫 Filter Hitam Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal memproses gambar.\n\n*Alasan:* ${error.message || 'API tidak merespons.'}` }, { quoted: message });
    } finally {
        if (mediaPath && fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
        }
    }
}


if (rule.action && rule.action.features === 'codeshare_search') {
    try {
        const query = rule.action.content;
        const url = `https://codeshare.cloudku.click/?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);
        const results = [];

        // Ambil maksimal 3 kartu hasil pertama
        const cards = $('.snippet-card').slice(0, 3).toArray();

        if (cards.length === 0) {
            throw new Error('Tidak ada kode yang ditemukan untuk kata kunci tersebut.');
        }

        let replyText = `*Berikut adalah ${cards.length} hasil teratas untuk "${query}":*\n\n`;

        for (const el of cards) {
            const card = $(el);
            const title = card.find('.card-title a').text().trim();
            const path = card.find('.card-title a').attr('href');
            const link = 'https://codeshare.cloudku.click' + path;
            const languageIcon = card.find('.meta-item i').attr('class') || '';
            const language = languageIcon.split('-').pop().replace('plain', '') || 'unknown';

            replyText += `*Judul:* ${title}\n`
                      + `*Bahasa:* ${language}\n`
                      + `*Link:* ${link}\n`
                      + `--------------------------\n`;
        }

        await sock.sendMessage(remoteJid, { text: replyText.trim() }, { quoted: message });

    } catch (error) {
        console.error("🚫 Codeshare Search Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Eror kak: ${error.message}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'codeshare_get_raw') {
    try {
        let url = rule.action.content;
        if (!url.endsWith('&raw=true')) {
            url += '&raw=true';
        }
        
        const response = await axios.get(url);
        const code = response.data;

        await sock.sendMessage(remoteJid, { text: "```\n" + code + "\n```" }, { quoted: message });

    } catch (error) {
        console.error("🚫 Codeshare Get Raw Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Eror kak: Gagal mengambil kode dari URL tersebut. Pastikan URL valid.` }, { quoted: message });
    }
}
// ===== Proses Screenshot Website =====
if (rule.action && rule.action.features === 'ssweb') {
    try {
        const { url } = rule.action.content;
        const apiUrl = `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}&theme=dark&device=desktop`;

        const { data } = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            maxBodyLength: Infinity
        });

        await sock.sendMessage(remoteJid, {
            image: Buffer.from(data),
            caption: `📸 Screenshot\n🌐 ${url}`
        }, { quoted: message });

    } catch (e) {
        await sock.sendMessage(remoteJid, {
            text: e.message || config.error.THROW
        }, { quoted: message });
    }
}

        // Proses Play Audio
        if(rule.action && rule.action.content && rule.action.features && rule.action.features == 'play') {
            const songInfo = await searchSong(rule.action.content);
            if (songInfo) {
                const dataYoutubeMP3 = await api.get('/api/downloader/ytplay', {url : songInfo.url });
                if(dataYoutubeMP3.bytes > 94491648) {
                    return await sock.sendMessage(remoteJid, { text: config.error.FILE_TOO_LARGE }, { quoted: message });
                }

                await sock.sendMessage(remoteJid, {
                    audio: {url : dataYoutubeMP3.url},
                    mimetype: "audio/mp4",
                    contextInfo: {
                        externalAdReply: {
                            showAdAttribution: true,
                            title: songInfo.title || "Untitled",
                            body: config.owner_name,
                            sourceUrl: songInfo.url,
                            thumbnailUrl: songInfo.image || "https://example.com/default_thumbnail.jpg",
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text: config.error.PLAY_ERROR }, { quoted: message });
            }
            resetActiveFitur(remoteJid, "play");
        }

if (rule.action && rule.action.features === 'execute_backup_direct') {
    let zipFilePath = ''; // Variabel untuk menyimpan path file zip
    try {
        const botName = `SimpleAi-Backup`;
        // Dapatkan daftar file yang akan di-backup
        const fileList = execSync('ls').toString().split('\n').filter(name =>
            !['node_modules', 'session', 'package-lock.json', 'yarn.lock', '', '.git', 'tmp'].includes(name)
        );
        const zipFile = `${botName}-${Date.now()}.zip`;
        zipFilePath = path.resolve(zipFile); // Dapatkan path absolut

        // Buat file ZIP
        console.log(`[BACKUP] Membuat file: ${zipFile}`);
        execSync(`zip -r ${zipFilePath} ${fileList.join(' ')}`);

        // Kirim dokumen
        await sock.sendMessage(remoteJid, {
            document: { url: zipFilePath },
            fileName: zipFile,
            mimetype: 'application/zip',
            caption: `📦 Ini dia file backup script Anda!\n\nTotal item yang diarsipkan: ${fileList.length}`
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Eksekusi Backup Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal membuat file backup: ${error.message}` }, { quoted: message });
    } finally {
        // Selalu hapus file zip setelah dikirim
        if (zipFilePath && fs.existsSync(zipFilePath)) {
            console.log(`[BACKUP] Menghapus file sementara: ${zipFilePath}`);
            fs.unlinkSync(zipFilePath);
        }
        // Reset fitur agar bisa digunakan lagi
        resetActiveFitur(sender, 'backup');
    }
}

if (rule.action && rule.action.features === 'save_web_to_zip') {
    try {
        const url = rule.action.content;
        const apiUrl = `https://api.nekoo.qzz.io/tools/saveweb2zip?url=${encodeURIComponent(url)}`;
        
        console.log(`[WEB2ZIP] Memanggil API untuk URL: ${url}`);
        
        // 1. Panggil API untuk memulai proses pengarsipan
        const response = await axios.get(apiUrl);
        const result = response.data.result;
        
        // 2. Periksa apakah ada error dari API
        if (!response.data.status || result.error.code !== 0) {
            throw new Error(result.error.text || 'API gagal memproses URL yang diberikan.');
        }

        if (!result.downloadUrl) {
            throw new Error('API tidak mengembalikan URL unduhan.');
        }

        console.log(`[WEB2ZIP] Proses selesai. URL unduhan: ${result.downloadUrl}`);

        // 3. Ekstrak nama domain untuk nama file .zip
        const domain = new URL(url).hostname;
        const fileName = `${domain.replace(/\./g, '-')}.zip`;
        
        // 4. Kirim file .zip sebagai dokumen ke pengguna
        await sock.sendMessage(remoteJid, {
            document: { url: result.downloadUrl },
            fileName: fileName,
            mimetype: 'application/zip',
            caption: `✅ Website *${url}* berhasil diarsipkan!\n\nTotal file yang disalin: ${result.copiedFilesAmount}`
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Save Web to ZIP Gagal:", error);
        
        let errorMessage = 'Terjadi kesalahan yang tidak diketahui.';
        if (error.response) {
            errorMessage = `API merespons dengan status ${error.response.status}.`;
        } else {
            errorMessage = error.message;
        }

        await sock.sendMessage(remoteJid, { text: `Maaf, terjadi kesalahan saat mengarsipkan website.\n\n*Detail:* ${errorMessage}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'ptero_create_server_v2') {
    try {
        const { ram, username, targetJid } = rule.action.content;
        
        const domain = config.PTERO_DOMAIN;
        const apikey = config.PTERO_API_KEY;
        const nestId = 6;
        const eggId = config.PTERO_EGG_ID;
        const locId = config.PTERO_LOCATION_ID;

        // 1. Definisikan Resource Map
        const resourceMap = {
            "1": { memory: 1024, disk: 3072, cpu: 30 },
            "2": { memory: 2048, disk: 5120, cpu: 60 },
            "3": { memory: 3072, disk: 7168, cpu: 90 },
            "4": { memory: 4096, disk: 10240, cpu: 120 },
            "5": { memory: 5120, disk: 12288, cpu: 150 },
            "unli": { memory: 0, disk: 0, cpu: 0 }
        };
        const resources = resourceMap[ram];
        if (!resources) throw new Error(`Spesifikasi RAM "${ram}GB" tidak valid.`);
        
        // 2. Siapkan data user
        const email = `${username}@${new URL(domain).hostname}`;
        const name = username.charAt(0).toUpperCase() + username.slice(1);
        const password = `${username}Bot${Math.floor(Math.random() * 1000)}`;

        // 3. Panggil API Pterodactyl untuk membuat user dan server
        const userData = await pteroRequest('/users', 'POST', {
            email, username, first_name: name, last_name: "Server", language: "en", password
        });
        const user = userData.attributes;

        const eggData = await pteroRequest(`/nests/${nestId}/eggs/${eggId}`);
        const serverData = await pteroRequest('/servers', 'POST', {
            name: `🟢 ${name}'s Server`,
            description: `Dibuat oleh ${pushName || 'Bot'} melalui ResBot AI`,
            user: user.id, egg: eggId,
            docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
            startup: eggData.attributes.startup,
            environment: { INST: "npm", USER_UPLOAD: "0", AUTO_UPDATE: "0", CMD_RUN: "npm start" },
            limits: { memory: resources.memory, swap: 0, disk: resources.disk, io: 500, cpu: resources.cpu },
            feature_limits: { databases: 5, backups: 5, allocations: 1 },
            deploy: { locations: [locId], dedicated_ip: false, port_range: [] }
        });
        const server = serverData.attributes;
        const caption = `*PANEL ACCESS DETAILS*\n\n` +
                        `Berikut adalah detail login untuk akun panel Anda. Klik tombol di bawah untuk menyalin informasi atau langsung login.\n\n` +
                        `*Username:* ${username}\n` +
                        `*Password:* ${password}\n` +
                        `*Server ID:* ${server.id}\n` +
                        `*Login:* ${domain}`;

        const interactiveButtons = [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "Salin Username",
                    copy_code: username
                })
            },
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "Salin Password",
                    copy_code: password
                })
            },
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "Login ke Panel",
                    url: domain
                })
            }
        ];

        // 5. Bangun pesan interaktif menggunakan proto
        const buttonMsg = await generateWAMessageFromContent(targetJid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: { text: caption },
                        footer: { text: "Harap simpan detail ini dengan aman." },
                        nativeFlowMessage: { buttons: interactiveButtons }
                    })
                }
            }
        }, { userJid: sender });

        // 6. Kirim pesan ke nomor target
        await sock.relayMessage(targetJid, buttonMsg.message, { messageId: buttonMsg.key.id });

        // 7. Kirim konfirmasi ke owner
        await sock.sendMessage(remoteJid, {
            text: `[ ✓ ] Server *${username}* (${ram.toUpperCase()}GB) berhasil dibuat & dikirim ke @${targetJid.split("@")[0]}.`,
            mentions: [targetJid]
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Pterodactyl Create Server Gagal:", error.response ? error.response.data : error);
        let errorMessage = 'Terjadi kesalahan sistem.';
        await sock.sendMessage(remoteJid, { text: `Gagal membuat server.\n\n*Alasan:* ${errorMessage}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'ptero_create_admin') {
    try {
        const { username, targetJid } = rule.action.content;
        
        const domain = config.PTERO_DOMAIN;
        const apikey = config.PTERO_API_KEY;

        // 1. Validasi nomor (sudah pasti ada di WA karena kita dapat dari tag/reply)
        const [onWa] = await sock.onWhatsApp(targetJid);
        if (!onWa?.exists) {
            throw new Error(`Nomor target tidak lagi terdaftar di WhatsApp.`);
        }

        // 2. Siapkan data user
        const email = `${username}@${new URL(domain).hostname}`;
        const name = username.charAt(0).toUpperCase() + username.slice(1);
        const password = `${username}NeoSecure${Math.floor(Math.random() * 1000)}`;

        // 3. Panggil API untuk membuat user
        console.log(`[PTERO ADMIN] Membuat akun admin: ${username}`);
        const userResponse = await axios.post(`${domain}/api/application/users`, 
            {
                email, username, first_name: name, last_name: "Admin",
                language: "en", password, root_admin: true
            },
            { headers: { 'Authorization': `Bearer ${apikey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
        );
        const userData = userResponse.data;
        if (!userData?.attributes?.id) throw new Error("Gagal mendapatkan User ID dari Pterodactyl.");

        // 4. Siapkan pesan dengan tombol interaktif
        const caption = `*NEO ADMIN PANEL*\n\n` +
                        `*Username:* ${username}\n` +
                        `*Password:* ${password}\n` +
                        `*Admin ID:* ${userData.attributes.id}\n\n` +
                        `*Akses:* Full Root Admin\n` +
                        `*Panel:* ${domain}\n\n` +
                        `╭─❖ *RULES ADMIN* ❖─\n` +
                        `│ 1. Jaga data user.\n` +
                        `│ 2. Jangan intip server orang lain.\n` +
                        `│ 3. Laporkan bug ke Owner.\n` +
                        `╰── Selamat bergabung!`;
        
        const interactiveButtons = [
            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Salin Username', copy_code: username }) },
            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Salin Password', copy_code: password }) },
            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Login ke Panel', url: domain }) }
        ];

        const buttonMsg = await generateWAMessageFromContent(targetJid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: { text: caption },
                        nativeFlowMessage: { buttons: interactiveButtons }
                    })
                }
            }
        }, { userJid: sender });

        // 5. Kirim pesan ke nomor target
        await sock.relayMessage(targetJid, buttonMsg.message, { messageId: buttonMsg.key.id });

        // 6. Kirim konfirmasi ke owner
        await sock.sendMessage(remoteJid, {
            text: `[ ✓ ] *Akun admin @${username}* berhasil dibuat & dikirim ke @${targetJid.split("@")[0]}.`,
            mentions: [targetJid]
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Gagal membuat admin Pterodactyl:", error.response ? error.response.data : error);
        const errorMessage = error.response?.data?.errors?.[0]?.detail || error.message || 'Terjadi kesalahan.';
        await sock.sendMessage(remoteJid, { text: `Gagal membuat akun admin.\n\n*Alasan:* ${errorMessage}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'ptero_list_admins') {
    try {
        const domain = config.PTERO_DOMAIN;
        const apikey = config.PTERO_API_KEY;

        const response = await axios.get(`${domain}/api/application/users`, {
            headers: { 'Authorization': `Bearer ${apikey}`, 'Accept': 'application/json' }
        });

        const allUsers = response.data.data;
        const rootAdmins = allUsers.filter(u => u.attributes.root_admin === true);

        if (rootAdmins.length === 0) {
            throw new Error("Tidak ada admin root yang terdaftar di panel.");
        }

        // 1. Bangun baris-baris (rows) untuk tombol list
        const rows = rootAdmins.map(admin => {
            const u = admin.attributes;
            return {
                title: u.username,
                description: `ID: ${u.id} • Email: ${u.email}`,
                id: `hapus admin ${u.id}` // Perintah alami yang akan dikirim saat diklik
            };
        });

        // 2. Siapkan parameter JSON untuk nativeFlow
        const paramsJson = JSON.stringify({
            title: 'HAPUS ADMIN PANEL',
            sections: [{
                title: 'Pilih admin yang akan dihapus',
                rows: rows
            }]
        });

        // 3. Bangun dan kirim pesan Native Flow Button
        const listButton = [{
            buttonId: 'admin_list_button',
            buttonText: { displayText: '📜 Buka Daftar Admin' },
            type: 4,
            nativeFlowInfo: { name: 'single_select', paramsJson: paramsJson }
        }];
        
        let listText = `*DAFTAR ADMIN PANEL*\n\nTotal: ${rootAdmins.length} admin\n\n`;
        rootAdmins.forEach((admin, i) => {
            const u = admin.attributes;
            listText += `*${i + 1}.* ${u.username} (ID: ${u.id})\n`;
        });
        listText += `\nKlik tombol di bawah untuk memilih admin yang akan dihapus.`;

        await sock.sendMessage(remoteJid, {
            text: listText,
            footer: `Panel: ${domain}`,
            buttons: listButton,
            headerType: 1
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Gagal mengambil list admin:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal mengambil daftar admin.\n\n*Alasan:* ${error.message}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'ptero_delete_admin') {
    try {
        const adminId = rule.action.content;
        const domain = config.PTERO_DOMAIN;
        const apikey = config.PTERO_API_KEY;

        // 1. Dapatkan info admin terlebih dahulu untuk konfirmasi nama
        const getRes = await axios.get(`${domain}/api/application/users/${adminId}`, {
            headers: { 'Authorization': `Bearer ${apikey}` }
        });
        const adminUsername = getRes.data.attributes.username;

        // 2. Kirim permintaan DELETE
        await axios.delete(`${domain}/api/application/users/${adminId}`, {
            headers: { 'Authorization': `Bearer ${apikey}` }
        });

        // 3. Kirim pesan sukses
        await sock.sendMessage(remoteJid, {
            text: `✅ *Sukses!* Akun admin *${adminUsername}* (ID: ${adminId}) telah berhasil dihapus dari panel.`
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Gagal menghapus admin:", error.response ? error.response.data : error);
        const errorMessage = error.response?.data?.errors?.[0]?.detail || error.message || 'ID Admin tidak ditemukan.';
        await sock.sendMessage(remoteJid, { text: `Gagal menghapus admin.\n\n*Alasan:* ${errorMessage}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'image_picupscaler') {
    let mediaInfo = null;
    let mediaPath = null;
    try {
        // 1. Unduh gambar dari pesan langsung atau pesan yang di-reply
        if (rule.action.source === 'direct') {
            mediaInfo = await downloadAndSaveMedia(message, sock, logger);
        } else {
            mediaInfo = await downloadQuotedMedia(message);
        }

        if (!mediaInfo || !mediaInfo.buffer) {
            throw new Error('Gagal mengunduh gambar untuk diproses.');
        }
        mediaPath = mediaInfo.filePath;
        const imageBuffer = mediaInfo.buffer;
        
        // 2. Logika Inti dari Plugin (diadaptasi ke sini)
        console.log('[PICUPSCALER] Memproses gambar...');
        const form = new FormData();
        form.append('image', imageBuffer, {
            filename: 'upload.jpg',
            contentType: 'image/jpeg'
        });
        form.append('user_id', 'undefined'); // Sesuai dengan kode asli
        form.append('is_public', 'true');    // Sesuai dengan kode asli

        const headers = {
            ...form.getHeaders(),
            'Accept': '*/*',
            'Origin': 'https://picupscaler.com',
            'Referer': 'https://picupscaler.com/',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
        };

        const { data } = await axios.post('https://picupscaler.com/api/generate/handle', form, { headers });
        
        const resultUrl = data?.image_url || data?.url;
        if (!resultUrl) {
            // Coba lihat apakah ada pesan error di dalam respons
            const errorMessage = data?.message || 'API tidak mengembalikan URL gambar.';
            throw new Error(errorMessage);
        }

        // 3. Unduh gambar yang sudah di-upscale dari URL hasil
        const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer' });
        const finalBuffer = Buffer.from(imgRes.data);

        // 4. Kirim gambar hasil upscale ke pengguna
        await sock.sendMessage(remoteJid, {
            image: finalBuffer,
            caption: '*Done kak!*'
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 PicUpscaler Gagal:", error);
        
        let errorMessage = 'Terjadi kesalahan yang tidak diketahui.';
        if (error.response) {
            errorMessage = `API merespons dengan status ${error.response.status}.`;
        } else {
            errorMessage = error.message;
        }

        await sock.sendMessage(remoteJid, { text: `Eror kak: ${errorMessage}` }, { quoted: message });
    } finally {
        if (mediaPath && fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
        }
    }
}

if (rule.action && rule.action.features === 'generate_image_capcut') {
    try {
        const prompt = rule.action.content;
        
        // 1. Panggil API Anabot
        const apiUrl = `https://anabot.my.id/api/ai/textToImageCapcut?prompt=${encodeURIComponent(prompt)}&apikey=freeApikey`;
        const { data } = await axios.get(apiUrl);

        if (!data.success || !Array.isArray(data.data?.result) || data.data.result.length === 0) {
            throw new Error('API Capcut tidak mengembalikan hasil gambar yang valid.');
        }

        const imageUrls = data.data.result;
        console.log(`[CAPCUT] Berhasil mendapatkan ${imageUrls.length} gambar.`);

        // 2. Bangun "kartu" (cards) untuk carousel, persis seperti fitur 'pin'
        const cards = [];
        for (const [index, imageUrl] of imageUrls.entries()) {
            try {
                // Siapkan media (gambar) untuk setiap kartu
                const preparedImage = await prepareWAMessageMedia({ 
                    image: { url: imageUrl }
                }, { upload: sock.waUploadToServer });
                
                // Bangun setiap kartu secara manual
                cards.push({
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        title: `Hasil #${index + 1}`,
                        hasMediaAttachment: true,
                        ...preparedImage
                    }),
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: `_Geser untuk melihat variasi lainnya._`
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        buttons: [{
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "Lihat Resolusi Penuh",
                                url: imageUrl
                            })
                        }]
                    })
                });
            } catch (cardError) {
                console.error(`[CAPCUT CAROUSEL] Gagal memproses kartu untuk gambar: ${imageUrl}`, cardError);
            }
        }

        if (cards.length === 0) {
            throw new Error('Gagal menyiapkan kartu carousel. Mungkin gambar tidak dapat diakses.');
        }

        // 3. Bangun dan kirim pesan Carousel interaktif
        const interactiveMessage = await generateWAMessageFromContent(remoteJid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: { text: `*Berikut adalah ${cards.length} gambar hasil dari prompt "${prompt}"*` },
                        footer: { text: `Ditenagai oleh ${config.name_bot}` },
                        carouselMessage: { cards: cards }
                    })
                }
            }
        }, { userJid: sender, quoted: message });

        await sock.relayMessage(remoteJid, interactiveMessage.message, { messageId: interactiveMessage.key.id });

    } catch (error) {
        console.error("🚫 Capcut Image Gen Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Maaf, gagal membuat gambar.\n\n*Pesan Error:* ${error.message}` }, { quoted: message });
    }
}
      if (rule.action && rule.action.features === 'send_tiktok') {
    try {
        const video = rule.action.content;
        const caption = `🎬 *${video.title}*`;

        await sock.sendMessage(remoteJid, {
            video: { url: video.mp4 },
            caption: caption
        }, { quoted: message });

        await sock.sendMessage(remoteJid, {
            audio: { url: video.mp3 },
            mimetype: 'audio/mp4',
            ptt: false
        }, { quoted: message });

    } catch (err) {
        await sock.sendMessage(remoteJid, {
            text: `❌ Gagal mengirim video TikTok.\n\n${err.message || err}`
        }, { quoted: message });
    }

    resetActiveFitur(remoteJid, "tiktok");
}

if (rule.action && rule.action.features === 'image_to_prompt_sanka') {
    let mediaInfo = null;
    let mediaPath = null;
    try {
        mediaInfo = rule.action.source === 'direct'
            ? await downloadAndSaveMedia(message, sock, logger)
            : await downloadQuotedMedia(message);

        if (!mediaInfo || !mediaInfo.buffer) throw new Error('Gagal mengunduh gambar.');
        mediaPath = mediaInfo.filePath;

        // Upload ke ImgBB untuk mendapatkan URL
        const imageUrl = await uploadToImgBB(mediaInfo.buffer);
        
        // Panggil API Sanka
        const apiUrl = `https://www.sankavollerei.com/ai/image-to-prompt?apikey=planaai&imageUrl=${encodeURIComponent(imageUrl)}`;
        const response = await axios.get(apiUrl);

        const promptResult = response.data?.result?.translated_prompt_id;
        if (!promptResult) throw new Error('API tidak mengembalikan prompt yang valid.');

        const replyText = `*Berikut adalah deskripsi dari gambar Anda (versi Indonesia):*\n\n"${promptResult}"`;
        await sock.sendMessage(remoteJid, { text: replyText }, { quoted: message });

    } catch (error) {
        console.error("🚫 Image to Prompt (Sanka) Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal membuat prompt dari gambar.\n\n*Detail:* ${error.message}` }, { quoted: message });
    } finally {
        if (mediaPath && fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
    }
}

// FILE: lib/ai.js
// ... di dalam fungsi sendReply

// --- Eksekutor untuk Fitur ToUrl (dengan Tombol CTA_COPY) ---
if (rule.action && rule.action.features === 'upload_to_url_yupra_cta') {
    let mediaInfo = null;
    let mediaPath = null;
    try {
        // 1. Unduh media yang di-reply menggunakan fungsi helper Anda yang andal
        mediaInfo = await downloadQuotedMedia(message);
        if (!mediaInfo || !mediaInfo.buffer) {
            throw new Error('Gagal mengunduh file yang di-reply. Pastikan file dapat diakses dan tidak kadaluarsa.');
        }
        mediaPath = mediaInfo.filePath;
        const mediaBuffer = mediaInfo.buffer;

        if (mediaBuffer.length > 30 * 1024 * 1024) { // Batas 30MB
            throw new Error('File terlalu besar (maksimal 30MB).');
        }

        // 2. Tentukan nama file dari path yang sudah dibuat oleh downloadQuotedMedia
        const filename = path.basename(mediaPath);

        // 3. Upload file ke cdn.yupra.my.id
        console.log(`[TOURL] Mengunggah file: ${filename}`);
        const form = new FormData();
        form.append('files', mediaBuffer, { filename });
        const uploadResponse = await axios.post('https://cdn.yupra.my.id/upload', form, {
            headers: { ...form.getHeaders() },
            timeout: 120000
        });
        
        const result = uploadResponse.data;
        if (!result.success || !result.files?.[0]) {
            throw new Error('Upload ke server Yupra gagal.');
        }

        // ===================================================================
        // ---- PEMBUATAN TOMBOL CTA_COPY DIMULAI DARI SINI ----
        // ===================================================================
        
        // 4. Siapkan dan kirim pesan dengan tombol interaktif 'cta_copy'
        const file = result.files[0];
        const fileUrl = `https://cdn.yupra.my.id${file.url}`;

        const interactiveButton = [{
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
                display_text: "Salin URL",
                copy_code: fileUrl
            })
        }];

        // 5. Bangun pesan interaktif menggunakan proto, persis seperti plugin asli
        const buttonMsg = await generateWAMessageFromContent(remoteJid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: { text: `✅ *Upload Sukses!*\n\nKlik tombol di bawah ini untuk menyalin link.` },
                        footer: { text: "Link tanpa masa aktif." },
                        nativeFlowMessage: { buttons: interactiveButton }
                    })
                }
            }
        }, { userJid: sender, quoted: message });

        // 6. Kirim pesan yang sudah dibangun
        await sock.relayMessage(remoteJid, buttonMsg.message, { messageId: buttonMsg.key.id });

    } catch (error) {
        console.error("🚫 ToUrl (CTA_COPY) Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal mengunggah file.\n\n*Alasan:* ${error.message}` }, { quoted: message });
    } finally {
        // 7. Selalu hapus file sementara
        if (mediaPath && fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
        }
    }
}

if (rule.action && rule.action.features === 'rename_project_identity') {
    try {
        const { type, name: newName } = rule.action.content;

        // Tentukan nilai lama yang akan dicari berdasarkan tipe aksi
        const oldValue = (type === 'rename_bot') ? config.name_bot : config.owner_name;
        // Tentukan kunci mana di config.js yang akan diubah
        const configKeyToUpdate = (type === 'rename_bot') ? 'name_bot' : 'owner_name';

        console.log(`[RENAME] Memulai proses. Tipe: ${type}, Nilai Lama: "${oldValue}", Nilai Baru: "${newName}"`);
        
        // Path ke direktori utama proyek
        const projectRoot = path.resolve(__dirname, '..');
        
        let filesModifiedCount = 0;

        // Fungsi rekursif untuk memindai semua direktori
        const scanAndReplace = (dir) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                
                // Abaikan folder-folder berat dan berbahaya
                if (['node_modules', '.git', 'session'].includes(file)) {
                    continue;
                }
                
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                    scanAndReplace(fullPath); // Pindai sub-direktori
                } 
                // Hanya proses file .js dan .json
                else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.json'))) {
                    let fileContent = fs.readFileSync(fullPath, 'utf8');

                    // Cek apakah file ini mengandung nilai lama
                    if (fileContent.includes(oldValue)) {
                        // Buat Regex untuk mengganti semua kemunculan (case-insensitive)
                        const regex = new RegExp(oldValue.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
                        fileContent = fileContent.replace(regex, newName);
                        
                        // Khusus untuk config.js, ganti nilai variabelnya
                        if (file === 'config.js') {
                            const configRegex = new RegExp(`(${configKeyToUpdate}:\\s*['"\`]).*?(['"\`])`);
                            fileContent = fileContent.replace(configRegex, `$1${newName}$2`);
                        }

                        fs.writeFileSync(fullPath, fileContent, 'utf8');
                        console.log(`[RENAME] Mengubah file: ${fullPath}`);
                        filesModifiedCount++;
                    }
                }
            }
        };

        // Mulai pemindaian dari direktori utama
        scanAndReplace(projectRoot);
        
        // Update nilai di objek config yang sedang berjalan
        config[configKeyToUpdate] = newName;
        
        await sock.sendMessage(remoteJid, {
            text: `✅ Proses selesai! Sebanyak *${filesModifiedCount} file* telah diperbarui. Bot akan segera restart dengan identitas baru.`
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Rename Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal melakukan penggantian nama.\n\n*Alasan:* ${error.message}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'anime_search') {
    try {
        const query = rule.action.content;
        const apiUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`;

        // Menggunakan axios untuk memanggil API secara langsung
        const response = await axios.get(apiUrl);

        if (!response.data || !response.data.data || response.data.data.length === 0) {
            throw new Error(`Tidak ditemukan hasil untuk "${query}". Coba judul yang lebih spesifik.`);
        }
        
        // Ambil hasil pertama dari array 'data'
        const anime = response.data.data[0];

        let synopsis = anime.synopsis || "Sinopsis tidak tersedia.";
        if (synopsis.length > 400) {
            synopsis = synopsis.substring(0, 400) + '...';
        }

        const replyText = `🌸 *Judul:* ${anime.title_japanese} (${anime.title})\n` +
                          `🎬 *Episode:* ${anime.episodes || 'N/A'}\n` +
                          `⭐ *Skor:* ${anime.score || 'N/A'} (oleh ${anime.scored_by?.toLocaleString() || 0} pengguna)\n` +
                          `🏅 *Peringkat:* #${anime.rank || 'N/A'}\n` +
                          `📅 *Status:* ${anime.status || 'N/A'}\n\n` +
                          `*Sinopsis:*\n${synopsis}\n\n` +
                          `🔗 *URL:* ${anime.url}`;

        // Kirim gambar dengan resolusi lebih baik jika ada
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;

        await sock.sendMessage(remoteJid, { 
            image: { url: imageUrl },
            caption: replyText
        }, { quoted: message });

    } catch (error) {
        console.error("🚫 Pencarian Anime Gagal:", error);
        
        // Error handling yang lebih baik untuk axios
        const errorMessage = error.response ? `API merespons dengan status ${error.response.status}` : error.message;

        await sock.sendMessage(remoteJid, { text: `Maaf, terjadi kesalahan saat mencari anime.\n\n*Detail Error:* ${errorMessage}` }, { quoted: message });
    }
}

if (rule.action && rule.action.features === 'test_all_buttons') {
    try {
        // --- TES 1: Template Button (Tombol Biasa) ---
        const templateButtons = [
            { index: 1, quickReplyButton: { displayText: 'Tombol Cepat 1', id: '.limit' } },
            { index: 2, urlButton: { displayText: 'Kunjungi Website', url: 'https://autoresbot.com' } },
            { index: 3, callButton: { displayText: 'Hubungi Owner', phoneNumber: `+${config.owner_number}` } }
        ];

        await sock.sendMessage(remoteJid, {
            text: "Ini adalah *Template Button*.\n\n- Tombol Cepat: Mengirim teks (ID) kembali ke bot.\n- Tombol URL: Membuka link di browser.\n- Tombol Panggilan: Memulai panggilan telepon.",
            footer: 'Tes Tombol Biasa',
            templateButtons: templateButtons
        }, { quoted: message });

        await new Promise(resolve => setTimeout(resolve, 1000)); // Jeda

        // --- TES 2: Native Flow Button (Tombol List) ---
        const nativeFlowButtons = [
            {
                buttonId: 'list_menu_test',
                buttonText: { displayText: '📜 Buka Menu List' },
                type: 4,
                nativeFlowInfo: {
                    name: 'single_select',
                    paramsJson: JSON.stringify({
                        title: 'PILIH OPSI DARI LIST',
                        sections: [
                            {
                                title: 'Bagian Fitur AI',
                                rows: [
                                    { title: 'Tanya AI Sesuatu', description: 'Mulai percakapan dengan Gemini', id: 'ai ' },
                                    { title: 'Buat Gambar (Imagine)', description: 'Generate gambar dari teks', id: 'imagine ' }
                                ]
                            },
                            {
                                title: 'Bagian Utilitas',
                                rows: [
                                    { title: 'Cek Limit Harian', description: 'Lihat sisa limit Anda', id: '.limit' },
                                    { title: 'Buat Stiker', description: 'Kirim gambar dengan caption .s', id: '.s' }
                                ]
                            }
                        ]
                    })
                }
            }
        ];

        await sock.sendMessage(remoteJid, {
            text: "Ini adalah *Native Flow Button* (Tipe List).\n\nSaat diklik, ia akan membuka sebuah daftar pilihan interaktif. Ketika Anda memilih salah satu, ID-nya akan dikirim kembali ke bot.",
            footer: 'Tes Tombol List',
            buttons: nativeFlowButtons,
            headerType: 1
        }, { quoted: message });

        await new Promise(resolve => setTimeout(resolve, 1000)); // Jeda

        // --- TES 3: Carousel Button (Geser) ---
        const carouselCards = [
            {
                header: { media: { imageMessage: { url: 'https://i.ibb.co/Gtnw05n/image.png' } } },
                body: { text: 'Kartu Carousel Pertama' },
                footer: { text: 'Geser untuk melihat lainnya' },
                id: '.info 1'
            },
            {
                header: { media: { imageMessage: { url: 'https://i.ibb.co/Gtnw05n/image.png' } } },
                body: { text: 'Kartu Carousel Kedua' },
                footer: { text: 'Klik untuk memilih' },
                id: '.info 2'
            }
        ];
        
        const carouselParamsJson = JSON.stringify({ cards: carouselCards });
        
        const carouselTemplateButtons = [{
            index: 1,
            nativeFlowButton: {
                buttonText: 'Lihat Carousel',
                paramsJson: carouselParamsJson,
                messageVersion: 1,
                flowName: 'carousel'
            }
        }];

        await sock.sendMessage(remoteJid, {
            text: "Ini adalah *Carousel Button* (via Template Button).\n\nSaat diklik, ia akan membuka tampilan kartu yang bisa digeser ke samping.",
            footer: 'Tes Tombol Carousel',
            templateButtons: carouselTemplateButtons,
            headerType: 1
        }, { quoted: message });
        
    } catch (error) {
        console.error("🚫 Tes Tombol Gagal:", error);
        await sock.sendMessage(remoteJid, { text: `Gagal menjalankan tes tombol.\n\n*Alasan:* ${error.message}` }, { quoted: message });
    }
}


if (rule.action && rule.action.content && rule.action.features === 'pin') {
    try {
        const keyword = rule.action.content.trim();
        
        // 1. Panggil API Sanka Vollerei
        const apiUrl = `https://www.sankavollerei.com/search/pinterest?apikey=planaai&q=${encodeURIComponent(keyword)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
            throw new Error('❌ Gambar tidak ditemukan di Pinterest.');
        }

        // Ambil hingga 20 hasil untuk dimasukkan ke dalam list
        const results = data.result.slice(0, 20);

        // 2. Bangun baris-baris (rows) untuk list secara dinamis
        const rows = results.map((item, index) => ({
            title: `Gambar #${index + 1}`,
            description: `Klik untuk melihat gambar resolusi tinggi`,
            // Perintah alami yang akan dikirim saat item dipilih
            id: `getimage ${item.image_large_url}` 
        }));

        // 3. Siapkan parameter JSON untuk nativeFlow
        const paramsJson = JSON.stringify({
            title: `🖼️ HASIL PENCARIAN UNTUK "${keyword.toUpperCase()}"`,
            sections: [
                {
                    title: 'Pilih salah satu gambar dari daftar di bawah',
                    rows: rows
                }
            ]
        });

        // 4. Bangun struktur Tombol Native Flow yang akan memicu list
        const listButton = [{
            buttonId: 'pinterest_search_list',
            buttonText: { displayText: '📜 Buka Daftar Gambar' },
            type: 4,
            nativeFlowInfo: {
                name: 'single_select',
                paramsJson: paramsJson
            }
        }];

        // 5. Kirim pesan dengan tombol list
        await sock.sendMessage(remoteJid, {
            text: `*Hasil Pencarian untuk "${keyword}"*\n\nKlik tombol di bawah untuk membuka daftar gambar. Pilih salah satu untuk mendapatkan gambar resolusi penuh.`,
            footer: `Menampilkan ${results.length} gambar teratas.`,
            buttons: listButton,
            headerType: 1
        }, { quoted: message });

    } catch (e) {
        await sock.sendMessage(remoteJid, {
            text: e.message || config.error.IMAGE_ERROR
        }, { quoted: message });
    }

    resetActiveFitur(remoteJid, "pin");
}

        if (rule.action && rule.action.content && rule.action.features === 'detect_link') {
            const content = rule.action.content;

            const sendMessage = async (text, options = {}) => {
                await sock.sendMessage(remoteJid, { text }, options);
            };

            const handleError = async (error) => {
                const errorText = error || 'Hai Kak, sepertinya link yang kamu bagikan tidak valid. Coba cek lagi, ya!';
                return await sendMessage(errorText, { quoted: message });
            };

            if (content.includes('whatsapp.com/channel')) {
                const inviteCode = content;
                try {
                    const data = await api.get('/api/stalker/whatsapp-group', { url: inviteCode });
                    const groupName = data.groupName;
                    const totalFollower = data.channelDesc.match(/\d+/g) || [];
                    const fullText = `Hai Kak, berikut informasi channel yang kamu kirimkan. Channel ini bernama *${groupName}* dengan memiliki *${totalFollower}* follower.`;
                    await sendMessage(fullText);
                } catch (error) {
                    await handleError(error);
                }
            } else if (content.includes('chat.whatsapp.com')) {
                const inviteCode = content.split('/').pop();
                try {
                    const res = await sock.query({
                        tag: "iq",
                        attrs: { type: "get", xmlns: "w:g2", to: "@g.us" },
                        content: [{ tag: "invite", attrs: { code: inviteCode } }]
                    });

                    if (res?.content?.[0]?.attrs) {
                        const { attrs } = res.content[0];
                        const nameGroup = attrs.subject || "undefined";
                        const descGroup = attrs.s_t
                            ? moment(attrs.s_t * 1000).tz("Asia/Jakarta").format("DD-MM-YYYY, HH:mm:ss")
                            : "undefined";
                        const ownerCreated = attrs.creator ? "@" + attrs.creator.split("@")[0] : "undefined";
                        const dataCreated = attrs.creation
                            ? moment(attrs.creation * 1000).tz("Asia/Jakarta").format("DD-MM-YYYY, HH:mm:ss")
                            : "undefined";
                        const sizeMember = attrs.size || "undefined";
                        const idGroup = attrs.id || "undefined";

                        const fullText = `Hai Kak, berikut informasi grup yang kamu kirimkan. Grup ini bernama *${nameGroup}* dengan total *${sizeMember}* anggota. \n\nInformasi lengkapnya:\n - ID Grup: ${idGroup}\n - Dibuat pada: ${dataCreated}\n - Pembuat Grup: *${ownerCreated}*`;
                        await sendMessage(fullText);
                    } else {
                        await handleError(error);
                    }
                } catch (error) {
                    await handleError(error);
                }
            } else if (content.includes('tiktok.com')) {
                try {
                    let res = await TIKTOK(content);
                    if (res.type === 'video') {
                        await sock.sendMessage(remoteJid, { video: { url: res.data.no_watermark }, caption: res.data.title });
                    } else if (res.type === 'slide') {
                        const dataImage = res.data;
                        for (let i = 0; i < Math.min(dataImage.length, 8); i++) {
                            await sock.sendMessage(remoteJid, { image: { url: dataImage[i] } });
                        }
                    }
                } catch (error) {
                    const fullText = 'Hai Kak, sepertinya link tiktok yang kamu bagikan tidak bisa saya download. Coba cek lagi, ya!';
                    await sendMessage(fullText, { quoted: message });
                }
            } else if (content.includes('facebook.com')) {
                let res = await FACEBOOK(content);
                if(res && res.message) {
                    throw new Error(res.message);
                }else {
                    await sock.sendMessage(remoteJid, { video: { url: res }, caption: '' });
                }
            } else if (content.includes('instagram.com')) {
                try {
                    let res = await IG(content); // dapetin URL-nya
                
                    if (content.includes('video')) {
                        await sock.sendMessage(remoteJid, {
                            video: { url: res },
                            caption: 'ini kak videonya'
                        });
                    } else if (content.includes('gambar')) {
                        await sock.sendMessage(remoteJid, {
                            image: { url: res },
                            caption: 'ini kak gambarnya'
                        });
                    } else {
                        await sock.sendMessage(remoteJid, {
                            video: { url: res },
                            caption: 'ini kak videonya'
                        });
                    }
                    return;
                    
                } catch (error) {
                    await handleError(error);
                }
            } else {
                const fullText = 'Hai Kak, sepertinya link yang kamu bagikan tidak dapat di proses sementara waktu. Link yang dapat saya proses berupa link grup whatsapp, link saluran whatsapp dan link tiktok.';
                await sendMessage(fullText, { quoted: message });
            }

            resetActiveFitur(remoteJid, "download");

        }

    } catch (error) {
        const throw_error = `${config.error.THROW} \n\n_*${error}*_`;
        resetActiveFitur(remoteJid, "play");
        resetActiveFitur(remoteJid, "pin");
        resetActiveFitur(remoteJid, "download");
        await sock.sendMessage(remoteJid, { text: throw_error }, { quoted: message });
    }
};

async function handleMessageLocal(content, sock, sender, remoteJid, messageType, session, message, pushName, isQuoted) {
    
    const symbolsToRemove = ['.', '#', '!'];
    const regex = new RegExp(`^[${symbolsToRemove.join('')}]`, 'g');
    const lowerCaseMessage = content?.toLowerCase?.().trim();
    const command = lowerCaseMessage.split(' ')[0];
    const isOwner = (remoteJid) => remoteJid === `${config.owner_number}@s.whatsapp.net`;
    const user = getUser(sender)
    const userLimit = checkLimit(user);

    if(!userLimit && !isOwner(sender)) {
        return {
            status: true,
            message_type: 'text',
            reply_text: config.notification.limit
        };
    }

    let info_apikey = '';
    try {
        const data = await api.get('/check_apikey');
        info_apikey = `Apikey Valid \n\nLimit Kamu : ${data.limit_apikey} dan aktif hingga ${data.limit_key_tgl}`
    } catch (error) {
        info_apikey = error.message;
    }
    
    const commandResponses = {
        reset: () => {
            resetSession(sender);
            if (global.conversationHistories && global.conversationHistories[sender]) {
                delete global.conversationHistories[sender];
            }
            return {
                status: true,
                message_type: 'text',
                reply_text: config.notification.reset,
            };
        },
        limit: () => ({
            status: true,
            message_type: 'text',
            reply_text: `_Hai kak, sisa limit harian anda adalah_ ${userLimit}`,
        }),
        apikey: () => ({
            status: true,
            message_type: 'text',
            reply_text: info_apikey,
        }),
        ig: () => ({
            status: true,
            message_type: 'text',
            reply_text: config.notification.ig,
        }),
        tt: () => ({
            status: true,
            message_type: 'text',
            reply_text: config.notification.tt,
        }),
        fb: () => ({
            status: true,
            message_type: 'text',
            reply_text: config.notification.fb,
        }),
        info: () => {
            const info = `*Informasi Script* \n\nName Script: Resbot Ai\nOwner: autoresbot.com\nVersion: ${config.version}\n\n_Script ini tersedia secara gratis, kamu bisa mendownloadnya di_ https://autoresbot.com/download\n\nSaluran Resmi : https://www.whatsapp.com/channel/0029VabMgUy9MF99bWrYja2Q`;
            return {
                status: true,
                message_type: 'text',
                reply_text: info,
            };
        },
        addprem: () => ({
            status: true,
            message_type: 'text',
            reply_text: '_Format Penggunaan:_ *addprem @tag/nomor hari*\n\n_Contoh penggunaan:_ *addprem 6285246154386 30*',
        }),
        delprem: () => ({
            status: true,
            message_type: 'text',
            reply_text: '_Format Penggunaan:_ *delprem nomor*\n\n_Contoh penggunaan:_ *delprem 6285246154386*',
        }),
        editprem: () => ({
            status: true,
            message_type: 'text',
            reply_text: '_Format Penggunaan:_ *editprem nomor hari*\n\n_Contoh penggunaan:_ *editprem 6285246154386 15*',
        }),
        listprem: () => ({
            status: true,
            message_type: 'text',
            reply_text: getUserPremium(),
        }),
        listusers: () => ({
            status: true,
            message_type: 'text',
            reply_text: getAllUsers(),
        }),
    };
    
    // getUserPremium, getAllUsers
    
    const response = commandResponses[lowerCaseMessage];
    if (response) {
        return response();
    }
    
    // addUser, editUser(remoteJid, 5);, deleteUser(remoteJid), getUser, isPremiumUser, checkLimit,reduceLimit
    

    const sendResponse = (text) => ({
        status: true,
        message_type: 'text',
        reply_text: text,
    });
    
    const handleAddPrem = (args) => {
        console.log('args :', args); // contoh: [ 'addprem', '@6285124002196', '10' ]
    
        let rawNumber = args[1];
        const day = args[2];
    
        if (!rawNumber || !day) {
            return sendResponse('Format pesan salah. Gunakan: addprem nomor hari');
        }
    
        // Bersihkan tag jika diawali dengan '@'
        if (rawNumber.startsWith('@')) {
            rawNumber = rawNumber.slice(1);
        }
    
        // Validasi: pastikan hanya angka dan panjang minimal (misal, 10 digit)
        const isValidPhone = /^[0-9]{10,15}$/.test(rawNumber);
        if (!isValidPhone) {
            return sendResponse('Nomor tidak valid. Pastikan hanya angka tanpa spasi/simbol.');
        }
    
        const number = `${rawNumber}@s.whatsapp.net`;
    
        addUser(number, day);
        return sendResponse(`Berhasil! Nomor ${number} kini telah menjadi pengguna premium selama ${day} hari.`);
    };
    
    const handleDelPrem = (args) => {
        let rawNumber = args[1];
    
        if (!rawNumber) {
            return sendResponse('Format pesan salah. Gunakan: delprem nomor');
        }
    
        if (rawNumber.startsWith('@')) {
            rawNumber = rawNumber.slice(1);
        }
    
        const isValidPhone = /^[0-9]{10,15}$/.test(rawNumber);
        if (!isValidPhone) {
            return sendResponse('Nomor tidak valid. Pastikan hanya angka tanpa spasi/simbol.');
        }
    
        const number = `${rawNumber}@s.whatsapp.net`;
    
        deleteUser(number);
        return sendResponse(`Berhasil! Nomor ${number} telah dihapus dari list premium.`);
    };
    
    
    const handleEditPrem = (args) => {
        let rawNumber = args[1];
        const day = args[2];
    
        if (!rawNumber || !day) {
            return sendResponse('Format pesan salah. Gunakan: editprem nomor hari');
        }
    
        if (rawNumber.startsWith('@')) {
            rawNumber = rawNumber.slice(1);
        }
    
        const isValidPhone = /^[0-9]{10,15}$/.test(rawNumber);
        if (!isValidPhone) {
            return sendResponse('Nomor tidak valid. Pastikan hanya angka tanpa spasi/simbol.');
        }
    
        const number = `${rawNumber}@s.whatsapp.net`;
    
        editUser(number, day);
        return sendResponse(`Berhasil! Nomor ${number} kini telah diubah menjadi pengguna premium selama ${day} hari.`);
    };
    
    
    const handleResetData = () => {
        resetUsersJson();
        return sendResponse('Berhasil! Seluruh data users telah direset.');
    };
    
    if (lowerCaseMessage.startsWith('addprem')) {
        if (!isOwner(sender)) {
            return sendResponse(config.notification.only_owner);
        }
        const args = lowerCaseMessage.split(' ');
        return handleAddPrem(args);
    }
    
    if (lowerCaseMessage.startsWith('delprem')) {
        if (!isOwner(sender)) {
            return sendResponse(config.notification.only_owner);
        }
        const args = lowerCaseMessage.split(' ');
        return handleDelPrem(args);
    }
    
    if (lowerCaseMessage.startsWith('editprem')) {
        if (!isOwner(sender)) {
            return sendResponse(config.notification.only_owner);
        }
        const args = lowerCaseMessage.split(' ');
        return handleEditPrem(args);
    }
    
    if (lowerCaseMessage.startsWith('resetdata')) {
        if (!isOwner(sender)) {
            return sendResponse(config.notification.only_owner);
        }
        return handleResetData();
    }

const backupIntent = ['backup', 'ambil sc', 'backupsc', 'get script', 'script', 'base'];
if (backupIntent.some(intent => lowerCaseMessage.includes(intent))) {
    
    if (!isOwner(sender)) {
        return null; 
    }
    
    // Cek apakah fitur sudah aktif untuk mencegah spam
    const active = getActiveFitur(sender, "backup");
    if (active) {
        return {
            status: true,
            message_type: 'text',
            reply_text: config.notification.waiting,
        };
    }
    setActiveFitur(sender, "backup");

    // Langsung siapkan action untuk dieksekusi
    return {
        status: true,
        message_type: 'text',
        reply_text: `📦 Siap! Sedang mengumpulkan semua file dan membuat arsip .zip untuk Anda...`,
        action: {
            features: 'execute_backup_direct'
        }
    };
}

                   const stickerlyKeywords = ['stickerly', 'stikerly', 'sticker pack', 'stiker'];
if (stickerlyKeywords.some(keyword => lowerCaseMessage.includes(keyword))) {
    const keyword_sticker = lowerCaseMessage
        .replace(/stickerly|stikerly|stiker|sticker|pack|ly|sticker pack/g, '')
        .trim();

    if (!keyword_sticker || keyword_sticker.length < 2) {
        return {
            status: true,
            message_type: 'text',
            reply_text: `❌ Masukkan nama stiker yang ingin dicari dari Sticker.ly\n\nContoh: *stickerly kucing lucu*`
        };
    }

    const active = getActiveFitur(sender, "stickerly");
    if (active) {
        return {
            status: true,
            message_type: 'text',
            reply_text: config.notification.waiting,
        };
    }

    setActiveFitur(sender, "stickerly");
    reduceLimit(sender);

    try {
        const axios = require('axios');
        const { data } = await axios.get(`https://api.nekoo.qzz.io/search/stickerly?q=${encodeURIComponent(keyword_sticker)}`);

        if (!data.status || !data.result || data.result.length === 0) {
            throw new Error('Sticker tidak ditemukan.');
        }

        const result = data.result.slice(0, 5); // maksimal 5 hasil
        let pesan = `🧩 *Hasil Sticker.ly untuk:* _${keyword_sticker}_\n\n`;

        for (let i = 0; i < result.length; i++) {
            const s = result[i];
            pesan += `🧷 *${s.name}*\n👤 Author: ${s.author}\n📦 Total Stiker: ${s.stickerCount}\n🔗 Link: ${s.url}\n\n`;
        }

        return {
            status: true,
            message_type: 'image',
            reply_text: pesan.trim(),
            image_url: result[0].thumbnailUrl
        };

    } catch (e) {
        return {
            status: true,
            message_type: 'text',
            reply_text: `❌ Gagal mencari sticker dari Sticker.ly: ${e.message || e}`
        };
    }
}

const gantiFileTriggers = ['gantifile', 'ganti file', 'replacefile', 'updatefile', 'file'];
const gantiFileTriggerWord = gantiFileTriggers.find(trigger => lowerCaseMessage.startsWith(trigger));

if (gantiFileTriggerWord) {
    // Keamanan #1: Hanya Owner
    if (!isOwner(sender)) {
        return { status: true, message_type: 'text', reply_text: '❌ Perintah ini hanya bisa diakses oleh Owner Bot.' };
    }

    // Validasi #1: Harus merupakan reply
    if (!isQuoted) {
        return { status: true, message_type: 'text', reply_text: 'Untuk menggunakan fitur ini, Anda harus me-reply file dokumen .js yang berisi kode baru.' };
    }

    // Ambil path file dari perintah
    const filePathToReplace = content.substring(gantiFileTriggerWord.length).trim();
    if (!filePathToReplace) {
        return { status: true, message_type: 'text', reply_text: 'Format salah. Contoh: *ganti file lib/ai.js*' };
    }
    
    // Keamanan #2: Cegah Path Traversal
    if (filePathToReplace.includes('..')) {
        return { status: true, message_type: 'text', reply_text: '❌ Path tidak valid. Tidak boleh mengandung "..".' };
    }
    
    // Validasi #2: Pesan yang di-reply harus dokumen .js
    const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
    if (!quotedMessage.documentMessage || !quotedMessage.documentMessage.fileName.endsWith('.js')) {
        return { status: true, message_type: 'text', reply_text: '❌ Anda harus me-reply sebuah file dokumen yang berakhiran .js.' };
    }

    // Pola Action: Kirim tugas ke sendReply
    return {
        status: true,
        message_type: 'text',
        reply_text: `📥 Dokumen diterima. Mencoba memperbarui file *${filePathToReplace}*...`,
        action: {
            features: 'replace_file_from_document',
            content: { targetPath: filePathToReplace }
        }
    };
}


const searchImageIntent = ['pin', 'gambar', 'image', 'foto', 'cari gambar'];
// Kita gunakan .includes() untuk deteksi yang lebih fleksibel
const isSearchImageRequest = searchImageIntent.some(intent => lowerCaseMessage.includes(intent));

if (isSearchImageRequest) {
    const keyword_image = lowerCaseMessage
        .replace(/carikan|cari|kirimkan|kirim|bisa|foto|tolong|berikan|mohon|pin|gambar|image/g, '')
        .trim();

    // Validasi: Pastikan ada keyword setelah dibersihkan
    if (!keyword_image) {
        // Jika tidak ada keyword, jangan proses lebih lanjut. 
        // Mungkin ini hanya percakapan biasa yang mengandung kata "gambar".
        // Kita return null agar bisa di-handle oleh AI eksternal jika perlu.
        return null; 
    }

    // Cek apakah fitur sudah aktif untuk mencegah spam
    const active = getActiveFitur(sender, "pin");
    if (active) {
        return {
            status: true,
            message_type: 'text',
            reply_text: config.notification.waiting,
        };
    }
    setActiveFitur(sender, "pin");
    reduceLimit(sender);

    // Siapkan action untuk dieksekusi oleh sendReply
    return {
        status: true,
        message_type: 'text',
        reply_text: `🔎 Siap! Sedang mencari gambar *${keyword_image}* di Pinterest...`,
        action: {
            content: keyword_image,
            features: 'pin' // Eksekutor 'pin' di sendReply akan menangani ini
        }
    };
}

const adminMgmtIntent = ['list admin', 'daftar admin', 'deladmin', 'hapus admin', 'delete admin'];
const isAdminMgmtRequest = adminMgmtIntent.some(intent => lowerCaseMessage.startsWith(intent));

if (isAdminMgmtRequest) {
    // Keamanan: Hanya Owner
    if (!isOwner(sender)) {
        return { status: true, 
        message_type: 'text', 
        reply_text: 'Fitur ini khusus untuk Owner Bot.' };
    }

    // Ekstrak ID jika ada (untuk perintah 'hapus admin 123')
    const targetId = content.match(/\d+$/)?.[0];

    // Jika ada ID, langsung jalankan aksi penghapusan
    if (targetId) {
        return {
            status: true,
            message_type: 'text',
            reply_text: `⚙️ Memproses penghapusan admin dengan ID *${targetId}*...`,
            action: {
                features: 'ptero_delete_admin',
                content: targetId
            }
        };
    }
    
    // Jika tidak ada ID, berarti perintahnya adalah untuk menampilkan daftar
    return {
        status: true,
        message_type: 'text',
        reply_text: '🔎 Mengambil daftar admin dari panel...',
        action: {
            features: 'ptero_list_admins'
        }
    };
}

const createServerIntent = ['buat server', 'buatin server', 'create server'];
const isCreateServerRequest = createServerIntent.some(intent => lowerCaseMessage.startsWith(intent));

if (isCreateServerRequest) {
    // Keamanan: Hanya Owner yang bisa melanjutkan
    if (!isOwner(sender)) {
        return { status: true, message_type: 'text', reply_text: 'Fitur ini khusus untuk Owner Bot.' };
    }

    const groupDbPath = './database/ptero_groups.json';
    const allowedGroups = fs.existsSync(groupDbPath) ? JSON.parse(fs.readFileSync(groupDbPath)) : [];
    if (!allowedGroups.includes(remoteJid)) {
        return { status: true, message_type: 'text', reply_text: '*[ System Notice ]* Grup ini tidak memiliki izin untuk menggunakan fitur ini.' };
    }
    
    // 1. Ekstrak argumen: <ram>, <username>, <target>
    const argsText = content.replace(/buat server|buatin server/gi, '').trim();
    const [ram, username] = argsText.split(',').map(v => v.trim());
    const targetUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || message.message?.extendedTextMessage?.contextInfo?.participant;

    if (!ram || !username || !targetUser) {
        return { 
            status: true, 
            message_type: 'text', 
            reply_text: 'Format salah!\nContoh: *buat server 1gb, usernamebaru @tagtarget*'
        };
    }
    
    // 2. Siapkan action untuk dieksekusi
    return {
        status: true,
        message_type: 'text',
        reply_text: `⚙️ Memproses permintaan pembuatan server *${ram}* untuk *${username}*...`,
        action: {
            features: 'ptero_create_server_v2', // Nama fitur baru yang lebih canggih
            content: { 
                ram: ram.toLowerCase().replace('gb',''), 
                username: username.toLowerCase(), 
                targetJid: targetUser 
            }
        }
    };
}

const createAdminIntent = ['cadmin', 'buat admin', 'create admin', 'adp'];
const isCreateAdminRequest = createAdminIntent.some(intent => lowerCaseMessage.includes(intent));

if (isCreateAdminRequest) {
    // Keamanan: Hanya Owner
    if (!isOwner(sender)) {
        return { status: true, message_type: 'text', reply_text: 'Fitur ini khusus untuk Owner Bot.' };
    }

    // 1. Tentukan target (siapa yang akan dibuatkan akun)
    // Prioritaskan tag/mention, jika tidak ada, gunakan target dari reply
    const targetUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || message.message?.extendedTextMessage?.contextInfo?.participant;

    if (!targetUser) {
        return { 
            status: true, 
            message_type: 'text', 
            reply_text: 'Untuk membuat akun, Anda harus me-reply pesan pengguna atau men-tag-nya.\n\nContoh:\n*buatkan admin <username>* (sambil me-reply)\n*buatkan admin <username> @tagorang*'
        };
    }

    // 2. Ekstrak username dari sisa pesan
    // Bersihkan semua kemungkinan kata pemicu untuk mendapatkan username
    const username = lowerCaseMessage
        .replace(/cadmin|buat admin|create admin|adp/g, '')
        .replace(/@\d+/g, '') // Hapus tag angka
        .trim();

    if (!username) {
        return { 
            status: true, 
            message_type: 'text', 
            reply_text: 'Format salah. Anda lupa memasukkan username.\n\nContoh: *buatkan admin usernamebaru*'
        };
    }
    
    // 3. Siapkan action untuk dieksekusi
    return {
        status: true,
        message_type: 'text',
        reply_text: `⚙️ Memproses permintaan pembuatan akun admin *${username}* untuk @${targetUser.split('@')[0]}...`,
        action: {
            features: 'ptero_create_admin',
            content: { 
                username: username.toLowerCase(), 
                targetJid: targetUser 
            }
        }
    };
}


const ssTriggers = ['ss web', 'screenshot', 'ss', 'web', 'website'];
const ssRequested = ssTriggers.some(keyword => lowerCaseMessage.startsWith(keyword));

if (ssRequested) {
    const args = lowerCaseMessage.split(' ').slice(1); // ambil setelah trigger
    const url = args[0];

    if (!url) {
        return {
            status: true,
            message_type: 'text',
            reply_text: '❌ Contoh penggunaan: ssweb https://google.com'
        };
    }

    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: `🔄 Mengambil screenshot dari: ${url}`,
        action: {
            content: { url },
            features: 'ssweb'
        }
    };
}

// --- Fitur Save Website to ZIP ---

// Definisikan kata kunci pemicu yang fleksibel
const savewebTriggers = ['saveweb', 'simpan web', 'archive web', 'web', 'zip'];
const savewebTriggerWord = savewebTriggers.find(trigger => lowerCaseMessage.startsWith(trigger));

if (savewebTriggerWord) {
    // Ambil URL dari sisa pesan
    const urlToSave = content.substring(savewebTriggerWord.length).trim();

    // Validasi sederhana untuk URL
    if (!urlToSave.startsWith('http')) {
        return { status: true, message_type: 'text', reply_text: 'Masukkan URL website yang valid. Contoh: *simpan web https://google.com*' };
    }
    
    reduceLimit(sender); // Kurangi limit pengguna
    
    // Kembalikan action untuk dieksekusi oleh sendReply
    return {
        status: true,
        message_type: 'text',
        reply_text: `📥 Oke, saya akan coba mengarsipkan seluruh konten dari *${urlToSave}* menjadi file .zip. Ini mungkin memakan waktu cukup lama tergantung ukuran website...`,
        action: {
            features: 'save_web_to_zip',
            content: urlToSave
        }
    };
}

const setConfigIntent = ['set config', 'ubah config', 'ganti config', 'setel', 'ubah', 'ganti'];
const matchedSetConfigIntent = setConfigIntent.find(intent => lowerCaseMessage.startsWith(intent));

if (matchedSetConfigIntent) {
    if (!isOwner(sender)) {
        return { status: true, message_type: 'text', reply_text: '❌ Perintah ini hanya untuk Owner Bot.' };
    }

    // ---- KAMUS ALIAS (Jembatan antara bahasa manusia dan nama variabel) ----
    const configAliases = {
        'nama bot': 'name_bot',
        'bot name': 'name_bot',
        'nama owner': 'owner_name',
        'owner name': 'owner_name',
        'nomor owner': 'owner_number',
        'no owner': 'owner_number',
        'nomor bot': 'phone_number_bot',
        'no bot': 'phone_number_bot',
        'website owner': 'owner_website',
        'web owner': 'owner_website',
        'pesan limit': 'limit_message',
        'pesan tunggu': 'waiting_message',
        // Tambahkan alias lain di sini sesuai kebutuhan
    };

    const argsText = content.substring(matchedSetConfigIntent.length).trim();
    const match = argsText.match(/(.*?)\s+(?:to|menjadi|ke|=)\s+(.*)/i);

    if (!match) {
        return { status: true, message_type: 'text', reply_text: 'Format salah. Gunakan:\n*ganti <apa> menjadi <nilai baru>*\n\nContoh:\n*ganti nama bot menjadi Jarvis*' };
    }

    let keyNatural = match[1].trim().toLowerCase(); // e.g., 'website owner'
    const newValue = match[2].trim();

    // Terjemahkan bahasa alami ke kunci config yang sebenarnya
    const keyToUpdate = configAliases[keyNatural];

    if (!keyToUpdate) {
        // Jika tidak ada di alias, coba cari langsung di config (untuk kunci yang tidak umum)
        if (Object.keys(config).includes(keyNatural)) {
            keyToUpdate = keyNatural;
        } else {
            return { status: true, message_type: 'text', reply_text: `❌ Saya tidak mengerti apa itu *'${keyNatural}'*. Pastikan kata kuncinya benar (misal: 'nama bot', 'no owner', dll).` };
        }
    }
    
    // Keamanan: Pastikan kunci yang akan diubah ada di dalam config.js
    if (!Object.keys(config).includes(keyToUpdate)) {
        return { status: true, message_type: 'text', reply_text: `❌ Kunci internal *'${keyToUpdate}'* tidak ditemukan di config.js.` };
    }
    
    const oldValue = config[keyToUpdate];

    return {
        status: true,
        message_type: 'text',
        reply_text: `✅ Perintah diterima!\nMengganti *${keyNatural}* dari *"${oldValue}"* menjadi *"${newValue}"*...\nBot akan restart setelah selesai.`,
        action: {
            features: 'set_global_config',
            content: {
                key: keyToUpdate,
                oldValue: String(oldValue),
                newValue: newValue
            }
        }
    };
}

const hitamTriggers = ['hitamkan', 'efek hitam', 'filter hitam', 'ireng', 'hitam'];
const containsHitamTrigger = hitamTriggers.some(word => lowerCaseMessage.includes(word));

// Cek skenario: kirim langsung dengan caption atau reply
const isDirectHitam = messageType === 'imageMessage' && containsHitamTrigger;
const isRepliedHitam = isQuoted && isQuoted.imageMessage && containsHitamTrigger;

if (isDirectHitam || isRepliedHitam) {
    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: '🎨 Menerapkan filter hitam pada gambar...',
        action: {
            features: 'filter_hitam',
            source: isDirectHitam ? 'direct' : 'quoted'
        }
    };
}

const im2promptTriggers = ['jadikan prompt', 'deskripsikan gambar', 'ini gambar apa', 'image to prompt', 'apa promptnya'];
const containsIm2PromptTrigger = im2promptTriggers.some(word => lowerCaseMessage.includes(word));

const isDirectPromptify = messageType === 'imageMessage' && containsIm2PromptTrigger;
const isRepliedPromptify = isQuoted && isQuoted.imageMessage && containsIm2PromptTrigger;

if (isDirectPromptify || isRepliedPromptify) {
    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: '🖼️ Gambar diterima! Menganalisis dan membuat deskripsi... Mohon tunggu...',
        action: {
            features: 'image_to_prompt_sanka',
            source: isDirectPromptify ? 'direct' : 'quoted'
        }
    };
}

const capcutIntent = ['capcut', 'gambar', 'buat gambar'];
const isCapcutRequest = capcutIntent.some(intent => lowerCaseMessage.startsWith(intent));

if (isCapcutRequest) {
    // Ekstrak prompt dari sisa pesan
    const prompt = content.replace(/capcut|imagine|buat gambar/gi, '').trim();

    if (!prompt) {
        return { 
            status: true, 
            message_type: 'text', 
            reply_text: 'Masukkan deskripsi gambar yang ingin dibuat.\n\nContoh: *capcut kapibara di luar angkasa*' 
        };
    }
    
    // Kurangi limit
    reduceLimit(sender, 2); 
    
    return {
        status: true,
        message_type: 'text',
        reply_text: `🎨 Menggunakan model Capcut... Saya akan melukis *"${prompt}"*. Mohon tunggu sebentar...`,
        action: {
            features: 'generate_image_capcut',
            content: prompt
        }
    };
}

// FILE: lib/ai.js
// ... di dalam fungsi handleMessageLocal

// --- Fitur ToUrl (Upload File dengan Tombol Copy) ---
const toUrlIntent = ['tourl', 'upload', 'uplink'];
const isToUrlRequest = toUrlIntent.some(intent => lowerCaseMessage.includes(intent));

if (isQuoted && isToUrlRequest) {
    const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
    if (quotedMessage.conversation || quotedMessage.extendedTextMessage) {
        return { 
            status: true, 
            message_type: 'text', 
            reply_text: 'Perintah ini harus digunakan dengan cara me-reply sebuah file (gambar, video, dokumen, dll), bukan pesan teks.' 
        };
    }

    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: '📤 File diterima! Sedang mengunggah ke server...',
        action: {
            features: 'upload_to_url_yupra_cta' // Nama fitur yang sudah disesuaikan
        }
    };
}
const animeTriggers = ['anime', 'anime', 'info anime', 'search anime'];
const animeTriggerWord = animeTriggers.find(trigger => lowerCaseMessage.startsWith(trigger));

if (animeTriggerWord) {
    // Ambil sisa teks setelah kata kunci pemicu
    const query = content.substring(animeTriggerWord.length).trim();
    if (!query) {
        return { 
        status: true, 
        message_type: 'text', 
        reply_text: 'Judul animenya apa yang mau dicari?' };
    }
    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: `🌸 Siap! Sedang mencari info anime *"${query}"*...`,
        action: { features: 'anime_search', content: query }
    };
}

    const greetings = ['halo', 'p', 'hay', 'hai', 'bot','ai'];
    const greetingResponses = [
        `Halo! Perkenalkan saya ${config.name_bot}, ada yang bisa saya bantu?`,
        `Hai, saya ${config.name_bot}. Bagaimana saya bisa membantu Anda hari ini?`,
        `Halo! ${config.name_bot} di sini, ada yang bisa saya bantu?`,
        `Salam! Saya ${config.name_bot}, siap membantu Anda.`,
        `Hai! ${config.name_bot} di sini, butuh bantuan?`
    ];


    const responses = {
        menu: await displayMenu(sender),
        limit: await checkLimit(sender),
        tiktok: config.notification.tt
    };
    
    const aliases = {
        menu: ['mn', 'mno'],
        tiktok: ['tiktok'],
    };
    let messageText = String(lowerCaseMessage).replace(/^[.#]/, '');
    
    for (const key in aliases) {
        if (aliases[key].includes(messageText)) {
            return {
                status: true,
                message_type: 'text',
                reply_text: responses[key],
            };
        }
    }


    
    const identityQuestions = ['nama kamu siapa', 'siapa kamu', 'apakah kamu bot','kamu siapa', 'ap kamu bot'];
    const identityResponses = [
        `Saya adalah AI sederhana bernama ${config.name_bot}.`,
        `Nama saya ${config.name_bot}, saya di sini untuk membantu Anda.`,
        `Saya ${config.name_bot}, bot sederhana yang siap membantu.`,
        `Panggil saya ${config.name_bot}, saya adalah asisten virtual Anda.`,
        `Hai, saya ${config.name_bot}, bot yang dibuat untuk membantu Anda.`
    ];

    const owner = ['owner', 'pembuat', 'pencipta'];
    const ownerResponses = [
        `Bot ini dibuat oleh tim di ${config.owner_website}.`,
        `Owner saya adalah ${config.owner_name}, Anda bisa cek lebih lanjut di ${config.owner_website}.`,
        `Bot ini diciptakan oleh ${config.owner_name}, kunjungi ${config.owner_website} untuk info lebih lanjut.`,
        `Saya diciptakan oleh ${config.owner_name}, kunjungi situsnya di ${config.owner_website}.`,
        `Pembuat saya adalah ${config.owner_name}, lebih banyak info di ${config.owner_website}.`
    ];


    const stickers = ['s', 'sticker', 'stiker', 'stikker'];
    const stickerResponses = [
        `Hai! Saya bisa bantu buatkan sticker khusus untuk Anda. Yuk, kirimkan gambarnya dan saya akan segera memprosesnya! 😄`,
        `Ingin sticker keren? Silakan kirim gambar Anda, dan saya akan buatkan stickernya! 😉`,
        `Sticker yang unik hanya untuk Anda! Kirim gambarnya dan saya akan jadikan sticker dalam sekejap! 🎨`,
        `Buat sticker dari gambar Anda? Mudah! Kirim gambarnya, saya siap membuat sticker untuk Anda! 👍`
    ];

    
    const songQuestion = ['bisa carikan lagu', 'apa bisa putar music','bisa play','apakah bisa putar lagu','apakah bisa mutar lagu'];
    const songQuestionResponses = [
        `Tentu Saya bisa mencarikan anda lagu. Silakan tulis judulnya`,
    ];
    if (songQuestion.some(keyword => lowerCaseMessage.includes(keyword))) {
        updateSession(sender, 'play');
        const randomsongQuestionResponses = songQuestionResponses[Math.floor(Math.random() * songQuestionResponses.length)];
        return {
            status : true,
            message_type : 'text',
            reply_text : randomsongQuestionResponses
        };
    }


    const songs = ['lagu', 'music', 'musik', 'sound', 'mp3', 'play', 'putarkan', 'putar','mutar'];
    const containsMusicKeyword = songs.some(keyword => lowerCaseMessage.includes(keyword));
    let keyword_music = '';
    if (containsMusicKeyword) {

        // Cek sesi
        const active = getActiveFitur(sender, "play");
        if(active) {
            return {
                status : true,
                message_type : 'text',
                reply_text : config.notification.waiting,
            };
        }
        setActiveFitur(sender, "play");

        reduceLimit(sender)


        keyword_music = songs.find(keyword => lowerCaseMessage.includes(keyword));
        const cleanedMessage = songs.reduce((message, keyword) => message.replace(new RegExp(keyword, 'gi'), '').trim(), lowerCaseMessage);
        keyword_music = cleanedMessage;
        keyword_music = keyword_music.replace(/carikan|cari|tolong/g, '').trim();
        if(keyword_music.length < 3) {
            return {
                status : true,
                message_type : 'text',
                reply_text : `Hai kak lagu apa yang ingin kamu dengar ? \n\nContoh : *play kangen band terbang*`,
            };
        }
        return {
            status : true,
            message_type : 'text',
            reply_text : `Mohon Tunggu Sebentar ya kak 😉, Saya akan mencarikan lagu *${keyword_music}*`,
            action : {
                content : keyword_music,
                features : 'play'
            }
        };
    }



    //  Deteck Link
    const detected = detectLink(content);
    if (detected) {

        // Cek sesi
        const active = getActiveFitur(sender, "download");
        if(active) {
            return {
                status : true,
                message_type : 'text',
                reply_text : config.notification.waiting,
            };
        }
        setActiveFitur(sender, "download");

        reduceLimit(sender)


        const responses = [
            `Sepertinya kamu mengirimkan sebuah link, saya akan coba memprosesnya.`,
            `Saya melihat ada link di pesanmu. Sedang diproses...`,
            `Oh, ada link nih! Saya akan coba cek lebih lanjut.`,
            `Terima kasih, saya menemukan sebuah link, mari kita lihat.`,
            `Link terdeteksi! Sedang saya proses ya...`
        ];
        return {
            status: true,
            message_type: 'text',
            reply_text: responses[Math.floor(Math.random() * responses.length)],
            action : {
                content     : detected.link,
                name        : detected.name,
                features    : 'detect_link'
            }
        };
    }

    // Qc Stick
    if (lowerCaseMessage.startsWith('qc')) { // Cek jika pesan dimulai dengan 'qc'
        let ppnyauser;
        try {
            // Coba mendapatkan foto profil pengguna
            ppnyauser = await sock.profilePictureUrl(sender, 'image');
        } catch (e) {
            ppnyauser = 'https://telegra.ph/file/6880771a42bad09dd6087.jpg';
        }
        const text = lowerCaseMessage.slice(2).trim();

        if(!text) {
            return {
                status: true,
                message_type: 'text',
                reply_text: config.notification.qc_help
            };
        }
    
        try {
            const media = await api.getBuffer('/api/maker/qc', { 
                name: pushName, 
                text: text, // Fallback jika teks kosong
                pp: ppnyauser 
            });
    
            return {
                status: true,
                message_type: 'sticker',
                image_url: media
            };
        } catch (error) {
            return {
                status: true,
                message_type: 'text',
                reply_text: config.error.qc
            };
        }
    }

// --- Fitur Ghibli Filter ---
const ghibliTriggers = ['ghibli', 'jadi ghibli'];
const containsGhibliTrigger = ghibliTriggers.some(word => lowerCaseMessage.includes(word));

const isDirectGhibli = messageType === 'imageMessage' && containsGhibliTrigger;
const isRepliedGhibli = isQuoted && isQuoted.imageMessage && containsGhibliTrigger;

if (isDirectGhibli || isRepliedGhibli) {
    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: '🎨 Merubah foto menjadi gaya seni Studio Ghibli, mohon tunggu...',
        action: {
            features: 'ghibli_filter',
            source: isDirectGhibli ? 'direct' : 'quoted'
        }
    };
}
// ======= BRAT V2 =======
const bratTriggers = ['brat', 'buat brat', 'buatin brat', 'bikin brat'];
const bratDetected = bratTriggers.some(keyword => lowerCaseMessage.startsWith(keyword));

if (bratDetected) {
    // Ambil teks setelah kata trigger
    let textPrompt = lowerCaseMessage;
    bratTriggers.forEach(trigger => {
        if (textPrompt.startsWith(trigger)) {
            textPrompt = textPrompt.replace(trigger, '').trim();
        }
    });

    if (!textPrompt) {
        return {
            status: true,
            message_type: 'text',
            reply_text: 'Contoh: buatin brat kucing lucu'
        };
    }

    try {
        const apiUrl = `https://api.nekoo.qzz.io/maker/brat-v2?text=${encodeURIComponent(textPrompt)}`;
        const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

        if (!response.data) {
            return {
                status: true,
                message_type: 'text',
                reply_text: '❌ API tidak mengembalikan gambar.'
            };
        }

        return {
            status: true,
            message_type: 'sticker',
            image_url: Buffer.from(response.data, 'binary')
        };

    } catch (error) {
        console.error('Brat Error:', error);
        return {
            status: true,
            message_type: 'text',
            reply_text: '❌ Yah error nih bikin brat'
        };
    }
}

const menuIntent = ['menu', 'allmenu', 'help', 'fitur', 'keahlian', 'kemampuan'];
if (menuIntent.includes(lowerCaseMessage)) {

    // 1. Bangun baris-baris (rows) untuk setiap kategori menu
    const aiFeatures = [
        { title: '🤖 Tanya AI (Gemini)', description: 'Mulai percakapan cerdas dengan AI', id: 'ai ' },
        { title: '🎨 Buat Gambar (Imagine)', description: 'Generate gambar dari teks', id: 'imagine ' },
        { title: '🖼️ Deskripsikan Gambar', description: 'Kirim gambar untuk dianalisis', id: 'deskripsikan ' }
    ];

    const mediaFeatures = [
        { title: '🎵 Cari Lagu (Play)', description: 'Cari & unduh lagu dari YouTube', id: 'play ' },
        { title: '🖼️ Cari Gambar (Pinterest)', description: 'Cari gambar di Pinterest', id: 'pin ' },
        { title: '🎬 Downloader', description: 'Kirim link TikTok/IG/FB untuk diunduh', id: 'download ' },
        { title: '🧩 Cari Paket Stiker', description: 'Temukan paket stiker dari Sticker.ly', id: 'cari stiker ' }
    ];

    const imageTools = [
        { title: '✨ Perjelas Gambar (HD)', description: 'Tingkatkan kualitas gambar menjadi jernih', id: 'hd ' },
        { title: '✂️ Hapus Background', description: 'Hapus latar belakang foto', id: 'hapusbg ' },
        { title: '🎨 Filter Ghibli', description: 'Ubah foto menjadi gaya seni Ghibli', id: 'ghibli ' },
        { title: '📜 Buat Stiker', description: 'Kirim/reply gambar dengan caption "stiker"', id: 'stiker' }
    ];
    
    const webTools = [
        { title: '📸 Screenshot Website', description: 'Ambil tangkapan layar dari URL', id: 'ssweb ' },
        { title: '📦 Arsip Website', description: 'Simpan seluruh halaman web ke .zip', id: 'saveweb ' },
        { title: '💻 Cari Kode', description: 'Cari snippet kode di Codeshare', id: 'carikode ' }
    ];
    
    const infoFeatures = [
        { title: '📊 Cek Limit Harian', description: 'Lihat sisa kuota penggunaan Anda', id: 'limit' },
        { title: 'ℹ️ Info Bot', description: 'Lihat informasi tentang bot ini', id: 'info' }
    ];
    
    // 2. Siapkan parameter JSON untuk nativeFlow
    const paramsJson = JSON.stringify({
        title: `MENU UTAMA ${config.name_bot.toUpperCase()}`,
        sections: [
            { title: '🤖 KECERDASAN BUATAN', rows: aiFeatures },
            { title: '🎬 MEDIA & DOWNLOADER', rows: mediaFeatures },
            { title: '🎨 ALAT MANIPULASI GAMBAR', rows: imageTools },
            { title: '🌐 UTILITAS WEB & KODE', rows: webTools },
            { title: '📊 INFORMASI & AKUN', rows: infoFeatures }
        ]
    });
    
    // 3. Bangun struktur Tombol Native Flow
    const menuButton = [{
        buttonId: 'interactive_menu',
        buttonText: { displayText: '📜 Buka Daftar Menu Lengkap' },
        type: 4,
        nativeFlowInfo: {
            name: 'single_select',
            paramsJson: paramsJson
        }
    }];

    // 4. Kirim pesan
    return {
        status: true,
        message_type: 'native_flow_button',
        reply_text: `Halo *${pushName}*! 👋\nSelamat datang di *${config.name_bot}*, asisten AI pribadi Anda.\n\nKlik tombol di bawah untuk melihat semua fitur yang tersedia.`,
        footer: `Powered by autoresbot.com | v${global.version}`,
        buttons: menuButton,
    };
}

// ===== REMOVE BACKGROUND (remove.bg) =====
const removeBgTriggers = ['removebg', 'hapusbg', 'hapus background', 'no bg', 'nobg', 'hapusin background', 'hapus latar belakang', 'background', 'latar belakang'];
const removeBgRequested = removeBgTriggers.some(keyword => lowerCaseMessage.includes(keyword));
const isRemoveBgActive = getActiveFitur(sender, "removebg");

async function getImageBuffer(message, sock, logger) {
    const isDirectImage = message.message?.imageMessage;
    const isReplyImage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (isDirectImage) {
        const media = await downloadAndSaveMedia(message, sock, logger);
        return media.buffer;
    } else if (isReplyImage) {
        const quotedMedia = await downloadQuotedMedia(message);
        return quotedMedia?.buffer || null;
    }
    return null;
}

// Trigger + Gambar Langsung / Reply Gambar
if (removeBgRequested && !isRemoveBgActive) {
    const buffer = await getImageBuffer(message, sock, logger);
    if (buffer) {
        reduceLimit(sender);
        return {
            status: true,
            message_type: 'text',
            reply_text: '🔄 Menghapus background gambar...',
            action: {
                content: buffer,
                features: 'removebg_official'
            }
        };
    }

    // Kalau belum ada gambar → minta kirim
    setActiveFitur(sender, "removebg");
    reduceLimit(sender);
    return {
        status: true,
        message_type: 'text',
        reply_text: '📸 Kirim atau reply gambar yang ingin dihapus background-nya.'
    };
}

// Sudah trigger sebelumnya → Kirim Gambar
if (isRemoveBgActive) {
    const buffer = await getImageBuffer(message, sock, logger);
    if (buffer) {
        resetActiveFitur(sender, "removebg");
        return {
            status: true,
            message_type: 'text',
            reply_text: '🔄 Menghapus background gambar...',
            action: {
                content: buffer,
                features: 'removebg_official'
            }
        };
    }
}
// --- Fitur Codeshare Search (cscsearch) ---

// Definisikan kata kunci pemicu
const cscTriggers = ['cscsearch', 'kode', 'codeshare', 'scrape'];
const cscTriggerWord = cscTriggers.find(trigger => lowerCaseMessage.startsWith(trigger));

if (cscTriggerWord) {
    const queryOrUrl = content.substring(cscTriggerWord.length).trim();

    if (!queryOrUrl) {
        return { status: true, message_type: 'text', reply_text: 'Masukkan kata kunci pencarian atau URL dari Codeshare. Contoh:\n\n*carikode web scraper*\n*carikode https://codeshare.cloudku.click/s/perplexity-ai-clone*' };
    }
    
    reduceLimit(sender); // Kurangi limit pengguna
    
    // Periksa apakah input adalah URL atau kata kunci pencarian
    const isUrl = queryOrUrl.startsWith('http') && queryOrUrl.includes('codeshare.cloudku.click');
    const featureName = isUrl ? 'codeshare_get_raw' : 'codeshare_search';

    return {
        status: true,
        message_type: 'text',
        reply_text: `🔎 Oke, sedang memproses permintaan Anda di Codeshare...`,
        action: {
            features: featureName,
            content: queryOrUrl
        }
    };
}
    // Handle Sticker
    const stickerCommands = ['.s', 's', 'sticker','stiker', '.sticker', '.stiker', '.stick'];
    if ((messageType == 'imageMessage' || messageType == 'videoMessage') && stickerCommands.includes(lowerCaseMessage)) {
        const media = await downloadAndSaveMedia(message, sock, logger);
            return {
                status : true,
                message_type : 'sticker',
                image_url : media.buffer 
            };
    }


    if (isQuoted && ['sticker', 'stiker', 'stikker'].some(keyword => lowerCaseMessage.includes(keyword))) {

            const media = await downloadQuotedMedia(message);
                return {
                    status : true,
                    message_type : 'sticker',
                    image_url : media.buffer 
                };
        }

    

    
    // Salam
    if (greetings.includes(lowerCaseMessage)) {
        const randomGreetingResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
        return {
            status : true,
            message_type : 'text',
            reply_text : randomGreetingResponse
        };
    }
    if (identityQuestions.some(keyword => lowerCaseMessage.includes(keyword))) {
        const randomIdentityResponse = identityResponses[Math.floor(Math.random() * identityResponses.length)];
        return {
            status : true,
            message_type : 'text',
            reply_text : randomIdentityResponse
        };
    }
    // Owner
    if (owner.some(keyword => lowerCaseMessage.includes(keyword))) {
        const randomOwnerResponse = ownerResponses[Math.floor(Math.random() * ownerResponses.length)];
        return {
            status : true,
            message_type : 'text',
            reply_text : randomOwnerResponse
        };
    }

    // Lebih kecil 2 karater
    if(lowerCaseMessage.length < 2) {
        const randomGreetingResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
        return {
            status : true,
            message_type : 'text',
            reply_text : randomGreetingResponse
        };
    }

// --- Fitur Image Upscaler (PicUpscaler API) ---

const picupscalerTriggers = ['hd', 'upscale', 'picupscale', 'jernihkan', 'perbagus', 'perjelas', 'remini'];
const containsPicUpscalerTrigger = picupscalerTriggers.some(word => lowerCaseMessage.includes(word));

// Cek dua skenario: mengirim langsung atau me-reply
const isDirectPicUpscale = messageType === 'imageMessage' && containsPicUpscalerTrigger;
const isRepliedPicUpscale = isQuoted && isQuoted.imageMessage && containsPicUpscalerTrigger;

if (isDirectPicUpscale || isRepliedPicUpscale) {
    reduceLimit(sender); // Kurangi limit pengguna
    
    // Kembalikan action untuk dieksekusi oleh sendReply
    return {
        status: true,
        message_type: 'text',
        reply_text: '✨ Menggunakan PicUpscaler... Saya akan coba tingkatkan resolusi gambar ini. Mohon tunggu...',
        action: {
            features: 'image_picupscaler', // Nama unik untuk fitur baru ini
            source: isDirectPicUpscale ? 'direct' : 'quoted'
        }
    };
}

    // Sticker
    if (messageType == 'imageMessage' || messageType == 'videoMessage') {
        if (stickers.some(keyword => lowerCaseMessage.includes(keyword))) {
            const media = await downloadAndSaveMedia(message, sock, logger);
            return {
                status : true,
                message_type : 'sticker',
                image_url : media.buffer
            };
        }
    }

    // Make stiker with session
    if ((messageType == 'imageMessage' || messageType == 'videoMessage') && session) {
        const session = getSession(sender);
        if(session.action == 'sticker') {
            updateSession(sender, 'sticker');
            const media = await downloadAndSaveMedia(message, sock, logger);
                return {
                    status : true,
                    message_type : 'sticker',
                    image_url : media.buffer
                };
        }
    }

    // Sticker
    if (['sticker', 'stiker', 'stikker'].some(keyword => lowerCaseMessage.includes(keyword))) {
        updateSession(sender, 'sticker');
        return {
            status : true,
            message_type : 'text',
            reply_text : stickerResponses[Math.floor(Math.random() * stickerResponses.length)]
        };
    }

     // Images Recieved
    if (messageType === 'imageMessage') {
        const responses = [
            'Hai, apa yang bisa saya bantu dengan gambar itu?',
            'Gambar yang menarik! Ada yang bisa saya lakukan?',
            'Terima kasih atas gambar tersebut, apa yang ingin kamu lakukan selanjutnya?',
            'Hmm, gambar ini terlihat keren! Ada permintaan khusus?',
            'Gambar diterima! Apa yang perlu saya lakukan dengan itu?'
        ];
    
        const randomIndex = Math.floor(Math.random() * responses.length);
        return {
            status: true,
            message_type: 'text',
            reply_text: responses[randomIndex]
        };
    }
    
    return null;
}

async function handleMessageExternal(content, sock, sender, remoteJid, messageType, session, message, isGroup, isQuoted) {
    try {
        let imageBuffer = null;

        // Cek apakah ada gambar yang perlu dianalisis oleh AI
        if (messageType === 'imageMessage') {
            const media = await downloadAndSaveMedia(message, sock, logger);
            imageBuffer = media.buffer;
        } else if (isQuoted && isQuoted.imageMessage) {
            const media = await downloadQuotedMedia(message);
            imageBuffer = media?.buffer;
        }

        reduceLimit(sender);
        
        // Panggil GEMINI_TEXT, sekarang dengan semua parameter termasuk imageBuffer
        const replyText = await GEMINI_TEXT(sender, content, isGroup, remoteJid, imageBuffer);
        
        return {
            status: true,
            message_type: 'text',
            reply_text: replyText
        };
    } catch (error) {
        return {
            status: false,
            message_type: 'error',
            reply_text: `Terjadi kesalahan di AI eksternal: ${error.message}`
        };
    }
}

async function createRule(aiResponse) {
    return {
        message_type: aiResponse.message_type || null,
        reply_text: aiResponse.reply_text || null,
        image_url: aiResponse.image_url || null,
        footer: aiResponse.footer || null,
        buttons: aiResponse.buttons || null,
        templateButtons: aiResponse.templateButtons || null,
        content: aiResponse.content || null,
        action: aiResponse.action || null
    };
}

async function processMessage(content, sock, sender, remoteJid, message, messageType, pushName, isQuoted, isGroup) {
    const session = getSession(sender);
    const AiInternal = await handleMessageLocal(content, sock, sender, remoteJid, messageType, session, message, pushName, isQuoted, isGroup);
    let rule_;

    if (AiInternal && AiInternal.status) {
        rule_ = await createRule(AiInternal);
    } else if (!AiInternal) {
        try {
            await sock.sendPresenceUpdate("composing", remoteJid);
        } catch (error) {
            console.log('ERROR composing:', error);
        }
        const AiExternal = await handleMessageExternal(content, sock, sender, remoteJid, messageType, session, message, isGroup, isQuoted);
        if (AiExternal && AiExternal.status) {
            rule_ = await createRule(AiExternal);
        } else {
            return console.log('Error Gemini, Periksa Apikey Gemini Anda');
        }
    }

    const sock_global = global.sock;
    return await sendReply(sock_global, remoteJid, rule_, message, sender);
}

module.exports = { processMessage };