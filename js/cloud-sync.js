// 云端数据同步：云服务开通并填好 cloud-config 后自动拉取 products 表（公开只读）
// 表结构见项目 cloud/seed/schema.sql：slug 唯一键 + sort_index + data(JSONB 完整档案)
// 数据到达后走 model.applyRemote() 重建目录，页面自动刷新 —— 与小程序 utils/cloud.js 同构
(function () {
    var CLOUD = window.LUMINTOP_CLOUD || {};

    function loadSdk(cb) {
        if (window.WorkBuddyCloud && window.WorkBuddyCloud.createWorkBuddyCloud) return cb();
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js';
        s.onload = cb;
        s.onerror = function () { console.warn('[cloud] SDK 加载失败，继续使用本地数据'); };
        document.head.appendChild(s);
    }

    function sync() {
        if (!CLOUD.enabled || !CLOUD.endpoint || !CLOUD.publishableKey) return;
        loadSdk(function () {
            try {
                var cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
                    endpoint: CLOUD.endpoint,
                    publishableKey: CLOUD.publishableKey,
                });
                cloud.database
                    .from('products')
                    .select('slug, sort_index, data')
                    .order('sort_index', { ascending: true })
                    .then(function (res) {
                        if (res.error) {
                            console.warn('[cloud] 拉取失败：', res.error.message || res.error);
                            return;
                        }
                        var rows = (res.data || []).map(function (r) {
                            var p = Object.assign({}, r.data || {});
                            if (r.slug) p.id = p.id || r.slug;
                            p.sortIndex = r.sort_index;
                            return p;
                        });
                        var ok = window.lumintopModel.applyRemote(rows);
                        if (ok) console.log('[cloud] 已同步云端产品数据 v1，共 ' + rows.length + ' 款');
                    });
            } catch (e) {
                console.warn('[cloud] 客户端初始化失败：', e && e.message);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else {
        sync();
    }
})();
