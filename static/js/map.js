/**
 * 村户信息管理系统 - 离线地图模块
 * 不依赖 Leaflet，纯 JS 实现航拍图查看、缩放、标注功能。
 * 使用像素坐标系（image_x=横向, image_y=纵向），与配置中 width/height 对应。
 */

const TYPE_COLORS = {
    '一般户': '#4a90d9',
    '低保户': '#e67e22',
    '五保户': '#e74c3c',
    '脱贫户': '#52c41a',
    '监测户': '#9b59b6',
    '其他': '#1abc9c',
};

const MAP_STATE = {
    container: null,       // #map div
    imgWrapper: null,      // 图片容器
    img: null,             // <img> 元素
    markers: {},           // { hhId: DOM element }
    currentGroup: '',
    allMapData: [],
    imgWidth: 0,
    imgHeight: 0,
    zoom: 1,
    offsetX: 0,            // 图片平移 X
    offsetY: 0,            // 图片平移 Y
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartOffsetX: 0,
    dragStartOffsetY: 0,
    annotateMode: false,   // 是否为标注模式
    annotateTargetId: null, // 标注目标户 ID
    clickHintEl: null,     // 点击提示圆
    popupEl: null,         // 弹窗元素
};

function getTypeColor(type) {
    return TYPE_COLORS[type] || '#999';
}

function initMap() {
    const cfg = window.APP_CONFIG;
    const container = document.getElementById('map');
    MAP_STATE.container = container;

    // 创建图片容器
    const wrapper = document.createElement('div');
    wrapper.className = 'map-img-wrapper';
    wrapper.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;';
    container.appendChild(wrapper);
    MAP_STATE.imgWrapper = wrapper;

    // 创建图片
    const img = document.createElement('img');
    img.style.cssText = 'display:block;user-select:none;pointer-events:none;';
    wrapper.appendChild(img);
    MAP_STATE.img = img;

    // 创建标注层
    const markerLayer = document.createElement('div');
    markerLayer.className = 'map-marker-layer';
    markerLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    wrapper.appendChild(markerLayer);
    MAP_STATE.markerLayer = markerLayer;

    // 创建弹窗（放在 container 层，不受图片缩放影响）
    const popup = document.createElement('div');
    popup.className = 'map-popup';
    popup.style.display = 'none';
    container.appendChild(popup);
    MAP_STATE.popupEl = popup;

    // 点击提示圆
    const hint = document.createElement('div');
    hint.className = 'map-click-hint';
    hint.style.display = 'none';
    wrapper.appendChild(hint);
    MAP_STATE.clickHintEl = hint;

    // 坐标跟随标签
    const coordLabel = document.createElement('div');
    coordLabel.className = 'map-coord-label';
    coordLabel.style.display = 'none';
    container.appendChild(coordLabel);
    MAP_STATE.coordLabel = coordLabel;

    // ====== 事件绑定 ======
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('click', onMapClick);

    // 加载默认组图片
    const groupConfig = cfg.groupAerialConfig || {};
    if (Object.keys(groupConfig).length > 0) {
        MAP_STATE.currentGroup = cfg.defaultAerialGroup;
        loadGroupPhoto(cfg.defaultAerialGroup);
    }

    // 加载标注数据
    loadAllMarkers();

    window.addEventListener('resize', () => fitImage());
}

// ====== 图片加载与切换 ======

function loadGroupPhoto(groupName) {
    const cfg = window.APP_CONFIG;
    const gc = (cfg.groupAerialConfig || {})[groupName];
    if (!gc) return;

    MAP_STATE.imgWidth = gc.width;
    MAP_STATE.imgHeight = gc.height;
    MAP_STATE.zoom = 1;
    MAP_STATE.offsetX = 0;
    MAP_STATE.offsetY = 0;

    const img = MAP_STATE.img;
    img.src = gc.image;
    img.style.width = gc.width + 'px';
    img.style.height = gc.height + 'px';

    // 图片加载完成后适配容器
    if (img.complete) {
        fitImage();
    } else {
        img.onload = function() { fitImage(); };
    }

    clearAllMarkers();
    showGroupMarkers(groupName);
}

