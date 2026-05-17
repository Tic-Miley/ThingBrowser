const fs = require('fs');
const path = require('path');

const SEARCH_LOG_PATH = path.join(__dirname, 'search.log');

function now() {
  const d = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"<unserializable>"';
  }
}

function appendLine(line) {
  try {
    fs.appendFileSync(SEARCH_LOG_PATH, `${line}\n`, 'utf8');
  } catch (err) {
    // 日志写入失败不影响主流程
    // eslint-disable-next-line no-console
    console.error(`[search.log] 写入失败: ${err.message}`);
  }
}

function writeSearchExplanation(payload) {
  const line = `[${now()}] ${safeJson(payload)}`;
  appendLine(line);
}

module.exports = {
  SEARCH_LOG_PATH,
  writeSearchExplanation,
};
