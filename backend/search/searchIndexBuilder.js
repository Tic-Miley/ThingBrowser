const fs = require('fs');
const path = require('path');
const MiniSearch = require('minisearch');
const { getPinyinForms } = require('./queryEnhancer');

/**
 * 搜索索引构建器
 * 负责从物TD文档构建全文搜索索引
 */
class SearchIndexBuilder {
  constructor() {
    this.miniSearch = null;
    this.documents = [];
  }

  /**
   * 从单个物TD文档提取搜索文档
   * @param {Object} thingTD - 物的Thing Description文档
   * @param {string} thingUrn - 物的URN
   * @returns {Object} 搜索文档对象
   */
  extractSearchDocument(thingTD, thingUrn) {
    const doc = {
      id: thingTD.id || thingUrn,
      urn: thingUrn,
      title: thingTD.title || '',
      address: thingTD['platform:address'] || '',
      types: '',
      description: thingTD.description || '',
      propertiesTitles: '',
      propertiesDescriptions: '',
      actionsTitles: '',
      actionsDescriptions: '',
      eventsTitles: '',
      eventsDescriptions: '',
      pinyin: '',
    };

    // 提取 @type 数组（物的类型/功能）
    if (Array.isArray(thingTD['@type'])) {
      doc.types = thingTD['@type'].join(' ');
    }

    // 提取 properties 字段中的 title 和 description
    if (thingTD.properties && typeof thingTD.properties === 'object') {
      const propertyTitles = [];
      const propertyDescriptions = [];
      Object.values(thingTD.properties).forEach(prop => {
        if (prop.title) propertyTitles.push(prop.title);
        if (prop.description) propertyDescriptions.push(prop.description);
      });
      doc.propertiesTitles = propertyTitles.join(' ');
      doc.propertiesDescriptions = propertyDescriptions.join(' ');
    }

    // 提取 actions 字段中的 title 和 description（未来兼容）
    if (thingTD.actions && typeof thingTD.actions === 'object') {
      const actionTitles = [];
      const actionDescriptions = [];
      Object.values(thingTD.actions).forEach(action => {
        if (action.title) actionTitles.push(action.title);
        if (action.description) actionDescriptions.push(action.description);
      });
      doc.actionsTitles = actionTitles.join(' ');
      doc.actionsDescriptions = actionDescriptions.join(' ');
    }

    // 提取 events 字段中的 title 和 description（未来兼容）
    if (thingTD.events && typeof thingTD.events === 'object') {
      const eventTitles = [];
      const eventDescriptions = [];
      Object.values(thingTD.events).forEach(event => {
        if (event.title) eventTitles.push(event.title);
        if (event.description) eventDescriptions.push(event.description);
      });
      doc.eventsTitles = eventTitles.join(' ');
      doc.eventsDescriptions = eventDescriptions.join(' ');
    }

    const richText = [
      doc.title,
      doc.address,
      doc.types,
    ].join(' ');

    doc.pinyin = getPinyinForms(richText).join(' ');

    return doc;
  }

  /**
   * 构建搜索索引
   * 从 backend/data/things/*.json 扫描所有TD文档并创建索引
   * @param {string} thingsDataPath - 物数据文件夹路径
   * @returns {MiniSearch} 构建完成的搜索索引对象
   */
  buildIndex(thingsDataPath) {
    const cjkRegex = /[\u3400-\u9fff]/;
    const asciiRegex = /[a-zA-Z0-9:_-]/;

    // 中文友好的 tokenizer：
    // 1) 英文/数字按词切分
    // 2) 中文生成单字 + 相邻双字词（例如“贵阳”）
    const tokenize = (text) => {
      if (!text) return [];
      const normalized = String(text)
        .replace(/[\s/\\|,.;:!?()[\]{}"'`~]+/g, ' ')
        .trim();

      const tokens = [];
      let asciiBuffer = '';
      let prevCjk = '';

      for (const ch of normalized) {
        if (asciiRegex.test(ch)) {
          if (prevCjk) prevCjk = '';
          asciiBuffer += ch.toLowerCase();
          continue;
        }

        if (asciiBuffer) {
          tokens.push(asciiBuffer);
          asciiBuffer = '';
        }

        if (cjkRegex.test(ch)) {
          tokens.push(ch);
          if (prevCjk) tokens.push(prevCjk + ch);
          prevCjk = ch;
        } else {
          prevCjk = '';
        }
      }

      if (asciiBuffer) tokens.push(asciiBuffer);
      return tokens;
    };

    // 初始化 MiniSearch，定义字段及其权重
    this.miniSearch = new MiniSearch({
      fields: [
        'urn',
        'title',
        'address',
        'types',
        'propertiesTitles',
        'propertiesDescriptions',
        'actionsTitles',
        'actionsDescriptions',
        'eventsTitles',
        'eventsDescriptions',
        'description',
        'pinyin',
      ],
      idField: 'id',
      storeFields: ['id', 'urn', 'title', 'address'],
      tokenize,
      processTerm: (term) => term,
    });

    this.documents = [];

    // 扫描 things 文件夹中的所有 .json 文件
    if (!fs.existsSync(thingsDataPath)) {
      console.warn(`搜索数据路径不存在: ${thingsDataPath}`);
      return this.miniSearch;
    }

    const files = fs.readdirSync(thingsDataPath).filter(f => f.endsWith('.json'));
    
    files.forEach(file => {
      const filePath = path.join(thingsDataPath, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const thingTD = JSON.parse(fileContent);
        
        // 从 TD 文档中提取 URN
        const thingUrn = thingTD.id;
        if (!thingUrn) {
          console.warn(`文件 ${file} 缺少 id 字段`);
          return;
        }

        // 构建搜索文档并添加到索引
        const searchDoc = this.extractSearchDocument(thingTD, thingUrn);
        this.documents.push(searchDoc);
        this.miniSearch.add(searchDoc);

        console.log(`✓ 已加载物TD文档: ${thingUrn} (${file})`);
        console.log(`  - title: ${searchDoc.title}`);
        console.log(`  - types: ${searchDoc.types}`);
        console.log(`  - address: ${searchDoc.address}`);
      } catch (error) {
        console.error(`解析文件 ${file} 失败: ${error.message}`);
      }
    });

    console.log(`\n搜索引擎已准备就绪，共加载 ${this.documents.length} 个物节点`);
    console.log(`索引统计 - 文档数: ${this.miniSearch.documentCount}, 词项数: ${this.miniSearch.termCount}`);
    return this.miniSearch;
  }

  /**
   * 获取构建好的索引对象
   * @returns {MiniSearch} MiniSearch 索引
   */
  getIndex() {
    return this.miniSearch;
  }

  /**
   * 获取所有搜索文档（用于调试）
   * @returns {Array} 搜索文档数组
   */
  getDocuments() {
    return this.documents;
  }
}

module.exports = SearchIndexBuilder;
