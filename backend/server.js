const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { initializeSearchEngine } = require('./search');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'mock_secret_key_for_iotlab'; // 测试用的JWT密钥

// ======================================
// 搜索引擎初始化
// ======================================
let searchEngine = null;
try {
  searchEngine = initializeSearchEngine(__dirname);
  console.log('✓ 搜索引擎初始化成功');
} catch (error) {
  console.error('✗ 搜索引擎初始化失败:', error.message);
}

// 日志文件路径
const logFilePath = path.join(__dirname, 'server.log');

// 双端日志写入函数
function logMessage(msg) {
  // 1. 终端输出（保留实时观测）
  console.log(msg);
  // 2. 文件输出（持久化记录）
  fs.appendFile(logFilePath, msg + '\n', (err) => {
    if (err) console.error('写入日志文件失败:', err);
  });
}

// 1. 中间件：解析 JSON / 允许跨域
app.use(express.json());
app.use(cors());

// 2. 中间件：毫秒级高精度中文请求日志打印
function getHighPrecisionTime() {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

app.use((req, res, next) => {
  const startTime = process.hrtime();
  
  // 提取请求载荷
  let reqPayloadStr = '';
  if (Object.keys(req.query).length) reqPayloadStr += ` | Query: ${JSON.stringify(req.query)}`;
  if (req.body && Object.keys(req.body).length) reqPayloadStr += ` | Body: ${JSON.stringify(req.body)}`;

  // 后端收到请求时的日志，加入真实载荷
  logMessage(`[${getHighPrecisionTime()}] [后端收到] <- ${req.method} ${req.originalUrl} 来源: ${req.ip}${reqPayloadStr}`);

  // 拦截 res.send 或 res.json 以便捕获响应体数据
  const originalSend = res.send;
  let resBody;
  res.send = function (body) {
    resBody = body;
    return originalSend.apply(this, arguments);
  };

  // 监听响应发送完毕的事件
  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const duration = Math.round(diff[0] * 1000 + diff[1] / 1000000);
    
    // 提取并限制响应载荷日志长度，防止刷屏
    let resStr = typeof resBody === 'string' ? resBody : JSON.stringify(resBody) || '';
    if (resStr.length > 500) {
      resStr = resStr.substring(0, 500) + '... (已截断)';
    }

    logMessage(`[${getHighPrecisionTime()}] [后端响应] -> ${res.statusCode}，耗时 ${duration}ms | Data: ${resStr}`);
  });

  next();
});

// ======================================
// API组 1: 认证与权限 (Auth API)
// ======================================
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // 作为 Mock 跑通逻辑：不对用户名密码刁难，只要填写了就发放一个永不过期的强权限 Token
  if (username && password) {
      const token = jwt.sign(
        { id: "mock_user_001", username: username, role: 'super_admin' }, 
        SECRET_KEY, 
        { expiresIn: '365d' }
      );
      
      return res.status(200).json({
          code: 200,
          msg: "登录成功",
          data: {
              token: token,
              user: { name: "本地测试工程师", role: "super_admin" }
          }
      });
  }

  return res.status(400).json({ code: 400, msg: "用户名或密码不能为空" });
});

// ======================================
// API组 2: 核心业务接口
// ======================================

// 2.1 拓扑树获取（优化：使用 ID 参数替代 path 参数）
app.get('/api/v1/namespace/children', (req, res) => {
    const idParam = req.query.id || null; // null 表示查询根节点
    const topologyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'things', 'topology.json'), 'utf8'));

    const root = {
      id: "root",
      title: "中国",
      type: "region",
      children: [topologyData]
    };

    // 构建 ID 索引以快速查询（优化查询性能）
    const idIndex = {};
    function indexNodes(node) {
      idIndex[node.id] = node;
      if (node.children) {
        node.children.forEach(child => indexNodes(child));
      }
    }
    indexNodes(root);

    logMessage(`[${getHighPrecisionTime()}] [模拟查询] -> 请求拓扑节点 id: ${idParam || 'root'}`);

    // 获取目标节点
    const targetNode = idParam ? idIndex[idParam] : root;

    if (!targetNode) {
        return res.status(404).json({ error: "Node not found", id: idParam });
    }

    // 优化响应格式：直接返回 children，移除冗余字段（path, hasChildren）
    const immediateChildren = (targetNode.children || []).map(child => ({
        id: child.id,
        title: child.title,
        type: child.type,
        thingUrn: child.thingUrn || null
    }));

    return res.status(200).json({
      children: immediateChildren
    });
  });

