/**
 * 村户信息管理系统 - 数据表格 & 弹窗交互模块
 */

// ==================== 户列表加载 ====================

async function loadHouseholds(page = 1) {
    STATE.currentPage = page;
    const keyword = $('searchInput').value.trim();
    const houseType = $('filterType').value;
    const groupName = $('filterGroup').value;

    const params = new URLSearchParams({ page, per_page: window.APP_CONFIG.itemsPerPage });
    if (keyword) params.set('keyword', keyword);
    if (houseType) params.set('house_type', houseType);
    if (groupName) params.set('group_name', groupName);

    const res = await api(`/api/households?${params}`);
    if (res.code !== 0) { showToast(res.msg || '加载失败', 'error'); return; }

    renderTable(res.data);
    renderPagination(res.data);
}

function handleSearch() { loadHouseholds(1); }

// ==================== 表格渲染 ====================

function renderTable(data) {
    const tbody = $('tableBody');
    if (!data.items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-hint">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = data.items.map(hh => `
        <tr data-hh-id="${hh.id}" onclick="showDetail(${hh.id})">
            <td><strong>${esc(hh.house_number)}</strong></td>
            <td>${esc(hh.householder_name)}</td>
            <td>${esc(hh.householder_phone)}</td>
            <td>${esc(hh.group_name)}</td>
            <td>${esc(hh.address)}</td>
            <td>${hh.member_count}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-primary" onclick="showDetail(${hh.id})" title="详情">📋</button>
                <button class="btn btn-sm btn-default" onclick="editHousehold(${hh.id})" title="编辑">✏️</button>
                <button class="btn btn-sm ${hh.latitude != null ? 'btn-success' : 'btn-warning'}" 
                    onclick="enterAnnotateMode(${hh.id})" 
                    title="${hh.latitude != null ? '重新标注' : '标注位置'}">📍</button>
                <button class="btn btn-sm btn-danger" onclick="deleteHousehold(${hh.id}, '${esc(hh.householder_name)}')" title="删除">🗑</button>
            </td>
        </tr>
    `).join('');
}

// ==================== 分页 ====================

function renderPagination(data) {
    const pg = $('pagination');
    if (data.pages <= 1) { pg.innerHTML = ''; return; }
    let html = `<button ${data.page <= 1 ? 'disabled' : ''} onclick="loadHouseholds(${data.page - 1})">‹ 上一页</button>`;
    const start = Math.max(1, data.page - 2);
    const end = Math.min(data.pages, data.page + 2);
    for (let i = start; i <= end; i++) {
        html += `<button class="${i === data.page ? 'active' : ''}" onclick="loadHouseholds(${i})">${i}</button>`;
    }
    html += `<button ${data.page >= data.pages ? 'disabled' : ''} onclick="loadHouseholds(${data.page + 1})">下一页 ›</button>`;
    html += `<span style="margin-left:8px;color:#999;">共 ${data.total} 条</span>`;
    pg.innerHTML = html;
}

// ==================== 户 CRUD ====================

function showAddHouseholdDialog() {
    STATE.currentHouseholdId = null;
    $('modalTitle').textContent = '新增户';
    ['hhId','hhNumber','hhName','hhPhone','hhAddress','hhLat','hhLng','hhNotes','hhPhotoPath','hhPersonalPhotoPath','hhPlanting','hhBreeding'].forEach(id => {
        const el = $(id);
        if (el) el.value = '';
    });
    $('hhGroup').value = ''; $('hhType').value = '一般户';
    $('photoPreview').style.display = 'none';
    $('personalPreview').style.display = 'none';
    $('hhPhoto').value = ''; $('hhPersonalPhoto').value = '';
    openModal('householdModal');
    setTimeout(() => MAP_STATE.map && MAP_STATE.container && fitImage(), 200);
}

async function editHousehold(id) {
    const res = await api(`/api/households/${id}`);
    if (res.code !== 0) { showToast('获取数据失败', 'error'); return; }
    const hh = res.data;
    STATE.currentHouseholdId = hh.id;
    $('modalTitle').textContent = '编辑户';
    $('hhId').value = hh.id;
    $('hhNumber').value = hh.house_number;
    $('hhName').value = hh.householder_name;
    $('hhPhone').value = hh.householder_phone;
    $('hhGroup').value = hh.group_name;
    $('hhType').value = hh.house_type;
    $('hhAddress').value = hh.address;
    $('hhLat').value = hh.latitude || '';
    $('hhLng').value = hh.longitude || '';
    $('hhNotes').value = hh.notes || '';
    $('hhPlanting').value = hh.planting || '';
    $('hhBreeding').value = hh.breeding || '';
    $('hhPhotoPath').value = hh.photo_path || '';
    $('hhPersonalPhotoPath').value = hh.personal_photo || '';
    if (hh.photo_path) {
        $('photoPreview').src = hh.photo_path; $('photoPreview').style.display = 'block';
    } else { $('photoPreview').style.display = 'none'; }
    if (hh.personal_photo) {
        $('personalPreview').src = hh.personal_photo; $('personalPreview').style.display = 'block';
    } else { $('personalPreview').style.display = 'none'; }
    $('hhPhoto').value = ''; $('hhPersonalPhoto').value = '';
    openModal('householdModal');
}

async function saveHousehold() {
    const data = {
        house_number: $('hhNumber').value.trim(),
        householder_name: $('hhName').value.trim(),
        householder_phone: $('hhPhone').value.trim(),
        group_name: $('hhGroup').value,
        house_type: $('hhType').value,
        address: $('hhAddress').value.trim(),
        latitude: $('hhLat').value ? parseFloat($('hhLat').value) : null,
        longitude: $('hhLng').value ? parseFloat($('hhLng').value) : null,
        planting: $('hhPlanting').value.trim(),
        breeding: $('hhBreeding').value.trim(),
        photo_path: $('hhPhotoPath').value,
        personal_photo: $('hhPersonalPhotoPath').value,
        notes: $('hhNotes').value.trim(),
    };

    if (!data.house_number) { showToast('户主编码为必填项', 'error'); return; }

    // 上传房照
    const photoFile = $('hhPhoto').files[0];
    if (photoFile) {
        const upRes = await uploadFile('/api/households/upload-photo', photoFile);
        if (upRes.code === 0) data.photo_path = upRes.data.url;
        else { showToast('房照上传失败: ' + upRes.msg, 'error'); return; }
    }
    // 上传个照
    const personalFile = $('hhPersonalPhoto').files[0];
    if (personalFile) {
        const upRes = await uploadFile('/api/households/upload-photo', personalFile);
        if (upRes.code === 0) data.personal_photo = upRes.data.url;
        else { showToast('个照上传失败: ' + upRes.msg, 'error'); return; }
    }

    const hhId = $('hhId').value;
    const url = hhId ? `/api/households/${hhId}` : '/api/households';
    const method = hhId ? 'PUT' : 'POST';
    const res = await api(url, { method, body: JSON.stringify(data) });

    if (res.code === 0) {
        showToast(res.msg || '保存成功');
        closeModal('householdModal');
        await loadHouseholds(STATE.currentPage);
        await refreshMapMarkers();
        await loadStats();
    } else {
        showToast(res.msg || '保存失败', 'error');
    }
}

async function deleteHousehold(id, name) {
    if (!confirm(`确定要删除户【${name}】及其所有成员数据吗？此操作不可恢复！`)) return;
    const res = await api(`/api/households/${id}`, { method: 'DELETE' });
    if (res.code === 0) {
        showToast('删除成功');
        await loadHouseholds(STATE.currentPage);
        await refreshMapMarkers();
        await loadStats();
    } else { showToast(res.msg || '删除失败', 'error'); }
}

// ==================== 户详情 ====================

async function showDetail(id) {
    const res = await api(`/api/households/${id}`);
    if (res.code !== 0) { showToast('获取详情失败', 'error'); return; }
    const hh = res.data;
    STATE.currentHouseholdId = hh.id;
    $('detailTitle').textContent = `${hh.householder_name} 户 - 详情`;

    let html = `
        <div class="detail-section">
            <h3>基本信息</h3>
            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">户主编码：</span>${esc(hh.house_number)}</div>
                <div class="detail-item"><span class="detail-label">户主：</span>${esc(hh.householder_name)}</div>
                <div class="detail-item"><span class="detail-label">电话：</span>${esc(hh.householder_phone)}</div>
                <div class="detail-item"><span class="detail-label">小组：</span>${esc(hh.group_name)}</div>
                <div class="detail-item"><span class="detail-label">类型：</span>${esc(hh.house_type)}</div>
                <div class="detail-item"><span class="detail-label">门牌：</span>${esc(hh.address)}</div>
                <div class="detail-item"><span class="detail-label">图上位置：</span>${
                    hh.latitude != null ? 'X=' + Math.round(hh.latitude) + ' Y=' + Math.round(hh.longitude) : '<span style="color:#e67e22;">未标注</span>'
                }</div>
                <div class="detail-item"><span class="detail-label">种植：</span>${esc(hh.planting) || '-'}</div>
                <div class="detail-item"><span class="detail-label">养殖：</span>${esc(hh.breeding) || '-'}</div>
                <div class="detail-item" style="grid-column:1/-1"><span class="detail-label">备注：</span>${esc(hh.notes) || '-'}</div>
            </div>
            <div class="detail-photos" style="margin-top:10px;display:flex;gap:12px;">
                ${hh.photo_path ? `<div><small>房照</small><br><img src="${hh.photo_path}" class="detail-photo"></div>` : ''}
                ${hh.personal_photo ? `<div><small>个照</small><br><img src="${hh.personal_photo}" class="detail-photo"></div>` : ''}
            </div>
        </div>
        <div class="detail-section">
            <h3>家庭成员 (${hh.members ? hh.members.length : 0}人)</h3>
            <button class="btn btn-sm btn-primary" onclick="showAddMemberDialog(${hh.id})" style="margin-bottom:8px;">➕ 添加成员</button>
            <div class="member-list">
    `;

    if (hh.members && hh.members.length > 0) {
        hh.members.forEach(m => {
            html += `
                <div class="member-item">
                    <div class="member-info">
                        <strong>${esc(m.name)}</strong>
                        ${m.member_code ? `<small style="color:#999;">(${esc(m.member_code)})</small>` : ''}
                        ${m.relation ? `<span style="color:#999;"> | ${esc(m.relation)}</span>` : ''}
                        ${m.gender ? `<span> | ${esc(m.gender)}</span>` : ''}
                        ${m.phone ? `<span> | 📞${esc(m.phone)}</span>` : ''}
                        ${m.id_card ? `<br><span style="font-size:12px;color:#aaa;">身份证：${esc(m.id_card)}</span>` : ''}
                        ${m.notes ? `<br><span style="font-size:12px;color:#aaa;">备注：${esc(m.notes)}</span>` : ''}
                    </div>
                    <div class="member-actions">
                        <button class="btn btn-sm btn-default" onclick="editMember(${m.id}, ${hh.id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.id}, '${esc(m.name)}', ${hh.id})">🗑</button>
                    </div>
                </div>
            `;
        });
    } else {
        html += '<p style="color:#aaa;font-size:13px;">暂无成员</p>';
    }
    html += '</div></div>';
    $('detailContent').innerHTML = html;
    $('btnAnnotate').onclick = function() { annotateFromDetail(); };
    openModal('detailModal');
}

function annotateFromDetail() {
    closeModal('detailModal');
    enterAnnotateMode(STATE.currentHouseholdId);
}

function editFromDetail() {
    closeModal('detailModal');
    editHousehold(STATE.currentHouseholdId);
}

// ==================== 坐标联动 ====================

function onCoordChange() {
    const x = parseFloat($('hhLat').value);
    const y = parseFloat($('hhLng').value);
    if (!isNaN(x) && !isNaN(y)) {
        // 如果地图已加载，飞到该坐标
        const groupConfig = window.APP_CONFIG.groupAerialConfig || {};
        const currentGroup = MAP_STATE.currentGroup;
        const gc = groupConfig[currentGroup];
        if (gc && x >= 0 && x <= gc.width && y >= 0 && y <= gc.height) {
            flyToHousehold(x, y, STATE.currentHouseholdId || 0);
        }
    }
}

// ==================== 成员 CRUD ====================

function showAddMemberDialog(hhId) {
    $('memberModalTitle').textContent = '添加成员';
    $('memberId').value = ''; $('memberHhId').value = hhId;
    ['memberCode','memberName','memberIdCard','memberPhone','memberNotes'].forEach(id => {
        if ($(id)) $(id).value = '';
    });
    $('memberRelation').value = ''; $('memberGender').value = '';
    ['memberBirth'].forEach(id => { if ($(id)) $(id).value = ''; });
    openModal('memberModal');
}

async function editMember(mId, hhId) {
    const res = await api(`/api/households/${hhId}`);
    if (res.code !== 0) return;
    const member = res.data.members.find(m => m.id === mId);
    if (!member) { showToast('成员不存在', 'error'); return; }
    $('memberModalTitle').textContent = '编辑成员';
    $('memberId').value = member.id; $('memberHhId').value = hhId;
    $('memberCode').value = member.member_code || '';
    $('memberName').value = member.name;
    $('memberIdCard').value = member.id_card;
    $('memberPhone').value = member.phone;
    $('memberRelation').value = member.relation;
    $('memberGender').value = member.gender;
    $('memberBirth').value = member.birth_date;
    $('memberNotes').value = member.notes;
    closeModal('detailModal');
    openModal('memberModal');
}

async function saveMember() {
    const data = {
        member_code: $('memberCode').value.trim(),
        name: $('memberName').value.trim(),
        id_card: $('memberIdCard').value.trim(),
        phone: $('memberPhone').value.trim(),
        relation: $('memberRelation').value,
        gender: $('memberGender').value,
        birth_date: $('memberBirth').value,
        notes: $('memberNotes').value.trim(),
    };
    if (!data.name) { showToast('姓名为必填项', 'error'); return; }

    const mId = $('memberId').value; const hhId = $('memberHhId').value;
    let res;
    if (mId) {
        res = await api(`/api/members/${mId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
        res = await api(`/api/households/${hhId}/members`, { method: 'POST', body: JSON.stringify(data) });
    }
    if (res.code === 0) {
        showToast(res.msg || '保存成功');
        closeModal('memberModal');
        showDetail(hhId);
        await loadHouseholds(STATE.currentPage);
        await loadStats();
    } else { showToast(res.msg || '保存失败', 'error'); }
}

async function deleteMember(mId, name, hhId) {
    if (!confirm(`确定要删除成员【${name}】吗？`)) return;
    const res = await api(`/api/members/${mId}`, { method: 'DELETE' });
    if (res.code === 0) {
        showToast('删除成功');
        showDetail(hhId);
        await loadHouseholds(STATE.currentPage);
        await loadStats();
    } else { showToast(res.msg || '删除失败', 'error'); }
}

// ==================== 照片预览 ====================

function previewPhoto(input, previewId) {
    const preview = $(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    } else { preview.style.display = 'none'; }
}

// ==================== Excel 导入 ====================

function showImportDialog() {
    $('importFile').value = '';
    $('importResult').style.display = 'none';
    openModal('importModal');
}

async function doImport() {
    const file = $('importFile').files[0];
    if (!file) { showToast('请选择文件', 'error'); return; }

    const resultDiv = $('importResult');
    resultDiv.style.display = 'block';
    resultDiv.className = 'import-result';
    resultDiv.textContent = '正在导入，请稍候...';

    const res = await uploadFile('/api/import-excel', file);

    if (res.code === 0) {
        const d = res.data;
        const hasWarnings = d.errors && d.errors.length > 0;
        resultDiv.className = `import-result ${hasWarnings ? 'warning' : 'success'}`;
        let html = `<strong>✅ 导入完成</strong><br>`;
        html += `新增户：${d.households_created} | 更新户：${d.households_updated}<br>`;
        html += `新增成员：${d.members_created}<br>`;
        html += `<span style="font-size:12px;color:#888;">工作表：${(d.sheets_found || []).join(', ')}</span>`;
        if (hasWarnings) {
            html += `<br><strong>⚠️ 提示：</strong><br>${d.errors.map(e => esc(e)).join('<br>')}`;
        }
        resultDiv.innerHTML = html;
        await loadHouseholds(STATE.currentPage);
        await refreshMapMarkers();
        await loadStats();
    } else {
        resultDiv.className = 'import-result error';
        let errHtml = `<strong>❌ 导入失败</strong><br>${esc(res.msg || '未知错误')}`;
        if (res.data) {
            const d = res.data;
            if (d.sheets_found && d.sheets_found.length > 0) {
                errHtml += `<br><br>📋 Excel 中的工作表：${d.sheets_found.join(', ')}`;
            }
            if (d.errors && d.errors.length > 0) {
                errHtml += `<br><br>${d.errors.map(e => esc(e)).join('<br>')}`;
            }
        }
        resultDiv.innerHTML = errHtml;
    }
}
