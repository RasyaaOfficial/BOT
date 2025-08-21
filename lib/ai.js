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
const { downloadMediaMessage  }     = require('baileys');
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
        } else if (message_type === 'button' && button_data && footer) {
    let buttons = button_data ? JSON.parse(button_data) : [];
    const buttonsArray = buttons.map(button => {
        const [text, id] = button.split('|');
        return { text, id };
    });
    await sendInteractiveMessage(sock, remoteJid, reply_text, footer, buttonsArray);

        } else if (message_type === 'sticker' && image_url) {
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
   
if (rule.action && rule.action.features === 'process_order') {
    try {
        const [code, target] = rule.action.content.split('|');
        const sender = message?.key?.remoteJid || remoteJid;
        const senderNumber = sender.split('@')[0];
        const reffId = generateRandomText(10)

        const orderData = fs.existsSync(tmpFilePath) ? JSON.parse(fs.readFileSync(tmpFilePath, 'utf8')) : {};

        if (orderData[senderNumber]) {
            return await sock.sendMessage(remoteJid, {
                text: 'Anda memiliki transaksi yang belum selesai. Ketik cancel untuk membatalkan.'
            }, {
                quoted: message
            });
        }

        const productRes = await axios.post(`${global.base_url}/api/h2h/price-list/all`, {
            api_key: global.secret_key
        });

        const product = productRes.data.data.find(item => item.code === code.toUpperCase());
        if (!product) {
            return await sock.sendMessage(remoteJid, {
                text: 'Produk tidak ditemukan'
            }, {
                quoted: message
            });
        }

        const profit = (global.profit / 100) * product.price;
        const finalPrice = Math.ceil(product.price + profit);

        const paymentRes = await axios.post(`${global.base_url}/api/h2h/deposit/create`, {
            reff_id: reffId,
            type: 'ewallet',
            method: 'QRISFAST',
            nominal: finalPrice,
            api_key: global.secret_key
        });

        const paymentData = paymentRes.data.data;

        const sentMsg = await sock.sendMessage(remoteJid, {
            image: {
                url: paymentData.qr_image_url
            },
            caption: `*TRANSAKSI BERHASIL DIBUAT*\n\nKode: ${paymentData.reff_id}\nNominal: ${toRupiah(finalPrice)}\nProduk: ${product.name} (${product.code})\n\nPembayaran berlaku 5 menit`
        }, {
            quoted: message
        });

        orderData[senderNumber] = {
            msgId: sentMsg.key.id,
            reffId,
            payId: paymentData.id,
            createdAt: paymentData.created_at
        };
        fs.writeFileSync(tmpFilePath, JSON.stringify(orderData, null, 2));

        startPaymentChecker(sentMsg.key.id, paymentData.id, reffId, code, target);

    } catch (error) {
        await sock.sendMessage(remoteJid, {
            text: `Error: ${error.response?.data?.message || error.message}`
        }, {
            quoted: message
        });
    }
}

if (rule.action && rule.action.features === 'cancel_order') {
    try {
        const sender = rule.action.content;
        const senderNumber = sender.split('@')[0];
        const orderData = JSON.parse(fs.readFileSync(tmpFilePath, 'utf8'));

        if (!orderData[senderNumber]) {
            return await sock.sendMessage(remoteJid, {
                text: 'Tidak ada transaksi aktif'
            }, {
                quoted: message
            });
        }

        const {
            payId,
            reffId
        } = orderData[senderNumber];
        delete orderData[senderNumber];
        fs.writeFileSync(tmpFilePath, JSON.stringify(orderData, null, 2));

        await axios.post(`${global.base_url}/api/h2h/deposit/cancel`, {
            id: payId,
            api_key: global.secret_key
        });

        await sock.sendMessage(remoteJid, {
            text: `✅ Transaksi ${reffId} dibatalkan`
        }, {
            quoted: message
        });

    } catch (error) {
        await sock.sendMessage(remoteJid, {
            text: `Error: ${error.message}`
        }, {
            quoted: message
        });
    }
}

async function startPaymentChecker(msgId, payId, reffId, code, target, senderNumber) {
    const orderData = JSON.parse(fs.readFileSync(tmpFilePath, 'utf8'));

    const timeout = setTimeout(() => {
        clearInterval(interval);
        axios.post(`${global.base_url}/api/h2h/deposit/cancel`, {
            id: payId,
            api_key: global.secret_key,
        }).then(() => {
            delete orderData[senderNumber];
            fs.writeFileSync(tmpFilePath, JSON.stringify(orderData, null, 2));
            deleteMessage(msgId);
            sock.sendMessage(remoteJid, {
                text: '⚠️ Pembayaran dibatalkan otomatis setelah 5 menit tanpa konfirmasi.'
            }, { quoted: message });
        });
    }, 300000);

    const interval = setInterval(() => {
        axios.post(`${global.base_url}/api/h2h/deposit/status`, {
            id: payId,
            api_key: global.secret_key
        }).then(async response => {
            const data = response.data.data;
            if (data.status === 'success' || data.status === 'failed') {
                clearInterval(interval);
                clearTimeout(timeout);

                delete orderData[senderNumber];
                fs.writeFileSync(tmpFilePath, JSON.stringify(orderData, null, 2));
                deleteMessage(msgId);

                if (data.status === 'success') {
                    await performTopupTransaction(reffId, code, target);
                    sock.sendMessage(remoteJid, {
                        text: `✅ *Pembayaran Berhasil!*\n\nID: ${data.reff_id}\nDiterima: ${toRupiah(data.get_balance)}\nTanggal: ${data.date}`
                    }, { quoted: message });
                } else {
                    sock.sendMessage(remoteJid, {
                        text: `❌ Pembayaran gagal: ${data.status}`
                    }, { quoted: message });
                }
            }
        }).catch(error => {
            console.error('Status Error:', error.response?.data || error.message);
        });
    }, 5000);
}

async function performTopupTransaction(reffId, code, target, msgId) {
    try {
        const res = await axios.post(`${global.base_url}/api/h2h/transaction/create`, {
            reff_id: reffId,
            product_code: code,
            target: target,
            api_key: global.secret_key
        });

        const tx = res.data.data;
        if (!tx) return;

        const text = '🕐 Transaksi sedang diproses...';
        const sent = await sock.sendMessage(remoteJid, {
            text
        }, {
            quoted: message
        });
        checkTransactionStatus(tx.id, sent.key.id);
    } catch (err) {
        console.error('Transaksi gagal dibuat:', err.message);
    }
}

async function checkTransactionStatus(id, msgId) {
    const interval = setInterval(async () => {
        try {
            const res = await axios.post(`${global.base_url}/api/h2h/transaction/status`, {
                id: id,
                api_key: global.secret_key
            });

            const data = res.data.data;

            if (data.status === 'success') {
                clearInterval(interval);
                await sock.sendMessage(remoteJid, {
                    text: `⬣ *Pembelian Berhasil!*\n\n◉ ID: ${data.reff_id}\n◉ Status: ${data.status}\n◉ Produk: ${data.name}\n◉ Target: ${data.target}\n◉ SN: ${data.serial_number}\n◉ Tanggal: ${data.date}`
                });
            } else if (data.status === 'failed' || data.status === 'cancel') {
                clearInterval(interval);
                await sock.sendMessage(remoteJid, {
                    text: '❌ Transaksi gagal atau dibatalkan.'
                });
            }
        } catch (err) {
            console.error('Gagal cek status transaksi:', err.message);
        }
    }, 5000);
}

if (rule.action?.features === 'buy_manual') {
    const [code, target] = rule.action.content.split('|');
    const reffId = generateRandomText(10);
    try {
        const response = await axios.post(`${global.base_url}/api/h2h/transaction/create`, {
            reff_id: reffId,
            product_code: code.toUpperCase(),
            target,
            api_key: global.secret_key
        });

        const data = response.data;
        if (!data.data) return await sock.sendMessage(remoteJid, { text: data.message }, { quoted: message });

        const text = `Pembelian sedang di prosess:\n\nLayanan: ${data.data.name}\nTarget: ${data.data.target}\nReff id: ${data.data.reff_id}\nNominal: ${toRupiah(data.data.price)}\nSN: ${data.data.serial_number}\nDibuat pada: ${data.data.date}`;
        const sent = await sock.sendMessage(remoteJid, { text }, { quoted: message });
        checkBuyStatus(data.data.id, sent.key.id);
    } catch (error) {
        
        await sock.sendMessage(remoteJid, { text: `Error: ${error.response?.data?.message || error.message}` }, { quoted: message });
    }
}

if (rule.action?.features === 'create_manual_deposit') {
    const nominal = parseInt(rule.action.content);
    const reffId = generateRandomText(10);
    try {
        const response = await axios.post(`${global.base_url}/api/h2h/deposit/create`, {
            reff_id: reffId,
            type: 'ewallet',
            method: 'QRISFAST',
            nominal,
            api_key: global.secret_key
        });

        const data = response.data.data;
        if (!data) return await sock.sendMessage(remoteJid, { text: response.data.message }, { quoted: message });

        const caption = `Reff id: ${data.reff_id}\nNominal: ${toRupiah(data.nominal)}\nFee: ${toRupiah(data.fee)}\nDiterima: ${toRupiah(data.get_balance)}\nDibuat pada: ${data.created_at}\n\nNote: Pembayaran akan otomatis dibatalkan 5 menit lagi!`;
        const sent = await sock.sendMessage(remoteJid, {
            image: { url: data.qr_image_url },
            caption
        }, { quoted: message });

        checkManualDepositStatus(data.id, sent.key.id);
    } catch (error) {
        
        await sock.sendMessage(remoteJid, {
            text: `Error: ${error.response?.data?.message || error.message}`
        }, { quoted: message });
    }
}

async function checkBuyStatus(payId, msgId) {
    const interval = setInterval(async () => {
        try {
            const response = await axios.post(`${global.base_url}/api/h2h/transaction/status`, {
                id: payId,
                api_key: global.secret_key
            });
            const data = response.data;
            if (data.data.status === 'success') {
                clearInterval(interval);
                deleteMessage(msgId);
                
                await sock.sendMessage(remoteJid, {
                    text: `⬣ *Pembelian Berhasil!*\n\n◉ ID Pembayaran: ${data.data.reff_id}\n◉ Status: ${data.data.status}\n◉ Layanan: ${data.data.name}\n◉ Target: ${data.data.target}\n◉ Serial Number: ${data.data.serial_number}\n◉ Tanggal: ${data.data.date}\n\nTerimakasih.`
                }, { quoted: message });
            } else if (data.data.status === 'failed') {
                clearInterval(interval);
                deleteMessage(msgId);
                
                await sock.sendMessage(remoteJid, {
                    text: 'Transaksi kamu failed. Silahkan minta reffund kepada owner bot.'
                }, { quoted: message });
            }
        } catch (error) {
            
            console.error(error.response?.data || error);
        }
    }, 5000);
}

async function checkManualDepositStatus(payId, msgId) {
    const timeout = setTimeout(async () => {
        clearInterval(interval);
        const response = await axios.post(`${global.base_url}/api/h2h/deposit/cancel`, {
            id: payId,
            api_key: global.secret_key
        });
        deleteMessage(msgId);
        
        await sock.sendMessage(remoteJid, {
            text: `⚠️ *Pembayaran Dibatalkan Otomatis* setelah 5 menit tanpa konfirmasi keberhasilan.`
        }, { quoted: message });
    }, 300000);

    const interval = setInterval(async () => {
        try {
            const response = await axios.post(`${global.base_url}/api/h2h/deposit/status`, {
                id: payId,
                api_key: global.secret_key
            });
            const data = response.data;
            if (data.data.status === 'success') {
                clearInterval(interval);
                clearTimeout(timeout);
                deleteMessage(msgId);
                await sock.sendMessage(remoteJid, {
                    text: `⬣ *Pembayaran Berhasil!*\n\n◉ ID Pembayaran: ${data.data.reff_id}\n◉ Status: ${data.data.status}\n◉ Diterima: ${toRupiah(data.data.get_balance)}\n◉ Tanggal: ${data.data.date}\n\nTerimakasih.`
                }, { quoted: message });
            } else if (['failed', 'cancel'].includes(data.data.status)) {
                clearInterval(interval);
                deleteMessage(msgId);
                
                await sock.sendMessage(remoteJid, {
                    text: 'Pembayaran kamu gagal/dibatalkan oleh sistem.'
                }, { quoted: message });
            }
        } catch (error) {
            
            console.error(error.response?.data || error);
        }
    }, 5000);
}

// --- Eksekutor untuk Fitur Save Website to ZIP ---
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
        // 5. Selalu hapus file sementara setelah selesai
        if (mediaPath && fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
        }
    }
}

