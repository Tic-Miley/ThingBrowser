// 物功能表映射器（Thing Description Mapper）
// TDMapper.ts

// 将 “Thing Description JSON 英文文档” 单向转换为 “物功能表中文表格”

// TODO: 暂时能硬匹配转换 Demo 中的四份 TD 文档，需要在确定 TD 规范后设计更完备的双向映射规则


import type { Form, ThingDescription } from "@/types/td";

type AffordanceLike = {
  title?: string;
  type?: string;
  forms?: Form[];
  observable?: boolean;
  readOnly?: boolean;
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatTypeValue(typeValue: string | string[] | undefined): string {
  const values = toArray(typeValue).filter(Boolean);
  return values.length > 0 ? values.join("、") : "未提供";
}

function formatGeo(td: ThingDescription): string {
  const geo = td["platform:geo"];
  if (!geo) return "未提供";
  const lon = geo["platform:longitude"];
  const lat = geo["platform:latitude"];
  if (typeof lon !== "number" || typeof lat !== "number") return "未提供";
  return `${lon}°N，${lat}°E`;
}

function formatSecurityDefinitions(td: ThingDescription): string {
  const defs = td.securityDefinitions;
  if (!defs || Object.keys(defs).length === 0) return "未提供";
  const schemeMap: Record<string, string> = {
    nosec: "无鉴权",
    basic: "基础口令",
    digest: "摘要口令",
    bearer: "令牌",
    apikey: "密钥",
    oauth2: "统一授权",
    psk: "预共享密钥",
  };

  return Object.entries(defs)
    .map(([name, config]) => {
      const rawScheme = config?.scheme ? String(config.scheme) : "";
      const schemeLabel = rawScheme ? schemeMap[rawScheme.toLowerCase()] || rawScheme : "";
      const scheme = schemeLabel ? `，方式 ${schemeLabel}` : "";
      return `${name}${scheme}`;
    })
    .join("；");
}

function pickFirstHref(forms?: Form[]): string {
  if (!forms || forms.length === 0) return "未提供";
  const href = forms[0]?.href;
  return href ? href : "未提供";
}

function pickDataType(item: AffordanceLike): string {
  const typeMap: Record<string, string> = {
    integer: "整数",
    number: "数值",
    string: "文本",
    boolean: "布尔",
    object: "对象",
    array: "数组",
  };
  const contentTypeMap: Record<string, string> = {
    "application/json": "JSON",
    "text/html": "HTML 文档",
    "video/mp4": "MP4 视频",
    "text/plain": "纯文本",
  };

  if (item.type) {
    const normalized = item.type.toLowerCase();
    return typeMap[normalized] || item.type;
  }
  const contentType = item.forms?.[0]?.contentType;
  if (!contentType) return "未提供";
  return contentTypeMap[contentType.toLowerCase()] || contentType;
}

function parseOps(forms?: Form[]): string[] {
  if (!forms || forms.length === 0) return [];
  const firstOp = forms[0]?.op;
  if (!firstOp) return [];
  return Array.isArray(firstOp) ? firstOp : [firstOp];
}

function pickReadableLabel(item: AffordanceLike): string {
  const flags: string[] = [];
  if (item.observable === true) {
    flags.push("可观测");
  }
  if (item.readOnly === true) {
    flags.push("只读");
  }
  if (item.readOnly === false) {
    flags.push("可写");
  }
  if (flags.length > 0) {
    return flags.join("，");
  }

  const ops = parseOps(item.forms);
  if (ops.length === 0) return "未说明";

  const result: string[] = [];
  if (ops.some((op) => op.toLowerCase().includes("observe") || op.toLowerCase().includes("subscribe"))) {
    result.push("可观测");
  }
  if (ops.some((op) => op.toLowerCase().includes("read"))) {
    result.push("只读");
  }
  if (ops.some((op) => op.toLowerCase().includes("write"))) {
    result.push("可写");
  }
  if (ops.some((op) => op.toLowerCase().includes("invoke"))) {
    result.push("可触发");
  }

  return result.length > 0 ? Array.from(new Set(result)).join("，") : "未说明";
}

function renderRows(sectionName: string, items: Record<string, AffordanceLike> | undefined): string {
  const entries = Object.entries(items || {});
  if (entries.length === 0) {
    return `
      <tr>
        <td class="cell section">${escapeHtml(sectionName)}</td>
        <td class="cell" colspan="4">暂无</td>
      </tr>
    `;
  }

  return entries
    .map(([key, item], index) => {
      const name = item.title || key;
      const sectionCell = index === 0
        ? `<td class="cell section" rowspan="${entries.length}">${escapeHtml(sectionName)}</td>`
        : "";

      return `
        <tr>
          ${sectionCell}
          <td class="cell">${escapeHtml(name)}</td>
          <td class="cell url">${escapeHtml(pickFirstHref(item.forms))}</td>
          <td class="cell">${escapeHtml(pickDataType(item))}</td>
          <td class="cell">${escapeHtml(pickReadableLabel(item))}</td>
        </tr>
      `;
    })
    .join("");
}

function buildThingTdTableHtml(td: ThingDescription): string {
  const title = td.title || "未命名物";
  const thingTypes = formatTypeValue(td["@type"]);
  const desc = td.description || "未提供";
  const address = td["platform:address"] || "未提供";
  const geo = formatGeo(td);
  const security = formatSecurityDefinitions(td);

  const propertiesRows = renderRows("属性", td.properties as Record<string, AffordanceLike> | undefined);
  const actionsRows = renderRows("动作", td.actions as Record<string, AffordanceLike> | undefined);
  const eventsRows = renderRows("事件", td.events as Record<string, AffordanceLike> | undefined);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} 物功能表</title>
  <style>
    :root {
      --bg: #f6f8f7;
      --card: #ffffff;
      --line: #d9e2de;
      --head: #e8efec;
      --subhead: #eef3f1;
      --text: #23312b;
      --muted: #5f6f67;
      --section: #dfe9e5;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 20px;
      background: linear-gradient(160deg, #f7faf9 0%, #edf3f0 100%);
      color: var(--text);
      font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif;
    }

    .panel {
      max-width: 1200px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(28, 56, 44, 0.08);
    }

    .header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, #f3f7f5 0%, #edf3f0 100%);
    }

    .title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .subtitle {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 13px;
    }

    .block {
      padding: 14px 18px 18px;
    }

    .block-title {
      margin: 6px 0 12px;
      font-size: 15px;
      font-weight: 700;
      color: #314239;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
    }

    th,
    td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      vertical-align: top;
      font-size: 13px;
      line-height: 1.55;
      word-break: break-word;
    }

    thead th {
      background: var(--head);
      text-align: left;
      font-weight: 700;
    }

    .subhead th {
      background: var(--subhead);
      font-weight: 700;
    }

    .cell.section {
      background: var(--section);
      width: 90px;
      text-align: center;
      font-weight: 700;
      color: #31433a;
    }

    .url {
      color: #35594b;
      font-family: "Consolas", "SFMono-Regular", monospace;
      font-size: 12px;
    }

    .hint {
      margin: 10px 2px 0;
      color: var(--muted);
      font-size: 12px;
    }

    @media (max-width: 860px) {
      body { padding: 12px; }
      th,
      td { padding: 8px 9px; font-size: 12px; }
      .title { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="header">
      <h1 class="title">${escapeHtml(title)} 物功能表</h1>
      <p class="subtitle">中文表格形式</p>
    </div>

    <div class="block">
      <h2 class="block-title">基本信息</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 170px;">字段</th>
            <th>内容</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>物名</td><td>${escapeHtml(title)}</td></tr>
          <tr><td>类型</td><td>${escapeHtml(thingTypes)}</td></tr>
          <tr><td>描述</td><td>${escapeHtml(desc)}</td></tr>
          <tr><td>地址</td><td>${escapeHtml(address)}</td></tr>
          <tr><td>经纬度</td><td>${escapeHtml(geo)}</td></tr>
          <tr><td>鉴权方式</td><td>${escapeHtml(security)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="block">
      <h2 class="block-title">信息三元组</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 100px;">分类</th>
            <th style="width: 180px;">名称</th>
            <th>URL</th>
            <th style="width: 160px;">数据类型</th>
            <th style="width: 140px;">可读性</th>
          </tr>
        </thead>
        <tbody>
          ${propertiesRows}
          ${actionsRows}
          ${eventsRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

export function buildThingTdLowCodeHtmlDataUrl(td: ThingDescription): string {
  const html = buildThingTdTableHtml(td);
  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}
