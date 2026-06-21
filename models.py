"""
村户信息管理系统 - 数据模型
使用 SQLAlchemy ORM 定义户(Household)和成员(Member)模型。
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Household(db.Model):
    """户信息表"""
    __tablename__ = "households"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    house_number = db.Column(db.String(50), unique=True, nullable=False, index=True, comment="户编号")
    householder_name = db.Column(db.String(50), nullable=False, comment="户主姓名")
    householder_phone = db.Column(db.String(20), default="", comment="联系电话")
    group_name = db.Column(db.String(50), default="", comment="村民小组")
    house_type = db.Column(db.String(20), default="一般户", comment="户类型")
    address = db.Column(db.String(200), default="", comment="门牌号")
    latitude = db.Column(db.Float, nullable=True, comment="图上X坐标(像素)")
    longitude = db.Column(db.Float, nullable=True, comment="图上Y坐标(像素)")
    photo_path = db.Column(db.String(500), default="", comment="房照路径")
    personal_photo = db.Column(db.String(500), default="", comment="个照路径")
    planting = db.Column(db.Text, default="", comment="种植信息")
    breeding = db.Column(db.Text, default="", comment="养殖信息")
    notes = db.Column(db.Text, default="", comment="其他备注")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关联成员
    members = db.relationship("Member", backref="household", lazy="dynamic",
                              cascade="all, delete-orphan")

    def to_dict(self, include_members=False):
        """转为字典"""
        data = {
            "id": self.id,
            "house_number": self.house_number,
            "householder_name": self.householder_name,
            "householder_phone": self.householder_phone,
            "group_name": self.group_name,
            "house_type": self.house_type,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "photo_path": self.photo_path,
            "personal_photo": self.personal_photo,
            "planting": self.planting,
            "breeding": self.breeding,
            "notes": self.notes,
            "member_count": self.members.count(),
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else "",
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M") if self.updated_at else "",
        }
        if include_members:
            data["members"] = [m.to_dict() for m in self.members.all()]
        return data


class Member(db.Model):
    """家庭成员表"""
    __tablename__ = "members"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    household_id = db.Column(db.Integer, db.ForeignKey("households.id", ondelete="CASCADE"),
                             nullable=False, index=True, comment="所属户ID")
    member_code = db.Column(db.String(50), default="", comment="成员编码")
    name = db.Column(db.String(50), nullable=False, comment="姓名")
    id_card = db.Column(db.String(30), default="", comment="身份证号")
    phone = db.Column(db.String(20), default="", comment="联系电话")
    relation = db.Column(db.String(20), default="", comment="与户主关系")
    gender = db.Column(db.String(5), default="", comment="性别")
    birth_date = db.Column(db.String(20), default="", comment="出生日期")
    notes = db.Column(db.Text, default="", comment="备注")

    def to_dict(self):
        return {
            "id": self.id,
            "household_id": self.household_id,
            "member_code": self.member_code,
            "name": self.name,
            "id_card": self.id_card,
            "phone": self.phone,
            "relation": self.relation,
            "gender": self.gender,
            "birth_date": self.birth_date,
            "notes": self.notes,
        }