function fitImage() {
    const container = MAP_STATE.container;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = MAP_STATE.imgWidth;
    const ih = MAP_STATE.imgHeight;
    if (!iw || !ih) return;

    const scaleX = cw / iw;
    const scaleY = ch / ih;
    const scale = Math.min(scaleX, scaleY, 1);
    MAP_STATE.zoom = scale;

    MAP_STATE.offsetX = (cw - iw * scale) / 2;
    MAP_STATE.offsetY = (ch - ih * scale) / 2;
    applyTransform();

    // 调整标记层大小
    const wrapper = MAP_STATE.imgWrapper;
    wrapper.style.width = iw + 'px';
    wrapper.style.height = ih + 'px';
}

function applyTransform() {
    const wrapper = MAP_STATE.imgWrapper;
    wrapper.style.transform =
        `translate(${MAP_STATE.offsetX}px, ${MAP_STATE.offsetY}px) scale(${MAP_STATE.zoom})`;
}

function switchAerialGroup(groupName) {
    const groupConfig = window.APP_CONFIG.groupAerialConfig || {};
    if (!groupConfig[groupName]) return;
    MAP_STATE.currentGroup = groupName;
    loadGroupPhoto(groupName);

    document.querySelectorAll('.group-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.group === groupName);
    });
}

// ====== 鼠标事件 ======

function getImageXY(e) {
    const container = MAP_STATE.container;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - MAP_STATE.offsetX) / MAP_STATE.zoom;
    const y = (e.clientY - rect.top - MAP_STATE.offsetY) / MAP_STATE.zoom;
    return { x, y };
}

function onMouseDown(e) {
    MAP_STATE.isDragging = true;
    MAP_STATE.dragStartX = e.clientX;
    MAP_STATE.dragStartY = e.clientY;
    MAP_STATE.dragStartOffsetX = MAP_STATE.offsetX;
    MAP_STATE.dragStartOffsetY = MAP_STATE.offsetY;
    MAP_STATE.container.style.cursor = 'grabbing';
}

function onMouseMove(e) {
    const xy = getImageXY(e);
    const inBounds = xy.x >= 0 && xy.y >= 0 && xy.x <= MAP_STATE.imgWidth && xy.y <= MAP_STATE.imgHeight;

    if (MAP_STATE.isDragging) {
        MAP_STATE.offsetX = MAP_STATE.dragStartOffsetX + (e.clientX - MAP_STATE.dragStartX);
        MAP_STATE.offsetY = MAP_STATE.dragStartOffsetY + (e.clientY - MAP_STATE.dragStartY);
        applyTransform();
    } else {
        MAP_STATE.container.style.cursor = MAP_STATE.annotateMode
            ? 'crosshair' : (inBounds ? 'grab' : 'default');
    }

    // 坐标跟随标签
    if (inBounds) {
        const lbl = MAP_STATE.coordLabel;
        lbl.textContent = `X: ${Math.round(xy.x)}  Y: ${Math.round(xy.y)}`;
        lbl.style.display = 'block';
        lbl.style.left = (e.clientX - MAP_STATE.container.getBoundingClientRect().left + 16) + 'px';
        lbl.style.top = (e.clientY - MAP_STATE.container.getBoundingClientRect().top - 28) + 'px';
    } else {
        MAP_STATE.coordLabel.style.display = 'none';
    }

    // 标注模式下高亮最近标注点
    clearClickHint();
}

function onMouseUp(e) {
    if (!MAP_STATE.isDragging) return;
    const dx = Math.abs(e.clientX - MAP_STATE.dragStartX);
    const dy = Math.abs(e.clientY - MAP_STATE.dragStartY);
    MAP_STATE.isDragging = false;
    MAP_STATE.container.style.cursor = MAP_STATE.annotateMode ? 'crosshair' : 'grab';
}

function onWheel(e) {
    e.preventDefault();
    const container = MAP_STATE.container;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldZoom = MAP_STATE.zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, oldZoom * delta));

    // 以鼠标位置为中心缩放
    const imgX = (mouseX - MAP_STATE.offsetX) / oldZoom;
    const imgY = (mouseY - MAP_STATE.offsetY) / oldZoom;
    MAP_STATE.zoom = newZoom;
    MAP_STATE.offsetX = mouseX - imgX * newZoom;
    MAP_STATE.offsetY = mouseY - imgY * newZoom;
    applyTransform();
}

