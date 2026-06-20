"""
村户信息管理系统 - 配置文件
所有字段映射、模板配置均在此抽象，便于迁移到其他村庄。
"""

import os

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 数据库配置
DATABASE_PATH = os.path.join(BASE_DIR, "data", "village.db")

# 上传文件目录
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
PHOTO_FOLDER = os.path.join(UPLOAD_FOLDER, "photos")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}

# Flask 配置
SECRET_KEY = "village-system-secret-key-2024"
DEBUG = True
HOST = "127.0.0.1"
PORT = 5000

# ========== 数据模板配置（迁移时修改此处） ==========

# 航拍图配置（按村民小组分组，每组一张航拍图）
# 将你的航拍图放入 static/ 目录，格式如下：
#   static/aerial_group1.jpg    ← 一组
#   static/aerial_group2.jpg    ← 二三五组
#   static/aerial_group3.jpg    ← 四六组
# 注意：每组坐标独立，标记像素坐标相对于该组的航拍图
GROUP_AERIAL_MAPS = {
    "一组": {"image": "aerial_group1.jpg", "width": 4000, "height": 3008},
    "二三五组": {"image": "aerial_group235.jpg", "width": 4000, "height": 3008},
    "四六组": {"image": "aerial_group46.jpg", "width": 4000, "height": 3008},
}
# 默认显示的小组（打开页面时显示的航拍图）
DEFAULT_AERIAL_GROUP = "一组"

# 兼容旧版单图配置（如果 GROUP_AERIAL_MAPS 为空则使用此项）
AERIAL_IMAGE = "aerial_group1.jpg"
AERIAL_WIDTH = 4000
AERIAL_HEIGHT = 3008

# 户类型选项（可根据实际村庄调整）
HOUSE_TYPES = [
    "一般户",
    "低保户",
    "五保户",
    "脱贫户",
    "监测户",
    "其他"
]

# 与户主关系选项
RELATIONS = [
    "户主",
    "配偶",
    "子",
    "女",
    "父亲",
    "母亲",
    "孙子",
    "孙女",
    "其他"
]

# 性别选项
GENDERS = ["男", "女"]

# 村民小组（可动态添加）
DEFAULT_GROUPS = ["一组", "二组", "三组", "四组", "五组"]

# Excel 导入模板 - 户信息工作表列映射
# key: 数据库字段, value: Excel 列名（支持多个别名，模糊匹配）
HOUSEHOLD_EXCEL_COLUMNS = {
    "house_number": ["户编号", "编号", "序号", "农户编号", "户号", "家庭编号"],
    "householder_name": ["户主姓名", "户主", "姓名", "户主名字", "户主名"],
    "householder_phone": ["联系电话", "电话", "手机号", "联系方式", "户主电话", "手机号码"],
    "group_name": ["村民小组", "组名", "小组", "所属小组", "村民组", "分组"],
    "house_type": ["户类型", "类型", "农户类型", "家庭类型", "属性"],
    "address": ["地址", "住址", "详细地址", "家庭住址", "现住址"],
    "latitude": ["X坐标", "x坐标", "横坐标", "x", "X", "图上X"],
    "longitude": ["Y坐标", "y坐标", "纵坐标", "y", "Y", "图上Y"],
    "notes": ["备注", "说明", "其他"],
    "photo_path": ["照片路径", "照片", "图片", "照片地址"],
}

# Excel 导入模板 - 成员信息工作表列映射
MEMBER_EXCEL_COLUMNS = {
    "house_number": ["户编号", "编号", "所属户编号", "户号", "家庭编号", "所属户"],
    "name": ["姓名", "成员姓名", "名字", "家庭成员"],
    "id_card": ["身份证号", "证件号", "身份证", "身份证号码"],
    "phone": ["联系电话", "电话", "手机号", "联系方式", "手机号码"],
    "relation": ["与户主关系", "关系", "家庭关系", "亲属关系"],
    "gender": ["性别"],
    "birth_date": ["出生日期", "生日", "出生年月", "出生年月日"],
    "notes": ["备注", "说明"],
}

# 界面显示配置
UI_CONFIG = {
    "title": "村户信息管理系统",
    "subtitle": "Village Household Management System",
    "enable_photo_upload": True,
    "items_per_page": 20,
}
