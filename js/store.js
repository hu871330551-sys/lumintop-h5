// 本地存储：收藏 / 浏览历史（与小程序 utils/store.js 行为一致）
(function () {
    var KEY_FAV = 'lumintop.favs';
    var KEY_HIS = 'lumintop.history';

    function read(key) {
        try {
            var v = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(v) ? v : [];
        } catch (e) {
            return [];
        }
    }

    function write(key, list) {
        try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* 隐私模式忽略 */ }
    }

    var store = {
        favs: function () { return read(KEY_FAV); },
        history: function () { return read(KEY_HIS); },
        isFavorite: function (id) { return read(KEY_FAV).indexOf(id) >= 0; },
        toggleFavorite: function (id) {
            var list = read(KEY_FAV);
            var i = list.indexOf(id);
            if (i >= 0) list.splice(i, 1); else list.unshift(id);
            write(KEY_FAV, list);
            return i < 0;
        },
        addHistory: function (id) {
            if (!id) return;
            var list = read(KEY_HIS).filter(function (v) { return v !== id; });
            list.unshift(id);
            if (list.length > 50) list.length = 50;
            write(KEY_HIS, list);
        },
        clearHistory: function () { write(KEY_HIS, []); },
    };

    window.lumintopStore = store;
})();
