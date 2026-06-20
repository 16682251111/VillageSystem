# 村户信息管理系统 - 开发文档

## 1. 项目概述

完全离线、单机运行的村户信息管理系统。支持 Excel 台账导入、**本地航拍图**住户标注、增删改查与多维度筛选。

**技术栈**：Python 3.8+ / Flask / SQLite / 原生 JavaScript / Leaflet.js（本地引用）

---

## 2. 快速启动

### ① 放入你的航拍图
将村庄航拍图放入 `static/` 目录，然后修改 `config.py`：
```python
AERIAL_IMAGE = "你的航拍图.jpg"   # 文件名
AERIAL_WIDTH = 4000               # 图片实际宽度（像素）
AERIAL_HEIGHT = 3000              # 图片实际高度（像素）
```

### ② 启动系统

**Windows**：双击 `run.bat`

**Linux/Mac**：
```bash
chmod +x run.sh && ./run.sh
```

**手动启动**：
```bash
pip install -r requirements.txt
python app.py
```

浏览器访问：**http://127.0.0.1:5000**

---

## 3. 项目结构

```
VillageSystem/
├── app.py                 # Flask 主应用（工厂模式）
├── config.py              # 配置文件（数据模板抽象，迁移核心）
├── models.py              # SQLite 数据模型（Household + Member）
├── routes.py              # API 路由（CRUD + Excel导入 + 统计）
├── requirements.txt       # Python 依赖
├── run.bat                # Windows 一键启动
├── run.sh                 # Linux/Mac 一键启动
├── static/
│   ├── css/style.css      # 全局样式
│   └── js/
│       ├── main.js        # 主入口 & 工具函数
│       ├── map.js         # Leaflet 地图模块
│       └── table.js       # 数据表格 & CRUD 交互
├── templates/
│   └── index.html         # 单页面主界面
├── data/                  # 自动创建 - 数据库存储
├── uploads/photos/        # 自动创建 - 照片存储
└── README.md              # 本文档
```

---

## 4. 数据模型

### Household（户信息表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| house_number | VARCHAR(50) | 户编号（唯一） |
| householder_name | VARCHAR(50) | 户主姓名 |
| householder_phone | VARCHAR(20) | 联系电话 |
| group_name | VARCHAR(50) | 村民小组 |
| house_type | VARCHAR(20) | 户类型 |
| address | VARCHAR(200) | 地址 |
| latitude | FLOAT | X 坐标（航拍图横轴像素） |
| longitude | FLOAT | Y 坐标（航拍图纵轴像素） |
| photo_path | VARCHAR(500) | 照片路径 |
| notes | TEXT | 备注 |

### Member（成员表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| household_id | INTEGER | 外键 → households.id |
| name | VARCHAR(50) | 姓名 |
| id_card | VARCHAR(30) | 身份证号 |
| phone | VARCHAR(20) | 联系电话 |
| relation | VARCHAR(20) | 与户主关系 |
| gender | VARCHAR(5) | 性别 |
| birth_date | VARCHAR(20) | 出生日期 |
| notes | TEXT | 备注 |

---

## 5. API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/households | 户列表（支持 keyword/type/group 筛选，分页） |
| GET | /api/households/:id | 户详情（含成员列表） |
| POST | /api/households | 新增户 |
| PUT | /api/households/:id | 编辑户 |
| DELETE | /api/households/:id | 删除户（级联删除成员） |
| GET | /api/households/:id/members | 获取某户成员 |
| POST | /api/households/:id/members | 添加成员 |
| PUT | /api/members/:id | 编辑成员 |
| DELETE | /api/members/:id | 删除成员 |
| POST | /api/households/upload-photo | 上传照片 |
| POST | /api/import-excel | 导入 Excel 台账 |
| GET | /api/stats | 统计数据 |
| GET | /api/map-data | 地图标注数据 |

---

## 6. Excel 导入格式

### 工作表 1：「户信息」
| 户编号 | 户主姓名 | 联系电话 | 村民小组 | 户类型 | 地址 | X坐标 | Y坐标 | 备注 |
|--------|----------|----------|----------|--------|------|-------|-------|------|
| H001 | 张三 | 138xxxx | 一组 | 一般户 | xx村xx号 | 1200 | 800 | |

### 工作表 2：「成员信息」
| 户编号 | 姓名 | 身份证号 | 联系电话 | 与户主关系 | 性别 | 出生日期 | 备注 |
|--------|------|----------|----------|------------|------|----------|------|
| H001 | 李四 | 420xxx | 139xxxx | 配偶 | 女 | 1985-03 | |

> 列名支持模糊匹配，如"户编号"/"编号"/"序号"均可识别。

---

## 7. 迁移指南

要将系统迁移到其他村庄，只需修改 `config.py`：

```python
# 地图默认中心点
MAP_DEFAULT_CENTER = {"lat": 30.5, "lng": 114.3}

# 户类型选项
HOUSE_TYPES = ["一般户", "低保户", "五保户", ...]

# 村民小组
DEFAULT_GROUPS = ["一组", "二组", "三组", ...]

# Excel 列映射（按需调整别名）
HOUSEHOLD_EXCEL_COLUMNS = { ... }
```

---

## 8. 离线部署说明

> 本项目设计为完全离线运行。除 Leaflet JS/CSS 通过国内 CDN 加载首次外，不依赖任何在线服务。

| 资源 | 来源 | 说明 |
|------|------|------|
| Leaflet CSS/JS | `cdn.bootcdn.net`（国内 CDN） | 仅首次加载，之后浏览器缓存 |
| 地图底图 | 本地航拍图 `static/aerial.jpg` | **完全本地，无需网络** |
| 数据库 | 本地 SQLite `data/village.db` | 单文件，可直接复制迁移 |

**完全零网络方案**：将 Leaflet JS/CSS 下载到 `static/` 目录，修改 `index.html` 引用路径即可。

---

## 9. 开发日志

| 日期 | 内容 |
|------|------|
| 2026-06-20 | 项目初始化，完成整体架构设计与实现 |
| 2026-06-20 | 实现户/成员 CRUD、Excel导入、地图联动 |
| 2026-06-20 | 完成前后端分离的单页面应用界面 |
| 2026-06-20 | 添加一键启动脚本和迁移配置抽象 |
| 2026-06-20 | **地图改为本地航拍图**：移除在线瓦片，用 `L.CRS.Simple` + `imageOverlay` 加载本地航拍图，坐标系统改为像素坐标 |

---

## 10. 依赖

- **Python 3.8+**
- Flask ≥ 2.3.0
- Flask-SQLAlchemy ≥ 3.0.0
- openpyxl ≥ 3.1.0
- Leaflet 1.9.4（前端 CDN）
