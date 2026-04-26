# GIS 数据可视化预览器

一个纯前端的 GIS 数据可视化工具，支持多格式地理数据预览、叠加、样式编辑和格式转换。

## 功能特性

### 数据预览
- 📁 支持格式：**GeoJSON**、**Shapefile (SHP)**、**KML**
- 🗺️ 交互式地图预览（Leaflet）
- 🔢 点聚合功能（数据量大时自动聚合）

### 多图层管理
- 📚 多图层叠加显示
- ↑↓ 图层排序
- 👁️ 显示/隐藏切换
- 🎚️ 透明度调节

### 底图切换
- 🗺️ OpenStreetMap
- ☀️ CartoDB 浅色
- 🌙 CartoDB 深色
- 🛰️ Esri 卫星影像
- ⛰️ Esri 地形图

### 样式编辑
- 🎨 6 种预设配色
- 自定义边框/填充颜色
- 点半径、线宽度调节
- 填充/边框透明度控制

### 属性查看
- 📊 完整属性数据表格
- 🔍 关键词搜索
- ↕️ 列排序
- 📄 分页显示

### 数据编辑
- ✏️ 绘制点、线、面、矩形
- 🔄 拖拽修改位置
- 🗑️ 删除要素

### 格式转换
- 📥 导出 GeoJSON
- 🌐 导出 KML
- 📦 导出 Shapefile (zip)

## 技术栈

- **Vue 3** + **Vite**
- **Leaflet** - 地图渲染
- **leaflet.markercluster** - 点聚合
- **leaflet-draw** - 数据编辑
- **shpjs** - SHP 解析
- **@tmcw/togeojson** - KML 转 GeoJSON
- **JSZip** - ZIP 打包
- **tokml** - GeoJSON 转 KML
- **file-saver** - 文件下载

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 部署到 GitHub Pages
npm run deploy
```

## 部署

### GitHub Pages

1. 推送代码到 GitHub
2. 运行 `npm run build && npm run deploy`
3. 在仓库 Settings → Pages 中选择 gh-pages 分支
4. 访问 `https://用户名.github.io/gis-viewer/`

### Netlify

1. 访问 [app.netlify.com/drop](https://app.netlify.com/drop)
2. 将 `dist` 文件夹拖拽到网页中即可部署

## 使用说明

1. **上传文件** - 拖拽或点击上传 GeoJSON/SHP/KML 文件
2. **预览地图** - 地图自动显示并适配范围
3. **切换底图** - 右上角按钮切换底图样式
4. **管理图层** - 右侧面板控制图层顺序、透明度、可见性
5. **查看属性** - 点击 📊 查看属性表格
6. **编辑样式** - 点击 🎨 自定义颜色、线宽等
7. **导出数据** - 点击 📥 选择目标格式导出
8. **编辑数据** - 点击顶部「编辑模式」启用绘制工具

## License

MIT
