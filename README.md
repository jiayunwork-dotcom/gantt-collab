# Gantt Collab - 多人实时协作甘特图工具

浏览器端多人实时协作的项目排期甘特图工具。

## 技术栈

- **前端**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **后端**: NestJS 10 + TypeORM + Socket.IO
- **数据库**: PostgreSQL 16
- **缓存/PubSub**: Redis 7
- **实时通信**: WebSocket (Socket.IO) + Redis Pub/Sub
- **容器化**: Docker Compose

## 功能特性

### 任务管理
- 任务属性: 名称、负责人、开始/结束日期、进度百分比、优先级(紧急/高/中/低)、自定义标签
- 任务分组: 树形父子结构,子任务时间范围不超出父任务
- 里程碑: 零工期特殊任务,菱形标记

### 依赖关系
- 四种类型: FS(完成开始)、FF(完成完成)、SS(开始开始)、SF(开始完成)
- 提前量/延迟量 (lag)
- SVG箭头连线,循环依赖检测拒绝

### 甘特图视图
- 四档缩放: 日/周/月/季
- 任务条拖拽: 移动起止日期和工期
- 左侧任务列表与右侧时间条联动滚动
- dnd-kit拖拽排序

### 关键路径
- CPM算法计算 ES/EF/LS/LF/总浮动时间
- 关键路径红色高亮
- 非关键任务显示浮动时间条

### 资源管理
- 人员列表: 姓名、角色、每日可用工时
- 资源负载图: 按天柱状图,超限标红
- 资源冲突警告图标

### 多人协作
- Redis Pub/Sub多实例广播
- 用户光标颜色标识
- 任务编辑态锁定高亮
- 最后写入生效 + 冲突通知
- 实时同步所有变更

### 基线对比
- 最多保留5个基线版本
- 灰色虚线叠加对比
- 偏差超3天自动预警

### 导入导出
- CSV导入导出(列映射配置)
- JSON格式导入导出

### 权限系统
- 三级权限: 所有者 / 编辑者 / 查看者
- UUID邀请链接,支持有效期

## 快速启动

```bash
# 复制环境变量
cp .env.example .env

# 启动所有服务
docker-compose up -d --build

# 访问
# 前端: http://localhost
# 后端API: http://localhost/api
# WebSocket: ws://localhost/socket.io
```

## 项目结构

```
.
├── backend/                    # NestJS 后端
│   ├── src/
│   │   ├── entities/           # TypeORM 实体
│   │   ├── modules/
│   │   │   ├── auth/           # JWT认证
│   │   │   ├── users/          # 用户
│   │   │   ├── projects/       # 项目+权限+邀请
│   │   │   ├── tasks/          # 任务+依赖+关键路径
│   │   │   ├── resources/      # 资源+负载
│   │   │   ├── baselines/      # 基线
│   │   │   ├── import-export/  # CSV/JSON
│   │   │   ├── collaboration/  # WebSocket实时协作
│   │   │   └── redis/          # Redis客户端
│   │   ├── common/             # 守卫、装饰器
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── Dockerfile
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/                # App Router页面
│   │   ├── components/
│   │   │   ├── gantt/          # 甘特图核心
│   │   │   ├── task-list/      # 任务列表
│   │   │   ├── resource-chart/ # 资源负载图
│   │   │   ├── collaboration/  # 协作UI
│   │   │   ├── baseline/       # 基线选择器
│   │   │   ├── permissions/    # 权限面板
│   │   │   └── import-export/  # 导入导出
│   │   └── lib/                # API、Socket、类型
│   └── Dockerfile
├── nginx/                      # Nginx反向代理
├── docker-compose.yml
└── .env.example
```
