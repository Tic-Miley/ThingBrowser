const SearchIndexBuilder = require('./searchIndexBuilder');
const SearchEngine = require('./searchEngine');
const path = require('path');

/**
 * 初始化搜索引擎
 * @param {string} backendDir - backend 文件夹的绝对路径
 * @returns {SearchEngine} 初始化完成的搜索引擎实例
 */
function initializeSearchEngine(backendDir) {
  const thingsDataPath = path.join(backendDir, 'things', 'TD');

  // 构建索引
  const builder = new SearchIndexBuilder();
  const miniSearch = builder.buildIndex(thingsDataPath);
  
  // 获取所有构建的文档
  const allDocuments = builder.getDocuments();

  // 创建搜索引擎实例
  const searchEngine = new SearchEngine(miniSearch, thingsDataPath);
  
  // 传递所有文档给搜索引擎，用于后备搜索
  searchEngine.setAllDocuments(allDocuments);

  return searchEngine;
}

module.exports = {
  initializeSearchEngine,
  SearchEngine,
  SearchIndexBuilder,
};