// 2.1.5 全局物节点搜索 (Search API) - 基于 MiniSearch 全文搜索引擎
app.get('/api/v1/things/search', (req, res) => {
  const query = req.query.q || '';
  logMessage(`[${getHighPrecisionTime()}] [搜索查询] -> 全局搜索物节点，关键词: '${query}'`);
  
  // 搜索引擎未初始化时返回空结果
  if (!searchEngine) {
    logMessage(`[${getHighPrecisionTime()}] [搜索错误] -> 搜索引擎未初始化`);
    return res.status(200).json([]);
  }

  try {
    // 执行搜索
    const results = searchEngine.search(query, {
      limit: 50,
      includeScores: false,
      includeMatchFields: false,
    });

    logMessage(`[${getHighPrecisionTime()}] [搜索完成] -> 返回 ${results.length} 条搜索结果`);
    return res.status(200).json(results);
  } catch (error) {
    logMessage(`[${getHighPrecisionTime()}] [搜索失败] -> ${error.message}`);
    return res.status(500).json({ code: 500, msg: "搜索失败", data: null });
  }
});

// 2.2 地图视野内物点检索 (Map Geo API)
app.get('/api/v1/things/geo', (req, res) => {
  const bbox = req.query.bbox;
  logMessage(`[${getHighPrecisionTime()}] [模拟查询] -> 请求地图区域物点 bbox: ${bbox || '空'}`);

  if (!bbox) {
    return res.status(400).json({ code: 400, msg: "缺少 bbox 参数" });
  }

  try {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    const thingsDir = path.join(__dirname, 'things', 'TD');
    const files = fs.readdirSync(thingsDir);
    const items = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const td = JSON.parse(fs.readFileSync(path.join(thingsDir, file), 'utf8'));
        const geo = td['platform:geo'];
        if (geo && typeof geo['platform:latitude'] === 'number' && typeof geo['platform:longitude'] === 'number') {
          const lat = geo['platform:latitude'];
          const lng = geo['platform:longitude'];
          // 判定经纬度是否在视口范围内
          if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
            items.push({
              urn: td.id,
              location: [lng, lat],
              type: Array.isArray(td['@type']) ? td['@type'] : (td['@type'] ? [td['@type']] : []),
              title: td.title
            });
          }
        }
      }
    }

    // 简化响应：直接返回物点数组，移除 code/msg 包装
    // 简化 type 从数组为单字符串（地图场景只需一个主分类）
    const simplified = items.map(item => ({
      urn: item.urn,
      location: item.location,
      type: Array.isArray(item.type) ? item.type[0] : item.type,
      title: item.title
    }));

    return res.status(200).json(simplified);
  } catch (error) {
    logMessage(`[${getHighPrecisionTime()}] [系统报错] -> BBOX区域检索失败: ${error.message}`);
    return res.status(500).json({ code: 500, msg: "内部错误", data: null });
  }
});

// 2.3 物模型详情 (Thing Description) 获取
app.get('/api/v1/things/:urn', (req, res) => {
  const urn = req.params.urn;
  logMessage(`[${getHighPrecisionTime()}] [模拟查询] -> 请求物模型 URN: ${urn}`);

  try {
    // URN格式通常为 urn:platform:thing:xxx
    const fileName = urn.split(':').pop() + '.json';
    const tdData = JSON.parse(fs.readFileSync(path.join(__dirname, 'things', 'TD', fileName), 'utf8'));
    
    // 注意：根据协议，TD 接口直接返回 JSON 对象，不包在 code/data 结构内
    return res.status(200).json(tdData);
  } catch (error) {
    logMessage(`[${getHighPrecisionTime()}] [系统报错] -> 找不到 URN 对应的文件: ${urn}`);
    return res.status(404).json({ error: "Thing not found" });
  }
});

// 2.3 动态属性模拟（主停车场静态车位）
let parkingSpaces = 150;
setInterval(() => {
  const diff = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
  parkingSpaces = Math.max(0, Math.min(200, parkingSpaces + diff));
}, 10000);

