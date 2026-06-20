/**
 * 村户信息管理系统 - 地图模块（多图分组版）
 * 支持按村民小组切换不同的航拍图，每组独立坐标。
 * 使用 Leaflet CRS.Simple + imageOverlay，完全离线。
 */

// 户类型对应颜色
const TYPE_COLORS = {
    '一般户': '#4a90d9',
    '低保户': '#e67e22',
    '五保户': '#e74c3c',
    '脱贫户': '#52c41a',
    '监测户': '#9b59b6',
    '其他': '#1abc9c',
};

// 地图状态
const MAP_STATE = {
    map: null,
    markers: {},           // { hhId: marker }
    imageOverlay: null,    // 当前航拍图图层
    currentGroup: '',      // 当前显示的小组（空字符串=全部/无分组）
    allMapData: [],        // 缓存全部地图数据
};

function getTypeColor(type) {
    return TYPE_COLORS[type] || '#999';
}

function initMap() {
    const cfg = window.APP_CONFIG;
    const groupConfig = cfg.groupAerialConfig || {};

    // 初始化地图（CRS.Simple 像素坐标系）
    const map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 4,
        zoomControl: true,
        attributionControl: false,
    });
    MAP_STATE.map = map;

    // 判断使用分组模式还是单图模式
    if (Object.keys(groupConfig).length > 0) {
        // 分组模式：加载默认组的航拍图
        MAP_STATE.currentGroup = cfg.defaultAerialGroup;
        loadGroupPhoto(cfg.defaultAerialGroup);
    } else {
        // 单图模式（兼容旧版）
        MAP_STATE.currentGroup = '';
        const bounds = [[0, 0], [cfg.aerialHeight, cfg.aerialWidth]];
        MAP_STATE.imageOverlay = L.imageOverlay(cfg.aerialImage, bounds).addTo(map);
        map.fitBounds(bounds);
    }

    // 点击航拍图获取像素坐标（用于新增/编辑户时定位）
    map.on('click', function (e) {
        const hhModal = document.getElementById('householdModal');
        if (hhModal && hhModal.classList.contains('show')) {
            const x = Math.round(e.latlng.lng);
            const y = Math.round(e.latlng.lat);
            document.getElementById('hhLat').value = x;
            document.getElementById('hhLng').value = y;
            showClickHint(e.latlng);
        }
    });

    // 加载全部标注数据
    loadAllMarkers();

    // 窗口 resize 时刷新地图
    window.addEventListener('resize', () => {
        setTimeout(() => map.invalidateSize(), 200);
    });
}

/**
 * 加载指定组的航拍图
 */
function loadGroupPhoto(groupName) {
    const cfg = window.APP_CONFIG;
    const groupConfig = cfg.groupAerialConfig || {};
    const gcfg = groupConfig[groupName];
    const map = MAP_STATE.map;
    if (!gcfg || !map) return;

    // 移除旧图层
    if (MAP_STATE.imageOverlay) {
        map.removeLayer(MAP_STATE.imageOverlay);
    }

    // 添加新航拍图
    const bounds = [[0, 0], [gcfg.height, gcfg.width]];
    MAP_STATE.imageOverlay = L.imageOverlay(gcfg.image, bounds).addTo(map);
    map.fitBounds(bounds);

    // 清除旧标记
    clearAllMarkers();

    // 仅显示当前组的标记
    showGroupMarkers(groupName);
}

/**
 * 切换航拍图分组（由 index.html 按钮调用）
 */
function switchAerialGroup(groupName) {
    const groupConfig = window.APP_CONFIG.groupAerialConfig || {};
    if (!groupConfig[groupName]) return;

    MAP_STATE.currentGroup = groupName;
    loadGroupPhoto(groupName);

    // 更新按钮状态
    document.querySelectorAll('.group-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.group === groupName);
    });
}

/**
 * 清除地图上所有标记
 */
function clearAllMarkers() {
    const map = MAP_STATE.map;
    Object.values(MAP_STATE.markers).forEach(m => map.removeLayer(m));
    MAP_STATE.markers = {};
}

