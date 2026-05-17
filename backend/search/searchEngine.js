const fs = require('fs');
const path = require('path');
const { buildQueryVariants, collectAsciiDictionary, normalizeQuery } = require('./queryEnhancer');
const { writeSearchExplanation } = require('./searchLogger');

const CJK_REGEX = /[\u3400-\u9fff]/;

/**
 * 搜索引擎
 * 提供搜索功能的高级封装
 */
class SearchEngine {
  constructor(miniSearchIndex, thingsDataPath) {
    this.miniSearch = miniSearchIndex;
    this.thingsDataPath = thingsDataPath;
    this.thingMetadata = this.loadThingMetadata();
    this.allDocuments = [];  // 保存所有搜索文档用于后备方案
    this.asciiDictionary = [];
  }

  /**
   * 加载所有物的元数据（URN 到 TD 文档的映射）
   * @returns {Object} URN -> TD文档的映射表
   */
  loadThingMetadata() {
    const metadata = {};

    if (!fs.existsSync(this.thingsDataPath)) {
      return metadata;
    }

    const files = fs.readdirSync(this.thingsDataPath).filter(f => f.endsWith('.json'));
    
    files.forEach(file => {
      const filePath = path.join(this.thingsDataPath, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const thingTD = JSON.parse(fileContent);
        const urn = thingTD.id;
        if (urn) {
          metadata[urn] = {
            title: thingTD.title,
            description: thingTD.description,
            address: thingTD['platform:address'],
            types: thingTD['@type'],
          };
        }
      } catch (error) {
        // 加载失败时忽略
      }
    });

    return metadata;
  }

  /**
   * 设置所有搜索文档（由索引构建器调用）
   * @param {Array} documents - 搜索文档数组
   */
  setAllDocuments(documents) {
    this.allDocuments = documents;
    this.asciiDictionary = collectAsciiDictionary(documents);
  }

  /**
   * 执行搜索查询
   * @param {string} query - 搜索关键词
   * @param {Object} options - 搜索选项
   * @returns {Array} 搜索结果数组
   */
  search(query, options = {}) {
    const {
      limit = 50,                // 返回结果数量限制
      includeScores = false,      // 是否返回相关性分数
      includeMatchFields = false, // 是否返回匹配字段信息
    } = options;

    // 空查询处理
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) {
      return [];
    }

    try {
      const queryVariants = buildQueryVariants(normalizedQuery, this.asciiDictionary);
      const queryHasCjk = CJK_REGEX.test(normalizedQuery);
      const normalizedLower = normalizedQuery.toLowerCase();
      const queryTokens = normalizedLower.split(/\s+/).filter(Boolean);
      const explanation = {
        query: normalizedQuery,
        variants: queryVariants,
        mode: 'miniSearch',
        fallbackUsed: false,
        results: [],
      };

      // 先尝试使用MiniSearch进行全文搜索（含纠错/同义词/拼音扩展）
      const merged = new Map();
      queryVariants.forEach((qv, variantIndex) => {
        const variantHasCjk = CJK_REGEX.test(qv);
        const variantResults = this.miniSearch.search(qv, {
          combineWith: 'AND',
          prefix: queryHasCjk || variantHasCjk ? false : (term) => term.length >= 2,
          fuzzy: queryHasCjk || variantHasCjk ? false : (term) => (term.length >= 3 ? 0.2 : false),
          boost: {
            title: 16,
            address: 14,
            types: 7,
            propertiesTitles: 6,
            propertiesDescriptions: 6,
            actionsTitles: 5,
            eventsTitles: 5,
            description: 3,
            actionsDescriptions: 2,
            eventsDescriptions: 2,
            pinyin: 1,
            urn: 3,
          },
        });

        const variantPenalty = variantIndex === 0 ? 1 : 0.92;
        variantResults.forEach((r) => {
          const existed = merged.get(r.id);
          const boostedScore = r.score * variantPenalty;
          if (!existed || boostedScore > existed.score) {
            merged.set(r.id, { ...r, score: boostedScore });
          }
        });
      });

      merged.forEach((item, id) => {
        const doc = this.allDocuments.find(d => d.id === id) || item;
        const title = String(doc.title || '').toLowerCase();
        const address = String(doc.address || '').toLowerCase();
        let priorityBoost = 0;

        if (title === normalizedLower) {
          priorityBoost += 120;
        } else if (title.includes(normalizedLower)) {
          priorityBoost += 80;
        }

        if (address === normalizedLower) {
          priorityBoost += 90;
        } else if (address.includes(normalizedLower)) {
          priorityBoost += 60;
        }

        if (queryHasCjk && queryTokens.length > 0) {
          const titleHitCount = queryTokens.filter(token => title.includes(token)).length;
          const addressHitCount = queryTokens.filter(token => address.includes(token)).length;
          priorityBoost += titleHitCount * 18;
          priorityBoost += addressHitCount * 10;
        }

        item.score += priorityBoost;
      });

      let results = Array.from(merged.values()).sort((a, b) => b.score - a.score);

      // 如果MiniSearch返回0条结果，使用后备方案：简单的包含匹配
      if (results.length === 0) {
        explanation.mode = 'fallback';
        explanation.fallbackUsed = true;
        const queryLower = normalizedQuery.toLowerCase();
        const words = queryLower.split(/\s+/);
        
        // 使用保存的所有文档进行后备搜索
        results = this.allDocuments
          .filter(doc => {
            const searchText = [
              doc.urn,
              doc.title,
              doc.address,
              doc.types,
              doc.propertiesTitles,
              doc.pinyin,
            ].join(' ').toLowerCase();
            
            return words.every(word => searchText.includes(word));
          })
          .map((doc, idx) => ({
            ...doc,  // 包含完整的文档信息
            score: 1 - (idx * 0.1), // 简单的相关性排序
          }));
      }

      // 转换结果格式，兼容前端
      const formattedResults = results.slice(0, limit).map(result => {
        const doc = result;

        const item = {
          id: doc.id,
          title: doc.title,
          type: 'thing',
          path: doc.address || '',  // 使用 address 作为 path
          urn: doc.urn,
        };

        if (includeScores) {
          item.score = result.score;
        }

        if (includeMatchFields) {
          item.matchFields = result.match ? Object.keys(result.match) : [];
        }

        explanation.results.push({
          id: item.id,
          title: item.title,
          score: Number.isFinite(item.score) ? item.score : result.score,
          path: item.path,
          urn: item.urn,
          matchedTerms: Array.isArray(result.queryTerms) ? result.queryTerms : [],
          matchFields: result.match ? result.match : {},
        });

        return item;
      });

      writeSearchExplanation({
        query: explanation.query,
        variants: explanation.variants,
        mode: explanation.mode,
        fallbackUsed: explanation.fallbackUsed,
        totalResults: formattedResults.length,
        topResults: explanation.results.slice(0, 5),
      });

      return formattedResults;
    } catch (error) {
      console.error(`搜索执行失败: ${error.message}`);
      console.error(error.stack);
      return [];
    }
  }

  /**
   * 获取搜索统计信息（用于调试）
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      documentCount: this.miniSearch.documentCount,
      termCount: this.miniSearch.termCount,
    };
  }
}

module.exports = SearchEngine;
