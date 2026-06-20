"""
村户信息管理系统 - API 路由
提供户/成员的 CRUD、Excel 导入、搜索筛选等接口。
"""

import os
import re
import uuid
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from models import db, Household, Member
from config import ALLOWED_EXTENSIONS, HOUSEHOLD_EXCEL_COLUMNS, MEMBER_EXCEL_COLUMNS

api = Blueprint("api", __name__, url_prefix="/api")


# ==================== 工具函数 ====================

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_photo(file):
    """保存照片，返回访问路径"""
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit(".", 1)[1].lower()
        new_name = f"{uuid.uuid4().hex}.{ext}"
        photo_dir = current_app.config.get("PHOTO_FOLDER")
        os.makedirs(photo_dir, exist_ok=True)
        filepath = os.path.join(photo_dir, new_name)
        file.save(filepath)
        return f"/uploads/photos/{new_name}"
    return ""


# ==================== 户 CRUD ====================

@api.route("/households", methods=["GET"])
def list_households():
    """获取户列表，支持搜索、筛选、分页"""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    keyword = request.args.get("keyword", "").strip()
    house_type = request.args.get("house_type", "").strip()
    group_name = request.args.get("group_name", "").strip()

    query = Household.query

    if keyword:
        pattern = f"%{keyword}%"
        query = query.outerjoin(Member).filter(
            db.or_(
                Household.householder_name.like(pattern),
                Household.house_number.like(pattern),
                Household.householder_phone.like(pattern),
                Member.name.like(pattern),
                Member.phone.like(pattern),
            )
        ).distinct()

    if house_type:
        query = query.filter(Household.house_type == house_type)
    if group_name:
        query = query.filter(Household.group_name == group_name)

    query = query.order_by(Household.house_number)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "code": 0,
        "data": {
            "items": [h.to_dict() for h in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
            "per_page": pagination.per_page,
        }
    })


@api.route("/households/<int:hh_id>", methods=["GET"])
def get_household(hh_id):
    """获取单个户详情（含成员）"""
    hh = Household.query.get_or_404(hh_id)
    return jsonify({"code": 0, "data": hh.to_dict(include_members=True)})


@api.route("/households", methods=["POST"])
def create_household():
    """新增户"""
    data = request.get_json(silent=True) or {}
    house_number = data.get("house_number", "").strip()
    if not house_number:
        return jsonify({"code": 1, "msg": "户编号不能为空"}), 400

    if Household.query.filter_by(house_number=house_number).first():
        return jsonify({"code": 1, "msg": f"户编号 {house_number} 已存在"}), 400

    hh = Household(
        house_number=house_number,
        householder_name=data.get("householder_name", ""),
        householder_phone=data.get("householder_phone", ""),
        group_name=data.get("group_name", ""),
        house_type=data.get("house_type", "一般户"),
        address=data.get("address", ""),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        photo_path=data.get("photo_path", ""),
        notes=data.get("notes", ""),
    )
    db.session.add(hh)
    db.session.commit()
    return jsonify({"code": 0, "data": hh.to_dict(), "msg": "新增成功"})


@api.route("/households/<int:hh_id>", methods=["PUT"])
def update_household(hh_id):
    """编辑户信息"""
    hh = Household.query.get_or_404(hh_id)
    data = request.get_json(silent=True) or {}

    # 如果修改了户编号，检查唯一性
    new_number = data.get("house_number", "").strip()
    if new_number and new_number != hh.house_number:
        if Household.query.filter_by(house_number=new_number).first():
            return jsonify({"code": 1, "msg": f"户编号 {new_number} 已存在"}), 400
        hh.house_number = new_number

    for field in ["householder_name", "householder_phone", "group_name",
                  "house_type", "address", "notes", "photo_path"]:
        if field in data:
            setattr(hh, field, data[field])
    for field in ["latitude", "longitude"]:
        if field in data:
            val = data[field]
            setattr(hh, field, float(val) if val not in (None, "") else None)

    db.session.commit()
    return jsonify({"code": 0, "data": hh.to_dict(), "msg": "更新成功"})


@api.route("/households/<int:hh_id>", methods=["DELETE"])
def delete_household(hh_id):
    """删除户（级联删除成员）"""
    hh = Household.query.get_or_404(hh_id)
    db.session.delete(hh)
    db.session.commit()
    return jsonify({"code": 0, "msg": "删除成功"})


