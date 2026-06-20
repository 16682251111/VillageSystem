/**
 * 村户信息管理系统 - 数据表格 & 弹窗交互模块
 * 处理户列表、搜索筛选、CRUD、Excel导入等交互逻辑。
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
    if (res.code !== 0) {
        showToast(res.msg || '加载失败', 'error');
        return;
    }

    renderTable(res.data);
    renderPagination(res.data);
}

function handleSearch() {
    loadHouseholds(1);
}

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
            <td><span class="type-badge" style="background:${getTypeColor(hh.house_type)};color:#fff;padding:2px 8px;border-radius:10px;font-size:12px;">${esc(hh.house_type)}</span></td>
            <td>${hh.member_count}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-primary" onclick="showDetail(${hh.id})" title="详情">📋</button>
                <button class="btn btn-sm btn-default" onclick="editHousehold(${hh.id})" title="编辑">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteHousehold(${hh.id}, '${esc(hh.householder_name)}')" title="删除">🗑</button>
            </td>
        </tr>
    `).join('');
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== 分页 ====================

function renderPagination(data) {
    const pg = $('pagination');
    if (data.pages <= 1) {
        pg.innerHTML = '';
        return;
    }
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
    // 清空表单
    ['hhId','hhNumber','hhName','hhPhone','hhAddress','hhLat','hhLng','hhNotes','hhPhotoPath'].forEach(id => $(id).value = '');
    $('hhGroup').value = '';
    $('hhType').value = '一般户';
    $('photoPreview').style.display = 'none';
    $('hhPhoto').value = '';
    openModal('householdModal');
    setTimeout(() => MAP_STATE.map && MAP_STATE.map.invalidateSize(), 200);
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
    $('hhPhotoPath').value = hh.photo_path || '';
    if (hh.photo_path) {
        $('photoPreview').src = hh.photo_path;
        $('photoPreview').style.display = 'block';
    } else {
        $('photoPreview').style.display = 'none';
    }
    $('hhPhoto').value = '';
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
        photo_path: $('hhPhotoPath').value,
        notes: $('hhNotes').value.trim(),
    };

    if (!data.house_number || !data.householder_name) {
        showToast('户编号和户主姓名为必填项', 'error'); return;
    }

    // 如果有新照片，先上传
    const photoFile = $('hhPhoto').files[0];
    if (photoFile) {
        const upRes = await uploadFile('/api/households/upload-photo', photoFile);
        if (upRes.code === 0) {
            data.photo_path = upRes.data.url;
        } else {
            showToast('照片上传失败: ' + upRes.msg, 'error'); return;
        }
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
    } else {
        showToast(res.msg || '删除失败', 'error');
    }
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
                <div class="detail-item"><span class="detail-label">户编号：</span>${esc(hh.house_number)}</div>
                <div class="detail-item"><span class="detail-label">户主：</span>${esc(hh.householder_name)}</div>
                <div class="detail-item"><span class="detail-label">电话：</span>${esc(hh.householder_phone)}</div>
                <div class="detail-item"><span class="detail-label">小组：</span>${esc(hh.group_name)}</div>
                <div class="detail-item"><span class="detail-label">类型：</span>${esc(hh.house_type)}</div>
                <div class="detail-item"><span class="detail-label">地址：</span>${esc(hh.address)}</div>
                <div class="detail-item"><span class="detail-label">图上位置：</span>${hh.latitude != null ? 'X=' + Math.round(hh.latitude) + ' Y=' + Math.round(hh.longitude) : '未标注'}</div>
                <div class="detail-item"><span class="detail-label">备注：</span>${esc(hh.notes)}</div>
            </div>
            ${hh.photo_path ? `<img src="${hh.photo_path}" class="detail-photo" alt="照片">` : ''}
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
                        ${m.relation ? `<span style="color:#999;">(${esc(m.relation)})</span>` : ''}
                        ${m.gender ? `<span> | ${esc(m.gender)}</span>` : ''}
                        ${m.phone ? `<span> | 📞${esc(m.phone)}</span>` : ''}
                        ${m.id_card ? `<br><span style="font-size:12px;color:#aaa;">身份证：${esc(m.id_card)}</span>` : ''}
                        ${m.birth_date ? `<span style="font-size:12px;color:#aaa;"> | 出生：${esc(m.birth_date)}</span>` : ''}
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
    openModal('detailModal');
}

function editFromDetail() {
    closeModal('detailModal');
    editHousehold(STATE.currentHouseholdId);
}

// ==================== 成员 CRUD ====================

function showAddMemberDialog(hhId) {
    $('memberModalTitle').textContent = '添加成员';
    $('memberId').value = '';
    $('memberHhId').value = hhId;
    ['memberName','memberIdCard','memberPhone','memberNotes'].forEach(id => $(id).value = '');
    $('memberRelation').value = '';
    $('memberGender').value = '';
    $('memberBirth').value = '';
    openModal('memberModal');
}

async function editMember(mId, hhId) {
    // 通过详情弹窗已有的数据直接获取成员信息
    // 这里简化处理：从DOM中读取（实际项目中可调API）
    const res = await api(`/api/households/${hhId}`);
    if (res.code !== 0) return;
    const member = res.data.members.find(m => m.id === mId);
    if (!member) { showToast('成员不存在', 'error'); return; }

    $('memberModalTitle').textContent = '编辑成员';
    $('memberId').value = member.id;
    $('memberHhId').value = hhId;
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
        name: $('memberName').value.trim(),
        id_card: $('memberIdCard').value.trim(),
        phone: $('memberPhone').value.trim(),
        relation: $('memberRelation').value,
        gender: $('memberGender').value,
        birth_date: $('memberBirth').value,
        notes: $('memberNotes').value.trim(),
    };

    if (!data.name) { showToast('姓名为必填项', 'error'); return; }

    const mId = $('memberId').value;
    const hhId = $('memberHhId').value;

    let res;
    if (mId) {
        res = await api(`/api/members/${mId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
        res = await api(`/api/households/${hhId}/members`, { method: 'POST', body: JSON.stringify(data) });
    }

    if (res.code === 0) {
        showToast(res.msg || '保存成功');
        closeModal('memberModal');
        showDetail(hhId);  // 刷新详情
        await loadHouseholds(STATE.currentPage);
        await loadStats();
    } else {
        showToast(res.msg || '保存失败', 'error');
    }
}

async function deleteMember(mId, name, hhId) {
    if (!confirm(`确定要删除成员【${name}】吗？`)) return;
    const res = await api(`/api/members/${mId}`, { method: 'DELETE' });
    if (res.code === 0) {
        showToast('删除成功');
        showDetail(hhId);  // 刷新详情
        await loadHouseholds(STATE.currentPage);
        await loadStats();
    } else {
        showToast(res.msg || '删除失败', 'error');
    }
}

// ==================== 照片预览 ====================

function previewPhoto(input) {
    const preview = $('photoPreview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
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
        if (d.hh_sheet_used) html += `<span style="font-size:12px;color:#888;">户表：${esc(d.hh_sheet_used)}</span><br>`;
        if (d.member_sheet_used) html += `<span style="font-size:12px;color:#888;">成员表：${esc(d.member_sheet_used)}</span>`;
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
            if (d.hh_sheet_used) {
                errHtml += `<br>📄 使用的户表：${esc(d.hh_sheet_used)}`;
                if (d.hh_headers_found && d.hh_headers_found.length > 0) {
                    errHtml += `<br>📝 户表表头：${d.hh_headers_found.join(', ')}`;
                }
            }
            if (d.errors && d.errors.length > 0) {
                errHtml += `<br><br>${d.errors.map(e => esc(e)).join('<br>')}`;
            }
        }
        resultDiv.innerHTML = errHtml;
    }
}
