# Nightreign Map Recogniser

Nightreign Map Recogniser 是一个用于识别和交互式探索游戏地图的应用程序，特别设计用于识别地图上的兴趣点（POI）并提供用户友好的界面来分析和操作地图数据。

感谢：

[thefifthmatt](https://github.com/thefifthmatt) 提供地图数据

[thanosapollo](https://github.com/thanosapollo) 提供识别器基础代码

[Fuwish](https://space.bilibili.com/46397427) 提供汉化版地图种子


你可以通过以下站点访问此工具：
- **beta版** [here](https://liqixian19970305.github.io/nightreign-mapseed-recogniser/)
- **稳定版** [here](https://dsm.lixiangzj.xyz:7443/nightreign-mapseed-recogniser-master/)

## 功能特点

- **地图识别**：通过预定义的模式识别地图上的兴趣点（POI）。
- **交互式界面**：提供直观的用户界面，支持点击、选择和操作地图上的兴趣点。
- **多地图支持**：支持多种地图和夜之领主（Nightlord）选择，用户可以切换不同的地图进行分析。
- **兴趣点分类**：能够对地图上的兴趣点进行分类和标记。
- **种子数据支持**：支持加载和分析种子数据，帮助用户识别特定的地图特征。

## 使用方法

1. **启动服务器**：
   - 确保你已经安装了 Node.js。
   - 在项目目录中运行 `node server.js` 启动本地服务器。
   - 打开浏览器并访问 `http://localhost:3000`。

2. **选择地图和夜之领主**：
   - 在界面中选择一个夜之领主和对应的地图。
   - 点击“继续”按钮进入地图交互界面。

3. **交互操作**：
   - 点击地图上的兴趣点以查看详细信息。
   - 使用右键菜单对兴趣点进行分类或标记。
   - 使用工具按钮进行重置、帮助和分类操作。

4. **查看结果**：
   - 在结果部分查看识别出的兴趣点和相关数据。
   - 使用种子计数器跟踪已识别的种子数量。

## 技术细节

- **前端**：使用 HTML、CSS 和 JavaScript 构建交互式用户界面。
- **后端**：使用 Node.js 提供本地服务器支持。
- **图像处理**：通过 Canvas 元素进行地图和兴趣点的绘制与交互。
- **数据管理**：使用 JSON 文件存储地图、兴趣点和种子数据。

## 贡献指南

欢迎贡献代码和改进项目。请遵循以下步骤：

1. Fork 本仓库。
2. 创建新分支 (`git checkout -b feature/new-feature`)。
3. 提交更改 (`git commit -m 'Add new feature'`)。
4. 推送至分支 (`git push origin feature/new-feature`)。
5. 创建 Pull Request。

## 许可证

本项目使用 MIT 许可证。详情请查看 LICENSE 文件。