@api.route("/households/upload-photo", methods=["POST"])
def upload_photo():
    """上传照片"""
    file = request.files.get("file")
    if not file:
        return jsonify({"code": 1, "msg": "未选择文件"}), 400
    path = save_photo(file)
    if not path:
        return jsonify({"code": 1, "msg": "不支持的文件格式"}), 400
    return jsonify({"code": 0, "data": {"url": path}})


# ==================== 成员 CRUD ====================

@api.route("/households/<int:hh_id>/members", methods=["GET"])
def list_members(hh_id):
    """获取某户所有成员"""
    Household.query.get_or_404(hh_id)
    members = Member.query.filter_by(household_id=hh_id).all()
    return jsonify({"code": 0, "data": [m.to_dict() for m in members]})


@api.route("/households/<int:hh_id>/members", methods=["POST"])
def add_member(hh_id):
    """添加成员"""
    Household.query.get_or_404(hh_id)
    data = request.get_json(silent=True) or {}
    if not data.get("name", "").strip():
        return jsonify({"code": 1, "msg": "姓名不能为空"}), 400

    member = Member(
        household_id=hh_id,
        name=data.get("name", ""),
        id_card=data.get("id_card", ""),
        phone=data.get("phone", ""),
        relation=data.get("relation", ""),
        gender=data.get("gender", ""),
        birth_date=data.get("birth_date", ""),
        notes=data.get("notes", ""),
    )
    db.session.add(member)
    db.session.commit()
    return jsonify({"code": 0, "data": member.to_dict(), "msg": "添加成功"})


@api.route("/members/<int:m_id>", methods=["PUT"])
def update_member(m_id):
    """编辑成员"""
    member = Member.query.get_or_404(m_id)
    data = request.get_json(silent=True) or {}
    for field in ["name", "id_card", "phone", "relation", "gender", "birth_date", "notes"]:
        if field in data:
            setattr(member, field, data[field])
    db.session.commit()
    return jsonify({"code": 0, "data": member.to_dict(), "msg": "更新成功"})


@api.route("/members/<int:m_id>", methods=["DELETE"])
def delete_member(m_id):
    """删除成员"""
    member = Member.query.get_or_404(m_id)
    db.session.delete(member)
    db.session.commit()
    return jsonify({"code": 0, "msg": "删除成功"})


# ==================== 统计接口 ====================

@api.route("/stats", methods=["GET"])
def get_stats():
    """获取统计数据"""
    total = Household.query.count()
    total_members = Member.query.count()
    groups = [r[0] for r in db.session.query(Household.group_name).distinct() if r[0]]
    type_counts = {}
    for ht in db.session.query(Household.house_type, db.func.count(Household.id)).group_by(Household.house_type).all():
        if ht[0]:
            type_counts[ht[0]] = ht[1]

    # 有坐标的户（用于地图）
    with_coords = Household.query.filter(
        Household.latitude.isnot(None),
        Household.longitude.isnot(None)
    ).count()

    return jsonify({
        "code": 0,
        "data": {
            "total_households": total,
            "total_members": total_members,
            "groups": groups,
            "type_counts": type_counts,
            "with_coords": with_coords,
        }
    })


@api.route("/map-data", methods=["GET"])
def get_map_data():
    """获取地图标注数据（所有有坐标的户）"""
    households = Household.query.filter(
        Household.latitude.isnot(None),
        Household.longitude.isnot(None)
    ).all()
    return jsonify({
        "code": 0,
        "data": [{
            "id": h.id,
            "house_number": h.house_number,
            "householder_name": h.householder_name,
            "house_type": h.house_type,
            "group_name": h.group_name,
            "latitude": h.latitude,
            "longitude": h.longitude,
            "member_count": h.members.count(),
        } for h in households]
    })


# ==================== Excel 导入 ====================

def _find_column_index(headers, aliases):
    """根据别名列表找到 Excel 列索引"""
    for i, h in enumerate(headers):
        h_clean = str(h).strip()
        if h_clean in aliases:
            return i
    return None


def _safe_str(val):
    """安全转换为字符串"""
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    return str(val).strip()