// FILE: lib/ai.js
// ... di dalam fungsi sendReply

// --- Eksekutor untuk Fitur Text-to-Image (Google Imagen 2 - VERSI AXIOS) ---
if (rule.action && rule.action.features === 'generate_image_imagen') {
    try {
        const prompt = rule.action.content;
        
        // Endpoint API yang benar untuk generasi gambar
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen2-preview:generateImage?key=${config.GEMINI_API_KEY}`;
        
        // Batasi jumlah gambar yang diminta (aturan API: maks 4)
        const numberOfImages = 2;

        console.log(`[IMAGEN] Memulai generasi ${numberOfImages} gambar via REST API untuk prompt: "${prompt}"`);

        // Body permintaan yang benar untuk endpoint Imagen 2
        const requestBody = {
            "prompt": `photorealistic, high quality, ${prompt}`, // Tambahkan prefix untuk hasil lebih baik
            "number_of_images": numberOfImages,
        };
        
        // 2. Kirim request ke API Imagen 2 menggunakan axios
        const response = await axios.post(API_URL, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.data || !response.data.images || response.data.images.length === 0) {
            throw new Error('API tidak mengembalikan data gambar. Mungkin prompt Anda terlalu kompleks atau melanggar kebijakan.');
        }

        console.log(`[IMAGEN] Berhasil mendapatkan ${response.data.images.length} gambar.`);

        // 3. Kirim semua gambar yang berhasil di-generate
        await sock.sendMessage(remoteJid, { text: `✅ Selesai! Berikut adalah hasil imajinasi untuk *"${prompt}"*:` }, { quoted: message });

        for (const generatedImage of response.data.images) {
            // Data sudah dalam format base64, konversi ke Buffer
            const imageBuffer = Buffer.from(generatedImage.b64_encoded_image, 'base64');
            
            await sock.sendMessage(remoteJid, {
                image: imageBuffer,
                caption: `Dibuat dengan Google Imagen 2`
            });
            await new Promise(resolve => setTimeout(resolve, 500)); // Jeda
        }

    } catch (error) {
        console.error("🚫 Imagen Gagal:", error.response ? error.response.data : error.message);
        const apiError = error.response?.data?.error?.message || error.message;
        await sock.sendMessage(remoteJid, { text: `Maaf, gagal membuat gambar.\n\n*Pesan Error:* ${apiError}` }, { quoted: message });
    }
}
      if(rule.action && rule.action.features === 'send_tiktok') {
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
        // Proses cari gambar
if (rule.action && rule.action.content && rule.action.features === 'pin') {
    try {
        const keyword = rule.action.content.trim();
        const { data } = await axios.get(`https://api.nekoo.qzz.io/search/pinterest?q=${encodeURIComponent(keyword)}`);

        if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
            throw new Error('❌ Gambar tidak ditemukan di Pinterest.');
        }

        // Batasi jumlah gambar dikirim (misalnya max 5 biar ga spam)
        const results = data.result.slice(0, 5);

        for (const item of results) {
            let caption = `🖼 *${keyword}*\n`;
            if (item.caption) caption += `📌 Caption: ${item.caption}\n`;
            caption += `👤 Author: ${item.author?.fullname || 'Unknown'} (${item.author?.followers || 0} followers)\n🔗 Link: ${item.url}`;

            await sock.sendMessage(remoteJid, {
                image: { url: item.imageUrl },
                caption
            }, { quoted: message });
        }

    } catch (e) {
        await sock.sendMessage(remoteJid, {
            text: e.message || config.error.IMAGE_ERROR
        }, { quoted: message });
    }

    resetActiveFitur(remoteJid, "pin");
}

        // Proses Deteksi Link
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
    
