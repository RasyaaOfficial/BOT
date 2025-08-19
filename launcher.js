// launcher.js - Versi Definitif dengan Chokidar + Regex (Paling Stabil)

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');
const chokidar = require('chokidar');

let botProcess;

/**
 * Fungsi untuk memulai bot sebagai proses anak.
 */
function startBot() {
  botProcess = spawn('node', ['index.js'], { stdio: 'inherit' });
  console.log(chalk.blue(`[LAUNCHER] Bot dimulai dengan PID: ${botProcess.pid}`));

  botProcess.on('close', (code) => {
    if (code !== 0 && !botProcess.killed) {
      console.log(chalk.red(`[LAUNCHER] Bot berhenti dengan kode error: ${code}.`));
    }
  });

  botProcess.on('error', (err) => {
    console.error(chalk.redBright('[LAUNCHER] Gagal memulai proses bot:', err));
  });
}

/**
 * Fungsi untuk me-restart bot.
 */
let restartTimeout;
function restartBot() {
  clearTimeout(restartTimeout);
  restartTimeout = setTimeout(() => {
    console.log(chalk.yellow('[LAUNCHER] Me-restart bot...'));
    if (botProcess) {
      botProcess.kill();
    }
    setTimeout(startBot, 1000);
  }, 500);
}

// --- Bagian Pengawasan File Menggunakan Chokidar dengan Regex ---

const watcher = chokidar.watch('.', {
  // Gunakan Regular Expressions untuk mengabaikan folder. Ini jauh lebih andal.
  ignored: [
    /(^|[/\\])\../,         // Abaikan file dot (seperti .git)
    /node_modules/,         // Abaikan folder node_modules
    /session/,              // Abaikan folder session
    /database/,             // Abaikan folder database
    /tmp/,                  // Abaikan folder tmp
    /\.zip$/,               // Abaikan file yang berakhiran .zip
    /\.log$/                // Abaikan file yang berakhiran .log
  ],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

console.log(chalk.green('[LAUNCHER] Pengawas file Chokidar aktif dan siap.'));

// Tambahkan event listener untuk perubahan
watcher
  .on('add', filePath => {
    console.log(chalk.magenta(`[LAUNCHER] File baru: ${filePath}, me-restart...`));
    restartBot();
  })
  .on('change', filePath => {
    console.log(chalk.magenta(`[LAUNCHER] Perubahan pada: ${filePath}, me-restart...`));
    restartBot();
  })
  .on('unlink', filePath => {
    console.log(chalk.magenta(`[LAUNCHER] File dihapus: ${filePath}, me-restart...`));
    restartBot();
  })
  .on('error', error => console.error(chalk.redBright(`[LAUNCHER] Watcher error: ${error}`)));

// Mulai bot untuk pertama kalinya
startBot();