app.get('/api/v1/proxy/things/:urn/properties/remainingSpaces', (req, res) => {
  const urn = req.params.urn;
  // 模拟抖动数据 (30~50 之间)
  // const simulatedSpaces = Math.floor(Math.random() * 21) + 30;
  
  logMessage(`[${getHighPrecisionTime()}] [动态属性响应] -> 停车场 ${urn} 生成剩余车位: ${parkingSpaces}`);
  
  return res.status(200).json(parkingSpaces);
});

// 2.4 食堂属性模拟 (HTTP) - 人数估算
let canteenCount = 200;
setInterval(() => {
  const diffs = [-5, -2, 0, 2, 5];
  const diff = diffs[Math.floor(Math.random() * diffs.length)];
  canteenCount = Math.max(0, Math.min(400, canteenCount + diff));
}, 500);

app.get('/api/v1/proxy/things/:urn/properties/peopleCount', (req, res) => {
  const urn = req.params.urn;
  logMessage(`[${getHighPrecisionTime()}] [动态属性响应] -> 食堂 ${urn} 生成人数估算: ${canteenCount}`);
  return res.status(200).json(canteenCount);
});

// 2.5 食堂属性模拟 (HTML) - 今日菜谱
app.get('/api/v1/proxy/things/:urn/properties/todayMenu', (req, res) => {
  const urn = req.params.urn;
  try {
    const htmlPath = path.join(__dirname, 'mock-data/menu.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      logMessage(`[${getHighPrecisionTime()}] [文件响应] -> 食堂 ${urn} 请求今日菜谱 HTML`);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }
  } catch (err) {}
  
  return res.status(404).send('Menu not found');
});

// 健康检测路由
app.get('/', (req, res) => {
  res.send('IoT Lab Mock Backend is running.');
});

// 启动服务器
const server = app.listen(PORT, () => {
  logMessage(`\n========================================`);
  logMessage(`[${getHighPrecisionTime()}] Mock Server 已启动`);
  logMessage(`正在监听: http://localhost:${PORT}`);
  logMessage(`========================================\n`);
});

// ============================================
// 阶段四：WebSocket 真实视频流传输服务
// ============================================
const WebSocket = require('ws');
const { spawn } = require('child_process');

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  logMessage(`[${getHighPrecisionTime()}] [WebSocket通信] 收到新的长连接请求: ${req.url}`);
  
  if (req.url.includes('/events/peopleCount')) {
    // ======== 大楼闸门：人数动态推送 ========
    let gatePeopleCount = 100;
    let gateState = 0; // 0: 上班(+0/1/2), 1: 静默(+0), 2: 下班(-0/1/2)

    const stateTimer = setInterval(() => {
      gateState = (gateState + 1) % 3;
      logMessage(`[${getHighPrecisionTime()}] [WebSocket] 大楼闸门状态切换至: ${['上班', '静默', '下班'][gateState]}`);
    }, 10000);

    const pushTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      
      let diff = 0;
      if (gateState === 0) {
        diff = Math.floor(Math.random() * 3); // 0, 1, 2
      } else if (gateState === 2) {
        diff = -Math.floor(Math.random() * 3); // -0, -1, -2
      }
      
      if (diff !== 0 || gateState === 1) {
        gatePeopleCount = Math.max(0, Math.min(200, gatePeopleCount + diff));
        
        try {
          ws.send(JSON.stringify(gatePeopleCount));
        } catch (err) {
          logMessage(`[${getHighPrecisionTime()}] [WebSocket错误] 大楼闸门人数推送失败: ${err.message}`);
        }
      }
    }, 500);

    ws.on('close', () => {
      clearInterval(stateTimer);
      clearInterval(pushTimer);
      logMessage(`[${getHighPrecisionTime()}] [WebSocket] 大楼闸门人数推送通道关闭: ${req.url}`);
    });

    ws.on('error', (error) => {
      logMessage(`[${getHighPrecisionTime()}] [WebSocket错误] 大楼闸门连接出错: ${error.message}`);
      clearInterval(stateTimer);
      clearInterval(pushTimer);
    });

    logMessage(`[${getHighPrecisionTime()}] [WebSocket通信] 大楼闸门人数推送通道已建立: ${req.url}`);
    return; // 结束处理
  }

  if (!req.url.includes('/events/videoStream')) {
    ws.close(1008, 'Unsupported Endpoint');
    logMessage(`[${getHighPrecisionTime()}] [WebSocket通信错误] 不支持的端点: ${req.url}`);
    return;
  }

  const videoPath = path.join(__dirname, 'mock-data/mock-video.mp4');
  logMessage(`[${getHighPrecisionTime()}] [WebSocket通信] 视频流管道已建立，准备推流: ${videoPath}`);
  
  if (!fs.existsSync(videoPath)) {
    logMessage(`[${getHighPrecisionTime()}] [FFmpeg推流错误] 未找到视频文件: ${videoPath}，请在 backend 目录下放置该文件。`);
    ws.send(JSON.stringify({ frameType: "svg+xml", data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><text x="50" y="150" fill="red" font-size="20">Error: mock-video.mp4 缺失!</text></svg>').toString('base64') }));
    ws.close();
    return;
  }

  // 核心逻辑：创建 FFmpeg 进程，读取 MP4 并逐帧转换为 JPEG 图像推向 stdout
  const ffmpegParams = [
    '-re',                         // 按照视频真实帧率读取文件（实现模拟直播核心参数）
    '-stream_loop', '-1',          // -1 表示无限循环播放（老版本 ffmpeg 也写作 -loop 1）
    '-i', videoPath,               // 输入的视频文件路径
    '-vf', 'scale=640:-1',         // 缩放分辨率宽度至 640 以节约前后端性能及 WebSocket 带宽
    '-r', '15',                    // 固定输出帧率为 15 FPS
    '-f', 'image2pipe',            // 明确告诉 FFmpeg 将输出格式转为图像管道流
    '-vcodec', 'mjpeg',            // 图像编码格式设定为 Motion JPEG
    '-q:v', '5',                   // 图像压缩质量（数值越低质量越好，体积越大）
    'pipe:1'                       // 将流输出到管道1 (stdout)
  ];

  const ffmpegProc = spawn('ffmpeg', ffmpegParams);
  
  ffmpegProc.stderr.on('data', (data) => {
    // FFmpeg 的状态日志默认会灌入 stderr，如需调试可取消下方注释
    // console.log(`FFmpeg log: ${data}`);
  });

  // 处理由于网络缓冲带来的粘包/拆包，分割成一张张完整的 JPEG 帧进行发送
  let buffer = Buffer.alloc(0);
  const SOI = Buffer.from([0xff, 0xd8]); // JPEG Start Of Image marker
  const EOI = Buffer.from([0xff, 0xd9]); // JPEG End Of Image marker

  ffmpegProc.stdout.on('data', (chunk) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    buffer = Buffer.concat([buffer, chunk]);
    
    let startPos = buffer.indexOf(SOI);
    let endPos = buffer.indexOf(EOI, startPos);
    
    // 如果 Buffer 中包含了一张以上完整的 JPEG
    while (startPos !== -1 && endPos !== -1) {
      const frameBuffer = buffer.subarray(startPos, endPos + 2); // +2 是为了包含 EOI 标记本身
      
      // 推送简化后的帧格式：{t: "jpeg", d: "base64"}
      ws.send(JSON.stringify({
        t: "jpeg",
        d: frameBuffer.toString('base64')
      }));
      
      // 将处理完的数据裁剪掉，保留多余未处理完的数据（拆包处理）
      buffer = buffer.subarray(endPos + 2);
      
      // 寻找下一个有可能在同一个包里的图像
      startPos = buffer.indexOf(SOI);
      endPos = startPos !== -1 ? buffer.indexOf(EOI, startPos) : -1;
    }
  });

  ws.on('close', () => {
    logMessage(`[${getHighPrecisionTime()}] [WebSocket通信] 客户端断开连接，准备中止 FFmpeg 进程。`);
    // 用户关闭弹窗，立即杀死底层的 FFmpeg 转码进程，释放 CPU 与内存资源
    if (ffmpegProc && !ffmpegProc.killed) {
      ffmpegProc.kill('SIGKILL');
    }
  });
});