// Trigger backup
const backupKeywords = ['backup', 'ambilsc', 'ambilin script', 'get script', 'backupsc'];
if (backupKeywords.some(keyword => lowerCaseMessage.includes(keyword))) {
    const ownerId = config.owner_number + '@s.whatsapp.net';
    if (sender !== ownerId && sender !== sock.user.id) {
        return {
            status: true,
            message_type: 'text',
            reply_text: 'khusus Owner'
        };
    }

    // Buat ZIP
    const botName = `SimpleAi`;
    const fileList = execSync('ls').toString().split('\n').filter(name =>
        !['node_modules', 'session', 'package-lock.json', 'yarn.lock', '', '.git'].includes(name)
    );
    const zipFile = `${botName}.zip`;
    execSync(`zip -r ${zipFile} ${fileList.join(' ')}`);

    return {
        status: true,
        message_type: 'document',
        reply_text: `📦 Berhasil membuat backup script!\nFile: *${zipFile}*`,
        image_url: `./${zipFile}`,
        footer: 'SimpleBotzAi Backup',
        action: {
            content: zipFile,
            features: 'backup_cleanup'
        }
    };
}

// Setelah pengiriman backup, auto delete zip
if (session && session.action === 'backup_cleanup') {
    const zipPath = session.content;
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    resetActiveFitur(sender, 'backup');
}