function onMapClick(e) {
    // 忽略拖拽
    if (Math.abs(e.clientX - MAP_STATE.dragStartX) > 3 ||
        Math.abs(e.clientY - MAP_STATE.dragStartY) > 3) return;

    const xy = getImageXY(e);
    if (xy.x < 0 || xy.y < 0 || xy.x > MAP_STATE.imgWidth || xy.y > MAP_STATE.imgHeight) return;

    const px = Math.round(xy.x);
    const py = Math.round(xy.y);

    if (MAP_STATE.annotateMode && MAP_STATE.annotateTargetId) {
        // 标注模式：保存坐标
        showClickHint(xy);
        saveAnnotation(MAP_STATE.annotateTargetId, px, py);
    } else {
        // 普通模式：显示坐标到表单（如果表单打开）
        const hhModal = document.getElementById('householdModal');
        if (hhModal && hhModal.classList.contains('show')) {
            document.getElementById('hhLat').value = px;
            document.getElementById('hhLng').value = py;
            showClickHint(xy);
            showToast(`已获取坐标 X:${px} Y:${py}`, 'success');
        }
    }
}

// ====== 标注模式 ======

function enterAnnotateMode(hhId) {
    MAP_STATE.annotateMode = true;
    MAP_STATE.annotateTargetId = hhId;
    MAP_STATE.container.style.cursor = 'crosshair';
    // 高亮对应行
    document.querySelectorAll('#tableBody tr').forEach(tr => {
        tr.classList.toggle('annotating', tr.dataset.hhId == hhId);
    });
    showToast('请在地图上点击该户的位置', 'success');
}

function exitAnnotateMode() {
    MAP_STATE.annotateMode = false;
    MAP_STATE.annotateTargetId = null;
    MAP_STATE.container.style.cursor = 'grab';
    document.querySelectorAll('#tableBody tr.annotating').forEach(tr => {
        tr.classList.remove('annotating');
    });
}

async function saveAnnotation(hhId, x, y) {
    const res = await api(`/api/households/${hhId}`, {
        method: 'PUT',
        body: JSON.stringify({ latitude: x, longitude: y })
    });
    if (res.code === 0) {
        showToast(`标注成功！坐标 X:${x} Y:${y}`, 'success');
        exitAnnotateMode();
        await refreshMapMarkers();
        await loadStats();
        // 刷新列表以显示新坐标
        if (typeof loadHouseholds === 'function') {
            loadHouseholds(STATE.currentPage);
        }
    } else {
        showToast('标注失败: ' + (res.msg || '未知错误'), 'error');
    }
}

// ====== 标记管理 ======

function clearAllMarkers() {
    Object.values(MAP_STATE.markers).forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    MAP_STATE.markers = {};
}

function showGroupMarkers(groupName) {
    if (!MAP_STATE.markerLayer) return;

    let data = MAP_STATE.allMapData;
    if (groupName) {
        data = data.filter(hh => hh.group_name === groupName);
    }

    data.forEach(hh => {
        const x = hh.latitude;
        const y = hh.longitude;
        if (x == null || y == null) return;

        const color = getTypeColor(hh.house_type);
        const marker = document.createElement('div');
        marker.className = 'map-marker';
        // 大号标记点：24px直径 + 厚白边 + 彩色外光圈 + 内圈亮点
        marker.style.cssText = `
            position:absolute;
            left:${x}px;top:${y}px;
            width:24px;height:24px;
            background:radial-gradient(circle at 40% 35%, rgba(255,255,255,0.5) 0%, ${color} 60%);
            border:3px solid #fff;
            border-radius:50%;
            transform:translate(-50%,-50%);
            cursor:pointer;
            pointer-events:auto;
            box-shadow:0 0 0 6px ${color}55, 0 3px 12px rgba(0,0,0,0.4);
            z-index:10;
        `;
        marker.title = `${hh.householder_name} (${hh.group_name || ''})`;

        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            showMarkerPopup(hh, marker);
        });

        MAP_STATE.markerLayer.appendChild(marker);
        MAP_STATE.markers[hh.id] = marker;
    });
}

