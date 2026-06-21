/**
 * 村户信息管理系统 - 主入口 & 通用工具
 */

// 全局状态
const STATE = {
    currentPage: 1,
    currentHouseholdId: null,
};

// 工具函数
function $(id) { return document.getElementById(id); }

function showToast(msg, type = 'success') {
    const toast = $('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

async function api(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        return { code: 1, msg: '网络错误: ' + err.message };
    }
}

async function uploadFile(url, file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(url, { method: 'POST', body: formData });
        return await res.json();
    } catch (err) {
        return { code: 1, msg: '上传失败: ' + err.message };
    }
}

function openModal(id) { $(id).classList.add('show'); }
function closeModal(id) {
    $(id).classList.remove('show');
    // 关闭详情弹窗时退出标注模式
    if (id === 'detailModal' && MAP_STATE && MAP_STATE.annotateMode) {
        if (typeof exitAnnotateMode === 'function') exitAnnotateMode();
    }
}

// 点击遮罩关闭
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('show');
    });
});

// ESC 关闭
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
        if (typeof exitAnnotateMode === 'function') exitAnnotateMode();
    }
});

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 初始化
async function initApp() {
    initMap();
    await loadHouseholds();
    await loadStats();
}

function loadStats() {
    api('/api/stats').then(res => {
        if (res.code === 0) {
            const d = res.data;
            $('stats-info').textContent =
                `共 ${d.total_households} 户 | ${d.total_members} 人 | 地图标注 ${d.with_coords} 户`;
        }
    });
}

document.addEventListener('DOMContentLoaded', initApp);
