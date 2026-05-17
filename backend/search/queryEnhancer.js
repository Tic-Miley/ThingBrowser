const { pinyin } = require('pinyin-pro');

const CJK_REGEX = /[\u3400-\u9fff]/;

// 常用同义词/别名映射：支持中文、英文与误拼
const SYNONYM_MAP = {
  // 食堂相关
  食堂: ['canteen', 'catteen', 'cantten', 'dining'],
  canteen: ['食堂', 'catteen', 'cantten', 'dining'],
  catteen: ['canteen', '食堂'],

  // 停车相关
  停车: ['parking', 'park', '车位', '停车场'],
  停车场: ['parking', 'park', '停车', '车位'],
  车位: ['停车场', '停车', 'parking'],
  parking: ['停车场', '停车', '车位'],

  // 人数/监控相关
  人数: ['people', 'count', '客流'],
  监控: ['camera', 'video', '录像'],
  视频: ['video', 'camera', '监控'],

  // 地点相关
  贵阳: ['guiyang'],
  guiyang: ['贵阳'],
  高新区: ['gaoxinqu', '高新'],
  gaoxinqu: ['高新区', '高新'],
  gaoxin: ['高新区', '高新'],
  shitang: ['食堂', 'canteen'],
};

const STOPWORDS = new Set([
  'urn', 'platform', 'thing', 'things', 'proxy', 'properties', 'events', 'localhost',
  'http', 'https', 'ws', 'api', 'v1', 'json',
]);

function isAsciiToken(token) {
  return /^[a-zA-Z0-9:_-]+$/.test(token);
}

function normalizeQuery(query) {
  return String(query || '').replace(/\s+/g, ' ').trim();
}

function splitQueryTokens(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

function getPinyinForms(text) {
  if (!text) return [];
  try {
    const spaced = pinyin(text, { toneType: 'none', type: 'string' })
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    const compact = spaced.replace(/\s+/g, '');
    const initials = spaced
      .split(' ')
      .filter(Boolean)
      .map(s => s[0])
      .join('');

    return [spaced, compact, initials].filter(Boolean);
  } catch {
    return [];
  }
}

function buildQueryVariants(query, dictionary = []) {
  const tokens = splitQueryTokens(query);
  if (tokens.length === 0) return [];

  const hasCjk = CJK_REGEX.test(query);

  if (hasCjk) {
    const variants = new Set([normalizeQuery(query).toLowerCase()]);
    getPinyinForms(query).forEach((variant) => {
      if (variant.includes(' ')) {
        variants.add(variant);
      }
    });
    return Array.from(variants);
  }

  const tokenVariants = tokens.map((raw) => {
    const t = raw.toLowerCase();
    const variants = new Set([t]);

    // 同义词扩展
    if (SYNONYM_MAP[t]) {
      SYNONYM_MAP[t].forEach(v => variants.add(v.toLowerCase()));
    }

    // 中文词转拼音（用于与索引中的拼音字段匹配）
    if (CJK_REGEX.test(t)) {
      getPinyinForms(t).forEach(v => variants.add(v));
    }

    // 英文误拼纠正（小数据集下用近似匹配）
    if (isAsciiToken(t) && dictionary.length > 0) {
      const corrected = findClosestToken(t, dictionary);
      if (corrected) variants.add(corrected);
    }

    return Array.from(variants);
  });

  // 组合查询：每个位置最多取前2个，控制组合爆炸
  const limited = tokenVariants.map(v => v.slice(0, 2));
  const combinations = cartesianProduct(limited)
    .map(parts => parts.join(' '))
    .filter(Boolean);

  return Array.from(new Set([normalizeQuery(query).toLowerCase(), ...combinations]));
}

function collectAsciiDictionary(documents) {
  const set = new Set();
  const fields = ['urn', 'title', 'address', 'types', 'propertiesTitles', 'actionsTitles', 'eventsTitles'];

  documents.forEach((doc) => {
    fields.forEach((f) => {
      const text = String(doc[f] || '').toLowerCase();
      const tokens = text.split(/[^a-z0-9:_-]+/).filter(Boolean);
      tokens.forEach((tk) => {
        if (tk.length >= 4 && !STOPWORDS.has(tk)) set.add(tk);
      });
    });
  });

  return Array.from(set);
}

function findClosestToken(token, dictionary) {
  if (STOPWORDS.has(token)) return null;

  let best = null;
  let bestDist = Infinity;

  for (const candidate of dictionary) {
    if (candidate[0] !== token[0]) continue;
    if (Math.abs(candidate.length - token.length) > 2) continue;

    const dist = levenshtein(token, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  // 约束纠错阈值，避免误纠
  if (best && bestDist <= Math.min(2, Math.floor(token.length * 0.34))) {
    return best;
  }
  return null;
}

function cartesianProduct(arrays) {
  return arrays.reduce((acc, curr) => {
    const next = [];
    acc.forEach((a) => curr.forEach((b) => next.push([...a, b])));
    return next;
  }, [[]]);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

module.exports = {
  normalizeQuery,
  splitQueryTokens,
  getPinyinForms,
  buildQueryVariants,
  collectAsciiDictionary,
};