function showMarkerPopup(hh, marker) {
    MAP_STATE.popupEl.style.display = 'none';

    const popup = MAP_STATE.popupEl;
    const color = getTypeColor(hh.house_type);
    popup.innerHTML = `
        <div class="popup-arrow"></div>
        <div class="popup-close" onclick="MAP_STATE.popupEl.style.display='none'">&times;</div>
        <h4>🏠 ${esc(hh.householder_name)} 户</h4>
        <div class="popup-row"><span class="popup-label">户编号</span><b>${esc(hh.house_number)}</b></div>
        <div class="popup-row">
            <span class="popup-label">类型</span>
            <span class="popup-type-badge" style="background:${color}">${esc(hh.house_type)}</span>
        </div>
        <div class="popup-row"><span class="popup-label">小组</span>${esc(hh.group_name) || '-'}</div>
        <div class="popup-row"><span class="popup-label">成员</span>${hh.member_count} 人</div>
        ${hh.latitude != null ? `<div class="popup-row"><span class="popup-label">坐标</span>X=${Math.round(hh.latitude)} Y=${Math.round(hh.longitude)}</div>` : ''}
        <div class="popup-btns">
            <button onclick="showDetail(${hh.id});MAP_STATE.popupEl.style.display='none'" class="btn-popup-detail">📋 详情</button>
            <button onclick="enterAnnotateMode(${hh.id});MAP_STATE.popupEl.style.display='none'" class="btn-popup-annotate">📍 标注</button>
        </div>
    `;

    // --- 智能定位：计算标记点在屏幕上的位置 ---
    const pxX = parseFloat(marker.style.left);   // 图片像素 X
    const pxY = parseFloat(marker.style.top);    // 图片像素 Y
    const cw = MAP_STATE.container.clientWidth;
    const ch = MAP_STATE.container.clientHeight;

    // 标记点屏幕坐标（中心）
    const markerScreenX = MAP_STATE.offsetX + pxX * MAP_STATE.zoom;
    const markerScreenY = MAP_STATE.offsetY + pxY * MAP_STATE.zoom;

    // 弹窗尺寸：自适应占容器 ~1/4 宽，最小 250px，最大 350px
    const pw = Math.min(350, Math.max(250, Math.round(cw * 0.28)));
    const gap = 24;   // 标记点边缘到弹窗的距离

    // 优先放在右侧；右侧不够则放左侧
    let left = markerScreenX + 16 + gap;  // 16 = 标记半径
    let arrowSide = 'left';  // 箭头在弹窗左侧

    if (left + pw > cw - 8) {
        // 右侧溢出，改放左侧
        left = markerScreenX - 16 - pw - gap;
        arrowSide = 'right';
    }
    if (left < 4) {
        // 左边也溢出，贴边放
        left = markerScreenX + 16 + gap;
        arrowSide = 'left';
    }

    // 垂直居中于标记点，估计弹窗高度 ~180px
    const ph = 180;
    let top = markerScreenY - ph / 2;
    if (top < 4) top = 4;
    if (top + ph > ch - 4) top = ch - ph - 4;

    popup.style.cssText = `
        display:block;
        position:absolute;
        left:${left}px;
        top:${top}px;
        width:${pw}px;
        --arrow-side:${arrowSide};
    `;

    highlightTableRow(hh.id);
}

async function loadAllMarkers() {
    const res = await api('/api/map-data');
    if (res.code !== 0) return;
    MAP_STATE.allMapData = res.data;
    showGroupMarkers(MAP_STATE.currentGroup);
}

async function refreshMapMarkers() {
    const res = await api('/api/map-data');
    if (res.code !== 0) return;
    MAP_STATE.allMapData = res.data;
    clearAllMarkers();
    showGroupMarkers(MAP_STATE.currentGroup);
}

// ====== 提示工具 ======

function showClickHint(latlng) {
    const hint = MAP_STATE.clickHintEl;
    hint.style.left = latlng.x + 'px';
    hint.style.top = latlng.y + 'px';
    hint.style.display = 'block';
    clearTimeout(hint._timer);
    hint._timer = setTimeout(() => { hint.style.display = 'none'; }, 2000);
}

function clearClickHint() {
    if (MAP_STATE.clickHintEl) MAP_STATE.clickHintEl.style.display = 'none';
}

function highlightTableRow(hhId) {
    document.querySelectorAll('#tableBody tr').forEach(tr => {
        tr.classList.toggle('selected', tr.dataset.hhId == hhId);
    });
}

function flyToHousehold(lat, lng, hhId) {
    const container = MAP_STATE.container;
    if (!container || lat == null || lng == null) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    MAP_STATE.zoom = 1.5;
    MAP_STATE.offsetX = cw / 2 - lat * MAP_STATE.zoom;
    MAP_STATE.offsetY = ch / 2 - lng * MAP_STATE.zoom;
    applyTransform();

    setTimeout(() => {
        const marker = MAP_STATE.markers[hhId];
        if (marker) {
            showMarkerPopup(
                MAP_STATE.allMapData.find(h => h.id === hhId) || {},
                marker
            );
        }
    }, 300);
}