/**
 * 首次加载：获取全部地图数据并显示默认组标记
 */
async function loadAllMarkers() {
    const res = await api('/api/map-data');
    if (res.code !== 0) return;

    MAP_STATE.allMapData = res.data;

    const cfg = window.APP_CONFIG;
    const groupConfig = cfg.groupAerialConfig || {};

    if (Object.keys(groupConfig).length > 0) {
        // 分组模式：只显示当前组的标记
        showGroupMarkers(MAP_STATE.currentGroup);
    } else {
        // 单图模式：显示全部有坐标的标记
        showGroupMarkers('');
    }
}

/**
 * 在地图上显示指定小组的标记
 * @param {string} groupName - 小组名，空字符串表示全部
 */
function showGroupMarkers(groupName) {
    const map = MAP_STATE.map;
    if (!map) return;

    // 清除旧标记
    clearAllMarkers();

    // 筛选数据
    let data = MAP_STATE.allMapData;
    if (groupName) {
        data = data.filter(hh => hh.group_name === groupName);
    }

    data.forEach(hh => {
        const x = hh.latitude;
        const y = hh.longitude;
        if (x == null || y == null) return;

        const color = getTypeColor(hh.house_type);
        const marker = L.circleMarker([y, x], {
            radius: 10,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
        }).addTo(map);

        marker.bindPopup(`
            <div style="min-width:160px;">
                <h4 style="margin:0 0 6px;">${esc(hh.householder_name)} 户</h4>
                <p style="margin:2px 0;">户编号：${esc(hh.house_number)}</p>
                <p style="margin:2px 0;">类型：${esc(hh.house_type)}</p>
                <p style="margin:2px 0;">小组：${esc(hh.group_name) || '-'}</p>
                <p style="margin:2px 0;">成员：${hh.member_count} 人</p>
                <button onclick="showDetail(${hh.id})" style="margin-top:6px;padding:4px 12px;font-size:12px;cursor:pointer;background:#4a90d9;color:#fff;border:none;border-radius:4px;">查看详情</button>
            </div>
        `);

        marker.on('click', () => {
            highlightTableRow(hh.id);
        });

        MAP_STATE.markers[hh.id] = marker;
    });
}

/**
 * 刷新地图标记（新增/编辑/删除户后调用）
 */
async function refreshMapMarkers() {
    const res = await api('/api/map-data');
    if (res.code !== 0) return;
    MAP_STATE.allMapData = res.data;

    const cfg = window.APP_CONFIG;
    const groupConfig = cfg.groupAerialConfig || {};
    if (Object.keys(groupConfig).length > 0) {
        showGroupMarkers(MAP_STATE.currentGroup);
    } else {
        showGroupMarkers('');
    }
}

// ========== 点击提示 ==========

let clickHintMarker = null;

function showClickHint(latlng) {
    const map = MAP_STATE.map;
    if (clickHintMarker) map.removeLayer(clickHintMarker);
    clickHintMarker = L.circleMarker(latlng, {
        radius: 10,
        color: '#ff4d4f',
        fillColor: '#ff4d4f',
        fillOpacity: 0.5,
        weight: 3,
    }).addTo(map);
    setTimeout(() => {
        if (clickHintMarker) {
            map.removeLayer(clickHintMarker);
            clickHintMarker = null;
        }
    }, 1500);
}

// ========== 工具函数 ==========

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function highlightTableRow(hhId) {
    document.querySelectorAll('#tableBody tr').forEach(tr => {
        tr.classList.toggle('selected', tr.dataset.hhId == hhId);
    });
    const row = document.querySelector(`#tableBody tr[data-hh-id="${hhId}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function flyToHousehold(lat, lng, hhId) {
    const map = MAP_STATE.map;
    if (!map) return;
    map.flyTo([lng, lat], 2, { duration: 0.8 });
    setTimeout(() => {
        const marker = MAP_STATE.markers[hhId];
        if (marker) marker.openPopup();
    }, 900);
}