def _safe_float(val):
    """安全转换为浮点数"""
    if val is None or str(val).strip() == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _find_column_index_fuzzy(headers, aliases):
    """根据别名列表模糊匹配 Excel 列索引（去除空格、兼容换行）"""
    for i, h in enumerate(headers):
        if h is None:
            continue
        h_clean = str(h).strip().replace("\n", "").replace("\r", "").replace(" ", "")
        for alias in aliases:
            a_clean = alias.strip().replace("\n", "").replace("\r", "").replace(" ", "")
            if h_clean == a_clean or h_clean in a_clean or a_clean in h_clean:
                return i
    return None


def _detect_sheet(wb, keywords, fallback_index=None):
    """智能检测工作表：先精确匹配，再关键词模糊匹配，最后回退到序号"""
    sheets = list(wb.sheetnames)
    if not sheets:
        return None

    # 1. 精确匹配
    for kw in keywords:
        if kw in sheets:
            return kw

    # 2. 关键词模糊匹配（包含即可）
    for kw in keywords:
        for s in sheets:
            s_clean = str(s).strip().replace(" ", "")
            kw_clean = kw.strip().replace(" ", "")
            if kw_clean in s_clean or s_clean in kw_clean:
                return s

    # 3. 回退：按序号
    if fallback_index is not None and fallback_index < len(sheets):
        return sheets[fallback_index]

    return None


def _read_sheet_headers(wb, sheet_name):
    """读取工作表的表头行"""
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return None, None, "无数据行（至少需要表头+1行数据）"
    return ws, rows, rows[0]


