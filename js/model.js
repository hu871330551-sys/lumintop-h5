// 数据模型层：与小程序 data/model.js + data/variants.js + utils/media.js 同构
// 页面只消费这里产出的结构；云端数据到达时 applyRemote() 重建目录并通知页面刷新
(function () {
    var CLOUD = window.LUMINTOP_CLOUD || {};

    /* ---------- 媒体路径映射（utils/media.js 的 H5 版） ---------- */
    var PLACEHOLDER = './assets/placeholder.jpg';

    function mediaUrl(ref) {
        var s = String(ref || '');
        // 已经是完整 URL / 本地相对路径的，原样返回
        if (/^(https?:|\.\/|\/)/.test(s) && !/^\/assets\//.test(s)) return s || PLACEHOLDER;
        var m = s.match(/^\/assets\/(products|lights)\/(.+)$/);
        if (!m) return s || PLACEHOLDER;
        // mediaBase 独立生效：云端开通后填云存储桶，本地预览版填本地服务地址均可
        if (CLOUD.mediaBase) {
            return CLOUD.mediaBase.replace(/\/?$/, '/') + m[1] + '/' + m[2];
        }
        return './media/' + m[1] + '/' + m[2];
    }

    function mapProduct(p) {
        if (!p) return p;
        var q = {};
        for (var k in p) q[k] = p[k];
        if (q.cover) q.cover = mediaUrl(q.cover);
        if (Array.isArray(q.gallery)) q.gallery = q.gallery.map(mediaUrl);
        if (q.lightScene) q.lightScene = mediaUrl(q.lightScene);
        if (Array.isArray(q.lightScenes)) q.lightScenes = q.lightScenes.map(mediaUrl);
        if (Array.isArray(q.lightMedia)) {
            q.lightMedia = q.lightMedia.map(function (m) {
                if (!m || !m.src) return m;
                var out = {};
                for (var k in m) out[k] = m[k];
                out.src = mediaUrl(m.src);
                if (m.poster) out.poster = mediaUrl(m.poster);
                return out;
            });
        }
        if (Array.isArray(q.colors)) {
            q.colors = q.colors.map(function (c) {
                return c && c.img ? Object.assign({}, c, { img: mediaUrl(c.img) }) : c;
            });
        }
        return q;
    }

    /* ---------- 颜色 / 材质 / 光照素材（variants.js） ---------- */
    var COLORS = {
        ti: [
            { name: '钛灰', hex: '#8E949E' },
            { name: '哑黑', hex: '#1A1D22' },
            { name: '沙色', hex: '#C9B18A' },
        ],
        edc: [
            { name: '哑黑', hex: '#1A1D22' },
            { name: '原色银', hex: '#BFC4CC' },
            { name: '午夜蓝', hex: '#2A3446' },
        ],
        tactic: [
            { name: '战术黑', hex: '#181B20' },
            { name: '军绿', hex: '#4A5142' },
            { name: '沙棕', hex: '#8A6A44' },
        ],
        long: [
            { name: '哑黑', hex: '#14171C' },
            { name: '石墨灰', hex: '#565C66' },
        ],
        camp: [
            { name: '哑黑', hex: '#1A1D22' },
            { name: '暖橙', hex: '#D9691F' },
            { name: '米白', hex: '#E2E0D8' },
        ],
        rainbow: [
            { name: '钛彩', hex: '#7A6FA8' },
            { name: '钛灰', hex: '#8E949E' },
            { name: '哑黑', hex: '#1A1D22' },
            { name: '铜色', hex: '#A9682F' },
        ],
    };

    var MATERIALS = ['铝合金', '不锈钢', '钛合金', 'HA III 硬质氧化'];

    var GROUPS = [
        { test: /^(EDC|FW|D\d)/i, colors: 'edc', mat: [0, 3] },
        { test: /^(THOR|GT|T90|PK90)/i, colors: 'long', mat: [0, 2] },
        { test: /^(MACH|TIGER|BLACK)/i, colors: 'tactic', mat: [0, 1] },
        { test: /^(W\d|F0\d|POWER|THANOS)/i, colors: 'camp', mat: [0, 3] },
        { test: /^RAINBOW/i, colors: 'rainbow', mat: [2, 0] },
    ];

    var DEFAULT_GROUP = { colors: 'ti', mat: [0, 1] };

    var OVERRIDES = {
        'p55-rainbow': { colors: 'rainbow', mat: [2, 0] },
        'p56-thor-5': { colors: 'tactic', mat: [0, 2] },
        'p26-gt-nano-5-0': { colors: 'ti', mat: [2, 0] },
    };

    function pickGroup(model) {
        for (var i = 0; i < GROUPS.length; i += 1) {
            if (GROUPS[i].test.test(model || '')) return GROUPS[i];
        }
        return DEFAULT_GROUP;
    }

    function variantsFor(product) {
        if (product.colors && product.colors.length) {
            var g = OVERRIDES[product.id] || pickGroup(product.model);
            return {
                colors: product.colors,
                materials: (product.materials && product.materials.length)
                    ? product.materials
                    : g.mat.map(function (i) { return MATERIALS[i]; }),
            };
        }
        var gg = OVERRIDES[product.id] || pickGroup(product.model);
        // 预设色兜底：后台没配置配色时按型号组显示预设色；后台一旦配置即自动覆盖
        return {
            colors: COLORS[gg.colors] || [],
            materials: gg.mat.map(function (i) { return MATERIALS[i]; }),
        };
    }

    var VIDEO_RE = /\.(mp4|mov|m4v|webm)(\?|$)/i;

    function lightsFor(product) {
        if (product && Array.isArray(product.lightMedia) && product.lightMedia.length) {
            return product.lightMedia.map(function (m) {
                var src = String((m && m.src) || '');
                if (!src) return null;
                var type = m.type === 'video' || m.type === 'image'
                    ? m.type
                    : (VIDEO_RE.test(src) ? 'video' : 'image');
                var item = { type: type, src: src };
                if (type === 'video' && m.poster) item.poster = m.poster;
                return item;
            }).filter(Boolean);
        }
        if (product && Array.isArray(product.lightScenes) && product.lightScenes.length) {
            return product.lightScenes.map(function (src) {
                return { type: VIDEO_RE.test(src) ? 'video' : 'image', src: src };
            });
        }
        if (product && product.lightScene) {
            return [{ type: VIDEO_RE.test(product.lightScene) ? 'video' : 'image', src: product.lightScene }];
        }
        return [];
    }

    /* ---------- 展示模型（model.js） ---------- */
    var SPEC_ORDER = ['光源', '功率', '光强', '电池', '防水', '防跌落', '尺寸', '净重'];

    function fmtNum(n) {
        if (!n) return '';
        if (!Number.isInteger(Number(n))) return String(n);
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function fmtRun(h) {
        if (!h) return '—';
        if (h >= 24) {
            var d = h / 24;
            return (d >= 10 ? Math.round(d) : Math.round(d * 10) / 10) + ' 天';
        }
        return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + ' h';
    }

    function fmtPrice(p) {
        if (!p) return '询价';
        return '¥' + fmtNum(p);
    }

    function pretty(s) {
        return String(s == null ? '' : s).replace(/\*/g, '×').trim();
    }

    function waterProof(spec) {
        var m = String(spec || '').replace(/[\s-]/g, '').match(/IP[X0-9]{1,2}/i);
        return m ? m[0].toUpperCase() : '—';
    }

    function buildMetrics(p) {
        return [
            { key: 'lum', label: '最高亮度', value: p.lumMax ? fmtNum(p.lumMax) : '—', unit: p.lumMax ? 'lm' : '' },
            { key: 'throw', label: '最远射程', value: p.throwMax ? fmtNum(p.throwMax) : '—', unit: p.throwMax ? 'm' : '' },
            { key: 'run', label: '最大续航', value: p.runMax ? fmtRun(p.runMax) : '—', unit: '' },
            { key: 'ip', label: '防水等级', value: waterProof(p.specs['防水']), unit: '' },
        ];
    }

    function buildSpecs(p) {
        var list = [];
        SPEC_ORDER.forEach(function (k) {
            if (p.specs[k]) list.push({ k: k, v: pretty(p.specs[k]) });
        });
        return list;
    }

    function buildFullSpecs(p) {
        return [
            { k: '光源', v: pretty(p.specs['光源']) || '—' },
            { k: '功率', v: pretty(p.specs['功率']) || '—' },
            { k: '光强', v: pretty(p.specs['光强']).replace(/\d{4,}/, function (n) { return fmtNum(Number(n)); }) || '—' },
            { k: '最高亮度', v: p.lumMax ? fmtNum(p.lumMax) + ' lm' : '—' },
            { k: '最远射程', v: p.throwMax ? fmtNum(p.throwMax) + ' m' : '—' },
            { k: '最大续航', v: p.runMax ? fmtRun(p.runMax) : '—' },
            { k: '档位数', v: p.gears.length ? p.gears.length + ' 档' : '—' },
            { k: '电池', v: pretty(p.specs['电池']) || '—' },
            { k: '防水等级', v: pretty(p.specs['防水']) || '—' },
            { k: '防跌落', v: pretty(p.specs['防跌落']) || '—' },
            { k: '尺寸', v: pretty(p.specs['尺寸']) || '—' },
            { k: '净重', v: pretty(p.specs['净重']) || '—' },
        ];
    }

    // 档位续航：带单位文本原样展示；纯数字按小时折算
    function fmtGearRun(h) {
        if (!h) return '—';
        if (typeof h === 'string') {
            var s = h.trim();
            if (!s) return '—';
            if (!/^-?\d+(?:\.\d+)?$/.test(s)) return s;
            h = Number(s);
        }
        if (!Number.isFinite(h)) return '—';
        if (h < 48) return (Number.isInteger(h) ? h : Math.round(h * 10) / 10) + ' h';
        return (h >= 240 ? Math.round(h / 24) : Math.round((h / 24) * 10) / 10) + ' 天';
    }

    function buildGears(p) {
        return p.gears.map(function (g) {
            return {
                name: g.name,
                lum: g.lum ? fmtNum(g.lum) : '—',
                run: g.runtime ? fmtGearRun(g.runtime) : '—',
                thr: g.throw ? fmtNum(g.throw) : '—',
            };
        });
    }

    // 配色支持独立定价：颜色对象带 price 字段时，选中该配色显示对应价格；
    // 未配置 price 的配色沿用产品默认价
    function buildOptions(colors) {
        return (colors || []).map(function (c) {
            return {
                name: c.name,
                hex: c.hex,
                img: c.img,
                label: c.name,
                price: c.price || null,
                priceText: c.price ? fmtPrice(c.price) : null,
            };
        });
    }

    function enrich(p) {
        var v = variantsFor(p);
        var cover = p.cover || PLACEHOLDER;
        var gears = buildGears(p);
        var lights = lightsFor(p);
        var shops = (Array.isArray(p.shops) ? p.shops : []).filter(function (s) { return s && s.url; })
            .map(function (s) { return { name: s.name || '官方店', url: s.url }; });
        var gearReady = gears.filter(function (g) { return g.lum !== '—'; }).length >= 2;
        return {
            id: p.id,
            model: p.model,
            subtitle: p.subtitle || '',
            category: p.category || '通用',
            cover: cover,
            hasPhoto: !!p.cover,
            price: p.price,
            priceText: fmtPrice(p.price),
            releaseAt: p.releaseAt,
            colors: v.colors,
            materials: v.materials,
            options: buildOptions(v.colors),
            gallery: (function () {
                var g = (Array.isArray(p.gallery) ? p.gallery : []).filter(Boolean).map(mediaUrl);
                return g.length ? g : [cover];
            })(),
            lights: lights,
            lightCount: lights.length,
            shopCount: shops.length,
            shops: shops,
            shopLabel: (shops[0] && shops[0].name) || '官方店',
            hasShop: shops.length > 0,
            metrics: buildMetrics(p),
            specs: buildSpecs(p),
            fullSpecs: buildFullSpecs(p),
            gears: gears,
            gearReady: gearReady,
            lumMax: p.lumMax,
            throwMax: p.throwMax,
            runMax: p.runMax,
        };
    }

    /* ---------- 目录构建 + 变更通知 ---------- */
    var listeners = [];

    function onChange(fn) {
        listeners.push(fn);
        return function () {
            var i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    function notify() {
        listeners.slice().forEach(function (fn) {
            try { fn(); } catch (e) { /* 单页异常不影响其他页面 */ }
        });
    }

    var catalog = [];
    var byId = {};
    var lastRaw = [];

    var FILTER_ALIAS = {
        EDC: 'EDC 便携',
        战术户外: '战术户外',
        远射: '远射',
        多功能: '多功能',
        搜救: '搜救',
        通用: '通用',
    };

    var CATEGORIES = ['全部', 'EDC 便携', '远射', '战术户外', '多功能', '搜救', '头灯营地', '通用'];

    function categoryOf(p) {
        if (p.category && p.category !== '通用' && FILTER_ALIAS[p.category]) return FILTER_ALIAS[p.category];
        var m = (p.model || '').toUpperCase();
        if (/^(EDC|FW|D\d|PICO)/.test(m)) return 'EDC 便携';
        if (/^(THOR|GT|T90|PK90|L4)/.test(m)) return '远射';
        if (/^(W\d|F0|POWER|THANOS|AURORA)/.test(m)) return '头灯营地';
        if (/^(MACH|TIGER|BLACK|AK|B01)/.test(m)) return '战术户外';
        return '通用';
    }

    function rebuildCatalog(rawList) {
        lastRaw = rawList || [];
        var sorted = (rawList || []).slice().sort(function (a, b) {
            if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
            if (a.sortIndex != null) return -1;
            if (b.sortIndex != null) return 1;
            return String(b.releaseAt || '').localeCompare(String(a.releaseAt || ''));
        });
        var items = sorted.map(function (p, i) {
            var item = enrich(mapProduct(p));
            item.sortIndex = i;
            item.filter = categoryOf(p);
            item.isNew = i < 3;
            return item;
        });
        catalog.length = 0;
        items.forEach(function (item) { catalog.push(item); });
        Object.keys(byId).forEach(function (k) { delete byId[k]; });
        catalog.forEach(function (p) { byId[p.id] = p; });
    }

    function applyRemote(rows) {
        if (!Array.isArray(rows) || !rows.length) return false;
        rebuildCatalog(rows);
        notify();
        return true;
    }

    function query(keyword, category) {
        var kw = String(keyword || '').trim().toLowerCase();
        return catalog.filter(function (p) {
            if (category && category !== '全部' && p.filter !== category) return false;
            if (!kw) return true;
            var hay = (p.model + ' ' + p.subtitle + ' ' + p.filter).toLowerCase();
            return hay.indexOf(kw) >= 0;
        });
    }

    // 本地打包数据先构建（云端数据到达后由 applyRemote 覆盖）
    rebuildCatalog(window.LUMINTOP_PRODUCTS || []);

    window.lumintopModel = {
        catalog: catalog,
        byId: byId,
        CATEGORIES: CATEGORIES,
        query: query,
        fmtNum: fmtNum,
        fmtRun: fmtRun,
        applyRemote: applyRemote,
        onChange: onChange,
        mediaUrl: mediaUrl,
        PLACEHOLDER: PLACEHOLDER,
    };
})();
