"""
村户信息管理系统 - Flask 主应用
单机运行，一键启动。
"""

import os
import sys

from flask import Flask, render_template, send_from_directory

from config import (
    BASE_DIR, DATABASE_PATH, UPLOAD_FOLDER, PHOTO_FOLDER,
    SECRET_KEY, DEBUG, HOST, PORT,
    UI_CONFIG, HOUSE_TYPES, RELATIONS, GENDERS, DEFAULT_GROUPS,
    GROUP_AERIAL_MAPS, DEFAULT_AERIAL_GROUP,
    AERIAL_IMAGE, AERIAL_WIDTH, AERIAL_HEIGHT,
)
from models import db


def create_app():
    """创建 Flask 应用（工厂模式）"""
    app = Flask(__name__, static_folder="static", template_folder="templates")

    # 基础配置
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.config["PHOTO_FOLDER"] = PHOTO_FOLDER
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB

    # 确保目录存在
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(PHOTO_FOLDER, exist_ok=True)

    # 初始化数据库
    db.init_app(app)
    with app.app_context():
        from models import Household, Member  # noqa: F401
        db.create_all()

    # 注册蓝图
    from routes import api
    app.register_blueprint(api)

    # ==================== 静态文件路由 ====================

    @app.route("/uploads/photos/<filename>")
    def uploaded_photo(filename):
        return send_from_directory(PHOTO_FOLDER, filename)

    # ==================== 前端页面 ====================

    @app.route("/")
    def index():
        """主页面，注入配置到前端"""
        # 构建分组航拍图列表（供前端组选择器使用）
        aerial_groups = list(GROUP_AERIAL_MAPS.keys()) if GROUP_AERIAL_MAPS else []
        # 构建前端配置（URL前缀为 /static/）
        group_aerial_config = {}
        for g, cfg in GROUP_AERIAL_MAPS.items():
            group_aerial_config[g] = {
                "image": f"/static/{cfg['image']}",
                "width": cfg["width"],
                "height": cfg["height"],
            }
        return render_template("index.html",
            title=UI_CONFIG["title"],
            subtitle=UI_CONFIG["subtitle"],
            group_aerial_config=group_aerial_config,
            default_aerial_group=DEFAULT_AERIAL_GROUP if GROUP_AERIAL_MAPS else "",
            aerial_groups=aerial_groups,
            # 兼容旧版单图
            aerial_image=AERIAL_IMAGE,
            aerial_width=AERIAL_WIDTH,
            aerial_height=AERIAL_HEIGHT,
            house_types=HOUSE_TYPES,
            relations=RELATIONS,
            genders=GENDERS,
            default_groups=DEFAULT_GROUPS,
            enable_photo=UI_CONFIG["enable_photo_upload"],
            items_per_page=UI_CONFIG["items_per_page"],
        )

    return app


if __name__ == "__main__":
    app = create_app()
    print(f"\n{'='*60}")
    print(f"  村户信息管理系统 已启动")
    print(f"  访问地址: http://{HOST}:{PORT}")
    print(f"  按 Ctrl+C 停止服务")
    print(f"{'='*60}\n")
    app.run(host=HOST, port=PORT, debug=DEBUG)