@api.route("/import-excel", methods=["POST"])
def import_excel():
    """导入 Excel 台账（智能识别工作表名和列名）"""
    try:
        import openpyxl
    except ImportError:
        return jsonify({"code": 1, "msg": "请安装 openpyxl: pip install openpyxl"}), 500

    file = request.files.get("file")
    if not file:
        return jsonify({"code": 1, "msg": "未选择文件"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("xlsx", "xls"):
        return jsonify({"code": 1, "msg": "仅支持 .xlsx / .xls 格式"}), 400

    try:
        wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
    except Exception as e:
        return jsonify({"code": 1, "msg": f"Excel 读取失败: {str(e)}"}), 400

    result = {
        "households_created": 0, "households_updated": 0,
        "members_created": 0, "errors": [],
        "sheets_found": list(wb.sheetnames),
        "hh_sheet_used": "", "member_sheet_used": "",
        "hh_headers_found": [], "member_headers_found": [],
    }

    # ========== 智能识别户信息工作表 ==========
    hh_sheet_name = _detect_sheet(
        wb,
        keywords=["户信息", "农户信息", "户基本信息", "户主信息", "户表", "家庭信息"],
        fallback_index=0  # 第一个工作表
    )
    if hh_sheet_name is None:
        result["errors"].append("无法找到户信息工作表（Excel 中没有任何工作表）")
        wb.close()
        return jsonify({"code": 1, "data": result, "msg": "导入失败：未找到户信息工作表"}), 400

    result["hh_sheet_used"] = hh_sheet_name
    ws_hh, rows_hh, hh_headers = _read_sheet_headers(wb, hh_sheet_name)
    if ws_hh is None:
        result["errors"].append(f"工作表 [{hh_sheet_name}] {rows_hh}")
        wb.close()
        return jsonify({"code": 1, "data": result, "msg": "导入失败：户信息工作表无数据"}), 400

    result["hh_headers_found"] = [str(h) for h in hh_headers if h is not None]

    # 建立户信息列映射
    hh_col_map = {}
    hh_missing = []
    for field, aliases in HOUSEHOLD_EXCEL_COLUMNS.items():
        idx = _find_column_index_fuzzy(hh_headers, aliases)
        if idx is not None:
            hh_col_map[field] = idx

    # 必填列检查
    required_hh = ["house_number", "householder_name"]
    for f in required_hh:
        if f not in hh_col_map:
            hh_missing.append(f)
    if hh_missing:
        missing_names = [HOUSEHOLD_EXCEL_COLUMNS[f][0] for f in hh_missing]
        headers_found = result['hh_headers_found']
        result["errors"].append(
            f"户信息工作表 [{hh_sheet_name}] 缺少必填列：{', '.join(missing_names)}。"
            f"当前表头为：{headers_found}。请确保表头包含「户编号」和「户主姓名」（支持模糊匹配）"
        )

    # 处理户数据
    if "house_number" in hh_col_map and "householder_name" in hh_col_map:
        for row in rows_hh[1:]:
            try:
                house_number = _safe_str(row[hh_col_map["house_number"]])
                householder_name = _safe_str(row[hh_col_map["householder_name"]])
                if not house_number:
                    continue

                hh = Household.query.filter_by(house_number=house_number).first()
                is_new = hh is None
                if is_new:
                    hh = Household(house_number=house_number)
                    db.session.add(hh)
                    result["households_created"] += 1
                else:
                    result["households_updated"] += 1

                hh.householder_name = householder_name
                if "householder_phone" in hh_col_map:
                    hh.householder_phone = _safe_str(row[hh_col_map["householder_phone"]])
                if "group_name" in hh_col_map:
                    hh.group_name = _safe_str(row[hh_col_map["group_name"]])
                if "house_type" in hh_col_map:
                    hh.house_type = _safe_str(row[hh_col_map["house_type"]]) or "一般户"
                if "address" in hh_col_map:
                    hh.address = _safe_str(row[hh_col_map["address"]])
                if "latitude" in hh_col_map:
                    hh.latitude = _safe_float(row[hh_col_map["latitude"]])
                if "longitude" in hh_col_map:
                    hh.longitude = _safe_float(row[hh_col_map["longitude"]])
                if "notes" in hh_col_map:
                    hh.notes = _safe_str(row[hh_col_map["notes"]])
                if "photo_path" in hh_col_map:
                    hh.photo_path = _safe_str(row[hh_col_map["photo_path"]])
            except Exception as e:
                result["errors"].append(f"户信息行处理异常: {str(e)}")

        db.session.flush()

    # ========== 智能识别成员信息工作表 ==========
    member_sheet_name = _detect_sheet(
        wb,
        keywords=["成员信息", "家庭成员", "人口信息", "成员表", "家庭成员信息", "人口表"],
        fallback_index=1 if len(wb.sheetnames) > 1 else None  # 第二个工作表（跳过户信息）
    )
    if member_sheet_name and member_sheet_name != hh_sheet_name:
        result["member_sheet_used"] = member_sheet_name
        ws_m, rows_m, member_headers = _read_sheet_headers(wb, member_sheet_name)
        if ws_m is not None:
            result["member_headers_found"] = [str(h) for h in member_headers if h is not None]

            m_col_map = {}
            for field, aliases in MEMBER_EXCEL_COLUMNS.items():
                idx = _find_column_index_fuzzy(member_headers, aliases)
                if idx is not None:
                    m_col_map[field] = idx

            if "name" not in m_col_map:
                result["errors"].append(
                    f"成员信息工作表 [{member_sheet_name}] 缺少姓名列。"
                    f"当前表头：{result['member_headers_found']}"
                )
            else:
                for row in rows_m[1:]:
                    try:
                        name = _safe_str(row[m_col_map["name"]])
                        if not name:
                            continue

                        household_id = None
                        if "house_number" in m_col_map:
                            hn = _safe_str(row[m_col_map["house_number"]])
                            hh = Household.query.filter_by(house_number=hn).first()
                            if hh:
                                household_id = hh.id

                        if household_id is None:
                            result["errors"].append(
                                f'成员 {name} 无法关联到户（缺少「户编号」列或户编号不匹配）'
                            )
                            continue

                        member = Member(household_id=household_id, name=name)
                        if "id_card" in m_col_map:
                            member.id_card = _safe_str(row[m_col_map["id_card"]])
                        if "phone" in m_col_map:
                            member.phone = _safe_str(row[m_col_map["phone"]])
                        if "relation" in m_col_map:
                            member.relation = _safe_str(row[m_col_map["relation"]])
                        if "gender" in m_col_map:
                            member.gender = _safe_str(row[m_col_map["gender"]])
                        if "birth_date" in m_col_map:
                            member.birth_date = _safe_str(row[m_col_map["birth_date"]])
                        if "notes" in m_col_map:
                            member.notes = _safe_str(row[m_col_map["notes"]])
                        db.session.add(member)
                        result["members_created"] += 1
                    except Exception as e:
                        result["errors"].append(f"成员行处理异常: {str(e)}")
    else:
        if not member_sheet_name:
            result["errors"].append("未找到成员信息工作表（将仅导入户信息）")
        elif member_sheet_name == hh_sheet_name:
            result["errors"].append("成员信息工作表与户信息为同一工作表，已跳过")

    wb.close()
    db.session.commit()
    return jsonify({"code": 0, "data": result, "msg": "导入完成"})