// FITUR SEARCH PRODUK DARI m.forestapi.web.id
const srcKeywords = ['src', 'cari produk', 'cari kode', 'produk apa', 'kode produk'];

if (srcKeywords.some(keyword => lowerCaseMessage.includes(keyword))) {
  // ambil keyword pencarian
  const keyword = lowerCaseMessage
    .replace(/src|cari produk|produk apa|kode produk|cari kode/g, '')
    .trim();

  if (!keyword || keyword.length < 2) {
    return {
      status: true,
      message_type: 'text',
      reply_text: '❌ Masukkan nama produk. Contoh: src MLW atau cari produk mobile legends'
    };
  }

  try {
    const response = await axios.post(global.base_url + '/api/h2h/price-list/all', {
      filter_name: keyword,
      api_key: global.secret_key
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const result = response.data;
    if (!result.data) {
      return {
        status: true,
        message_type: 'text',
        reply_text: result.message
      };
    }

    let listText = '';
    result.data.forEach(item => {
      const profit = (global.profit / 100) * item.price;
      const finalPrice = Number(item.price) + Number(Math.ceil(profit));
      listText += `╭⟬ *${item.status} ${item.name}*\n┆•Harga: ${toRupiah(finalPrice)}\n┆•Kode: ${item.code}\n╰──────────◇\n\n`;
    });

    return {
      status: true,
      message_type: 'text',
      reply_text: listText
    };

  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      status: true,
      message_type: 'text',
      reply_text: '❌ Produk yg anda cari tidak ditemukan.'
    };
  }
}

if (lowerCaseMessage.startsWith('order', 'beli produk', 'beli', 'mau topup') || lowerCaseMessage.startsWith('topup', 'beli produk', 'mau order')) {
    const args = content.split(' ')[1];
    if (!args) {
        return {
            status: true,
            message_type: 'text',
            reply_text: 'Format: order KODE,TARGET\nContoh: order MLW1,628123456789'
        };
    }

    const [code, ...targets] = args.split(',');
    const target = targets.join(',');

    if (!code || !target) {
        return {
            status: true,
            message_type: 'text',
            reply_text: 'Semua parameter (code, target) diperlukan.\n\nContoh:\n• order MLW1,628123456789\n• order S100,082320667363'
        };
    }

    return {
        status: true,
        message_type: 'text',
        reply_text: '🔄 Memproses pesanan...',
        action: {
            content: `${code}|${target}`,
            features: 'process_order'
        }
    };
}

if (lowerCaseMessage.startsWith('cancel', 'gajadi', 'ga jadi', 'batal')) {
    return {
        status: true,
        message_type: 'text',
        reply_text: '🔄 Memproses pembatalan...',
        action: {
            content: sender,
            features: 'cancel_order'
        }
    };
}

if (lowerCaseMessage.startsWith('buy manual')) {
    const args = content.split(' ')[1];
    if (!isOwner(sender)) {
        return {
            status: true,
            message_type: 'text',
            reply_text: 'Peler Kau Babi'
        };
    }

    if (!args || !args.includes(',')) {
        return {
            status: true,
            message_type: 'text',
            reply_text: `Format: buy KODE,TARGET\nContoh: buy ML3,628299715|10135`
        };
    }

    const [code, ...targets] = args.split(',');
    const target = targets.join(',');

    return {
        status: true,
        message_type: 'text',
        reply_text: '🔄 Memproses pembelian...',
        action: {
            content: `${code}|${target}`,
            features: 'buy_manual'
        }
    };
}

if (lowerCaseMessage.startsWith('deposit', 'isi saldo', 'topup saldo') || lowerCaseMessage.startsWith('depo', 'isi saldo')) {
    const args = content.split(' ')[1];
    if (!isOwner(remoteJid)) {
        return {
            status: true,
            message_type: 'text',
            reply_text: 'Peler Kau Babi'
        };
    }

    const nominal = parseInt(args);
    if (!nominal || isNaN(nominal)) {
        return {
            status: true,
            message_type: 'text',
            reply_text: `Contoh: deposit 500`
        };
    }
    if (nominal < 500) {
        return {
            status: true,
            message_type: 'text',
            reply_text: `Jumlah minimal adalah: 500`
        };
    }

    return {
        status: true,
        message_type: 'text',
        reply_text: '🔄 Membuat pembayaran...',
        action: {
            content: `${nominal}`,
            features: 'create_manual_deposit'
        }
    };
}

                   const stickerlyKeywords = ['stickerly', 'stikerly', 'cari sticker', 'sticker pack', 'cari stiker'];
if (stickerlyKeywords.some(keyword => lowerCaseMessage.includes(keyword))) {
    const keyword_sticker = lowerCaseMessage
        .replace(/stickerly|stikerly|stiker|sticker|cari|pack|ly|sticker pack/g, '')
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

// --- Fitur Text-to-Image (Google Imagen 2) ---
const imagineTriggers = ['imagine', 'buat gambar', 'generate ai', 'buatkan', 'generate'];
const imagineTriggerWord = imagineTriggers.find(trigger => lowerCaseMessage.startsWith(trigger));

if (imagineTriggerWord) {
    const prompt = content.substring(imagineTriggerWord.length).trim();

    if (!prompt) {
        return { 
            status: true, 
            message_type: 'text', 
            reply_text: 'Masukkan deskripsi gambar yang ingin Anda buat.\n\nContoh: *imagine seekor naga api terbang di atas kota masa depan*' 
        };
    }
    
    // Fitur ini sangat "mahal", jadi kurangi lebih banyak limit
    reduceLimit(sender, 3);
    
    return {
        status: true,
        message_type: 'text',
        reply_text: `🎨 Imajinasi Anda sedang diproses... Saya akan mencoba melukis *"${prompt}"*. Ini mungkin memakan waktu hingga satu menit.`,
        action: {
            features: 'generate_image_imagen',
            content: prompt
        }
    };
}

const searchImageTriggers = ['pin', 'cari', 'gambar', 'image', 'foto'];
const searchImageDetected = searchImageTriggers.some(keyword => lowerCaseMessage.startsWith(keyword));

if (searchImageDetected) {
    const keyword_image = lowerCaseMessage
        .replace(/carikan|cari|kirimkan|kirim|bisa|foto|tolong|berikan|mohon|pin|gambar|image/g, '')
        .trim();

    if (keyword_image) {
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

        return {
            status: true,
            message_type: 'text',
            reply_text: `Mohon Tunggu Sebentar ya kak 😉, Saya akan mencarikan gambar *${keyword_image}*`,
            action: {
                content: keyword_image,
                features: 'pin'
            }
        };
    }
}

// ===== SCREENSHOT WEBSITE =====
const ssTriggers = ['ssweb', 'screenshot', 'ss'];
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
const savewebTriggers = ['saveweb', 'simpan web', 'archive web', 'web2zip', 'zip'];
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

const animeTriggers = ['cari anime', 'carikan anime', 'info anime', 'search anime'];
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
        menu: ['menu', 'allmenu'],
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

async function handleMessageExternal(content, sock, sender, remoteJid, messageType, session, message) {
    try {
        reduceLimit(sender)
        const replyText = await GEMINI_TEXT(sender, content);
        return {
            status: true,
            message_type: 'text',
            reply_text: replyText
        };
    } catch (error) {
        return {
            status: false,
            message_type: 'error',
            reply_text: 'Something went wrong while processing the message.'
        };
    }
}


async function createRule(aiResponse) {
    return {
        message_type: aiResponse.message_type || null,
        reply_text: aiResponse.reply_text || null,
        image_url: aiResponse.image_url || null,
        footer: aiResponse.footer || null,
        button_data: aiResponse.button_data || null,
        action : aiResponse.action || null
    };
}

async function processMessage(content, sock, sender, remoteJid, message, messageType, pushName, isQuoted) {
    const session = getSession(sender);

    const AiInternal = await handleMessageLocal(content, sock, sender, remoteJid, messageType, session, message, pushName, isQuoted);
    let rule_;

    if (AiInternal && AiInternal.status) {
        rule_ = await createRule(AiInternal);
    }

    if(!AiInternal) {
       try {
        await sock.sendPresenceUpdate("composing", remoteJid); // efek mengetik
       } catch (error) {
        console.log('ERROR :',error)
       }

        const AiExternal = await handleMessageExternal(content, sock, sender, remoteJid, messageType, session, message);
        if(AiExternal && AiExternal.status) {
            rule_ = await createRule(AiExternal);
        }else {
            return console.log('Error Gemini, Periksa Apikey Gemini Anda')
        }
    }


    const sock_global = global.sock;
    return await sendReply(sock_global, remoteJid, rule_, message);
}

module.exports = { processMessage };
