// 雷明兔产品画册 H5 —— 路由 + 视图渲染
// 视图与小程序页面一一对应：deck=pages/index、library=pages/library、
// viewer=pages/viewer、profile=pages/profile、poster=pages/poster
(function () {
    var appEl = document.getElementById('app');
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightbox-img');
    var store = window.lumintopStore;
    var model = window.lumintopModel;
    var CLOUD = window.LUMINTOP_CLOUD || {};

    /* ---------- 工具 ---------- */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    var toastTimer = null;
    function toast(msg) {
        var el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 1600);
    }

    function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add('show');
    }

    lightbox.addEventListener('click', function () {
        lightbox.classList.remove('show');
        lightboxImg.setAttribute('src', '');
    });

    // 图片加载失败兜底：预览版绝对地址取不到时退回同目录相对路径，再失败用占位图（绝不裂图）
    function imgFallback(e) {
        var img = e.target || e.srcElement;
        // 灯箱的 img 初始 src 为空，不参与兜底，否则会误显示占位图
        if (!img || img.id === 'lightbox-img' || img.dataset.fbk) return;
        img.dataset.fbk = '1';
        var src = img.getAttribute('src') || '';
        var rel = src.replace(/^https?:\/\/127\.0\.0\.1:8377\//, './');
        img.src = rel !== src ? rel : './assets/placeholder.jpg';
    }

    document.addEventListener('error', imgFallback, true);

    /* ---------- TabBar（画册 / 产品库 / 我的） ---------- */
    var TABS = [
        { key: 'deck', text: '画册', icon: './assets/tabbar/book.png', iconOn: './assets/tabbar/book-on.png' },
        { key: 'library', text: '产品', icon: './assets/tabbar/grid.png', iconOn: './assets/tabbar/grid-on.png' },
        { key: 'profile', text: '我的', icon: './assets/tabbar/user.png', iconOn: './assets/tabbar/user-on.png' },
    ];

    function tabbarHtml(active) {
        return '<div class="tabbar">' + TABS.map(function (t) {
            var on = t.key === active;
            return '<div class="tabbar-item' + (on ? ' on' : '') + '" data-tab="' + t.key + '">' +
                '<img src="' + (on ? t.iconOn : t.icon) + '" alt="">' +
                '<span>' + t.text + '</span></div>';
        }).join('') + '</div>';
    }

    appEl.addEventListener('click', function (e) {
        var tab = e.target.closest && e.target.closest('[data-tab]');
        if (tab && tab.classList.contains('tabbar-item')) {
            location.hash = '#/' + tab.dataset.tab;
        }
    });

    /* ---------- 画册首页（deck，竖向整页滑动） ---------- */
    var deckColorState = {};   // id -> 选中的配色下标
    var deckScroll = 0;

    function buildGal(p, ci) {
        var opt = p.options && p.options[ci];
        var head = (opt && opt.img) || p.cover;
        var out = [];
        if (head) out.push(head);
        (p.gallery && p.gallery.length ? p.gallery : []).slice(0, 8).forEach(function (v) {
            if (v && out.indexOf(v) < 0) out.push(v);
        });
        return out.length ? out : [p.cover];
    }

    function renderDeck() {
        var slides = model.catalog.map(function (p) {
            var ci = deckColorState[p.id] || 0;
            var sel = p.options[ci] || {};
            return {
                p: p,
                ci: ci,
                activeImg: (sel.img) || p.cover,
                activeLabel: sel.label || (p.colors[0] && p.colors[0].name) || '',
                // 选中配色配置了独立价格则随色切换，否则显示产品默认价
                activePrice: sel.priceText || p.priceText,
                priceChanged: !!sel.priceText && sel.priceText !== p.priceText,
            };
        });

        appEl.innerHTML =
            '<div class="page deck">' +
            '<div class="deck-nav"><div class="nav-inner">' +
            '<div class="brand"><span class="brand-en">LUMINTOP</span><span class="brand-cn">雷明兔 · 产品画册</span></div>' +
            '<div class="nav-count" id="go-library"><span>' + model.catalog.length + ' 款</span><span class="ico-search"><span class="ico-search-line"></span></span></div>' +
            '</div></div>' +
            '<div class="deck-swiper" id="deck-swiper">' +
            slides.map(function (s, si) {
                var p = s.p;
                return '<div class="deck-slide"><div class="card">' +
                    '<div class="stage" data-open="' + esc(p.id) + '">' +
                    '<img class="stage-img" src="' + esc(s.activeImg) + '" alt="">' +
                    '<span class="stage-tag">' + esc(s.activeLabel) + '</span>' +
                    '<span class="stage-cta' + (p.hasShop ? ' stage-cta-shop' : '') + '" data-cta="' + esc(p.id) + '">' +
                    (p.hasShop ? '去' + esc(p.shopLabel) + '看商品 ›' : '查看产品图集 ›') + '</span>' +
                    '</div>' +
                    '<div class="body">' +
                    '<div class="head"><div class="head-l"><div class="head-row"><span class="model">' + esc(p.model) + '</span>' +
                    (p.isNew ? '<span class="badge-new">NEW</span>' : '') +
                    '</div><span class="sub">' + esc(p.subtitle) + '</span></div>' +
                    '<div class="head-r"><span class="price">' + esc(s.activePrice) + '</span>' +
                    '<span class="price-note">' + (s.priceChanged ? '该配色价格' : '指导价') + '</span></div></div>' +
                    '<div class="opts"><div class="opts-inner">' +
                    p.options.map(function (c, i) {
                        return '<span class="opt' + (i === s.ci ? ' opt-on' : '') + '" data-color="' + esc(p.id) + '|' + i + '">' +
                            '<span class="dot" style="background:' + esc(c.hex) + '"></span>' + esc(c.label) + '</span>';
                    }).join('') +
                    '</div></div>' +
                    '<div class="grid">' +
                    p.metrics.map(function (v) {
                        return '<div class="cell"><div class="cell-v"><span class="cell-num">' + esc(v.value) + '</span>' +
                            (v.unit ? '<span class="cell-unit">' + esc(v.unit) + '</span>' : '') +
                            '</div><span class="cell-label">' + esc(v.label) + '</span></div>';
                    }).join('') +
                    '</div>' +
                    '<div class="entry" data-light="' + esc(p.id) + '"><span class="entry-ico"></span>' +
                    '<span class="entry-t">光照实拍' + (p.lightCount ? ' · ' + p.lightCount + ' 个素材' : ' · 待上传') + '</span>' +
                    '<span class="arrow"></span></div>' +
                    '<div class="spec-head"><span class="spec-title">技术参数</span><span class="spec-note">ANSI / NEMA FL1</span></div>' +
                    p.specs.slice(0, 3).map(function (row) {
                        return '<div class="spec-row"><span class="spec-k">' + esc(row.k) + '</span><span class="spec-v">' + esc(row.v) + '</span></div>';
                    }).join('') +
                    (!p.specs.length ? '<div class="spec-row"><span class="spec-k">—</span><span class="spec-v">参数整理中</span></div>' : '') +
                    '<div class="more" data-drawer="' + esc(p.id) + '"><span class="more-t">查看完整参数表 · 共 ' + p.fullSpecs.length + ' 项</span><span class="arrow"></span></div>' +
                    (si === 0 ? '<div class="hint">上滑 · 查看下一款产品</div>' : '<div style="flex:1"></div>') +
                    '</div></div></div>';
            }).join('') +
            '</div>' + tabbarHtml('deck') + '</div>';

        var swiper = document.getElementById('deck-swiper');
        swiper.scrollTop = deckScroll;
        swiper.addEventListener('scroll', function () { deckScroll = swiper.scrollTop; });

        document.getElementById('go-library').onclick = function () { location.hash = '#/library'; };

        appEl.querySelectorAll('[data-color]').forEach(function (el) {
            el.onclick = function () {
                var parts = el.dataset.color.split('|');
                var id = parts[0], ci = Number(parts[1]);
                deckColorState[id] = ci;
                deckScroll = swiper.scrollTop;
                renderDeck();
            };
        });
        appEl.querySelectorAll('[data-open]').forEach(function (el) {
            el.onclick = function (e) {
                if (e.target.closest('[data-cta]')) return;
                location.hash = '#/viewer/' + el.dataset.open;
            };
        });
        appEl.querySelectorAll('[data-cta]').forEach(function (el) {
            el.onclick = function (e) {
                e.stopPropagation();
                var p = model.byId[el.dataset.cta];
                if (p && p.hasShop) { toast('商品链接：' + p.shops[0].url); return; }
                location.hash = '#/viewer/' + el.dataset.cta;
            };
        });
        appEl.querySelectorAll('[data-light]').forEach(function (el) {
            el.onclick = function () { location.hash = '#/viewer/' + el.dataset.light + '?tab=light'; };
        });
        appEl.querySelectorAll('[data-drawer]').forEach(function (el) {
            el.onclick = function () { location.hash = '#/viewer/' + el.dataset.drawer + '?drawer=1'; };
        });
    }

    /* ---------- 产品库 ---------- */
    var libState = { kw: '', cat: '全部' };

    function renderLibrary() {
        var list = model.query(libState.kw, libState.cat);
        var total = model.catalog.length;

        appEl.innerHTML =
            '<div class="page lib-body" style="padding-top:0.88rem">' +
            '<div class="nav"><div class="nav-inner"><span class="nav-title">产品库</span><span class="nav-sub">共 ' + total + ' 款</span></div></div>' +
            '<div style="flex:1;min-height:0;display:flex;flex-direction:column;padding:0.08rem 0.32rem 0">' +
            '<div class="search"><span class="ico-search"><span class="ico-search-line"></span></span>' +
            '<input class="search-input" id="lib-kw" value="' + esc(libState.kw) + '" placeholder="搜索型号 / 系列 / 流明">' +
            (libState.kw ? '<span class="search-clear" id="lib-clear">✕</span>' : '') + '</div>' +
            '<div class="cats">' +
            model.CATEGORIES.map(function (c) {
                return '<span class="cat' + (c === libState.cat ? ' cat-on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</span>';
            }).join('') +
            '</div>' +
            '<div class="meta-row"><span class="meta-count">' + list.length + ' 款结果</span><span class="meta-sort">按上架时间 · 新品置顶</span></div>' +
            '<div class="lib-list">' +
            '<div class="cards">' +
            list.map(function (p) {
                var lum = p.metrics[0].value, thr = p.metrics[1].value;
                var meta = p.filter;
                if (lum !== '—') meta += ' · ' + lum + ' lm';
                else if (thr !== '—') meta += ' · ' + thr + ' m';
                return '<div class="pcard" data-open="' + esc(p.id) + '">' +
                    '<div class="pimg-wrap"><img class="pimg" src="' + esc(p.cover) + '" alt="">' +
                    (p.isNew ? '<span class="ptag">NEW</span>' : '') + '</div>' +
                    '<div class="pinfo"><span class="pmodel">' + esc(p.model) + '</span>' +
                    '<span class="pmeta">' + esc(meta) + '</span>' +
                    '<span class="pprice">' + esc(p.priceText) + '</span></div></div>';
            }).join('') +
            '</div>' +
            (!list.length ? '<div class="empty"><span class="empty-title">没有匹配的产品</span><span class="empty-text">换个型号关键词，或切回「全部」分类</span></div>' : '') +
            '<div class="list-foot">— 已展示全部 ' + total + ' 款 —</div>' +
            '</div></div>' + tabbarHtml('library') + '</div>';

        var kw = document.getElementById('lib-kw');
        kw.oninput = function () {
            libState.kw = kw.value;
            var pos = kw.selectionStart;
            renderLibrary();
            var next = document.getElementById('lib-kw');
            next.focus();
            try { next.setSelectionRange(pos, pos); } catch (e) { /* noop */ }
        };
        var clear = document.getElementById('lib-clear');
        if (clear) clear.onclick = function () { libState.kw = ''; renderLibrary(); };
        appEl.querySelectorAll('[data-cat]').forEach(function (el) {
            el.onclick = function () { libState.cat = el.dataset.cat; renderLibrary(); };
        });
        appEl.querySelectorAll('.pcard').forEach(function (el) {
            el.onclick = function () { location.hash = '#/viewer/' + el.dataset.open; };
        });
    }

    /* ---------- 产品详情（viewer） ---------- */
    function renderViewer(id, opts) {
        opts = opts || {};
        var p = model.byId[id] || model.catalog[0];
        if (!p) { location.hash = '#/deck'; return; }
        var tab = opts.tab || 'stage';
        var fav = store.isFavorite(p.id);
        var gal = buildGal(p, opts.ci || 0);
        var lights = p.lights;
        var selOpt = p.options[opts.ci || 0] || {};
        var vPrice = selOpt.priceText || p.priceText;
        var vPriceChanged = !!selOpt.priceText && selOpt.priceText !== p.priceText;

        var bodyHtml;
        if (tab === 'stage') {
            bodyHtml =
                '<div class="vstage" id="gal-wrap">' +
                '<div class="vstage-swiper" id="gal">' +
                gal.map(function (src) {
                    return '<div class="vstage-slide" data-preview="' + esc(src) + '"><img src="' + esc(src) + '" alt=""></div>';
                }).join('') +
                '</div>' +
                (gal.length > 1 ? '<span class="frame-badge" id="gal-badge">1 / ' + gal.length + '</span>' : '') +
                (gal.length > 1 ? '<div class="gal-dots">' + gal.map(function (_, i) {
                    return '<span class="gal-dot' + (i === 0 ? ' gal-dot-on' : '') + '"></span>';
                }).join('') + '</div>' : '') +
                (p.hasShop ? '<span class="stage-shop" data-shop="1">去' + esc(p.shopLabel) + '看实拍与价格 ›</span>' : '') +
                '</div>' +
                (!p.hasShop ? '<div class="notice"><span class="notice-t">还没配置平台商品链接</span>' +
                    '<span class="notice-d">后台「官方商城链接」填上京东 / 天猫等商品页地址后，这里会出现直达按钮。</span></div>' : '');
        } else {
            bodyHtml =
                '<div class="light-box">' +
                (!lights.length
                    ? '<div class="empty"><div class="bulb"></div><span class="empty-title">光照实拍素材待上传</span>' +
                      '<span class="empty-text">后台「光照实拍素材」支持上传多张实拍图片与多段视频，按上传顺序在这里左右滑动查看。</span></div>'
                    : '<div class="light-swiper" id="light-swiper">' +
                      lights.map(function (m) {
                          if (m.type === 'video') {
                              return '<div class="light-slide"><video class="light-media" src="' + esc(m.src) + '"' +
                                  (m.poster ? ' poster="' + esc(m.poster) + '"' : '') +
                                  ' controls playsinline muted loop></video></div>';
                          }
                          return '<div class="light-slide"><img class="light-media" src="' + esc(m.src) + '" alt=""></div>';
                      }).join('') +
                      '</div>' +
                      '<div class="light-bar"><span class="light-idx" id="light-idx">1 / ' + lights.length + '</span>' +
                      '<span class="light-kind" id="light-kind">' + (lights[0].type === 'video' ? '视频' : '图片') + '</span>' +
                      (lights.length > 1 ? '<span class="light-hint">左右滑动查看全部素材</span>' : '') + '</div>') +
                '</div>';
        }

        var gearsHtml;
        if (p.gearReady) {
            gearsHtml = '<div class="gear-head"><span class="g-name">档位</span><span class="g-cell">亮度</span><span class="g-cell">续航</span></div>' +
                p.gears.map(function (g) {
                    return '<div class="gear-row"><span class="g-name">' + esc(g.name) + '</span>' +
                        '<span class="g-cell">' + esc(g.lum) + '</span><span class="g-cell">' + esc(g.run) + '</span></div>';
                }).join('') +
                '<div class="block-tip">画册里以「50S+ 3H 20M」这类降档写法标注的档位不回填数值，待后台补录。</div>';
        } else if (p.gears.length) {
            gearsHtml = '<div class="gear-list">' + p.gears.map(function (g) {
                return '<span class="gear-chip">' + esc(g.name) + '</span>';
            }).join('') + '</div>' +
                '<div class="block-tip">该页只标了档位名，分档亮度与续航待后台补录。</div>';
        } else {
            gearsHtml = '<div class="block-tip">画册这一页是单档位版式，没有分档表。后台「档位参数」里可逐档添加档位名、亮度与续航。</div>';
        }

        appEl.innerHTML =
            '<div class="page vpage">' +
            '<div class="nav"><div class="nav-inner">' +
            '<span class="nav-back" id="v-back"><span class="nav-back-icon"></span></span>' +
            '<span class="nav-title">' + esc(p.model) + '<span class="nav-sub">' + esc(p.filter) + '</span></span>' +
            '<span class="fav' + (fav ? ' fav-on' : '') + '" id="v-fav"><span class="fav-star">' + (fav ? '★' : '☆') + '</span></span>' +
            '</div></div>' +
            '<div class="vtabs"><span class="vtab' + (tab === 'stage' ? ' vtab-on' : '') + '" data-vtab="stage">产品展示</span>' +
            '<span class="vtab' + (tab === 'light' ? ' vtab-on' : '') + '" data-vtab="light">光照实拍' + (p.lightCount ? ' · ' + p.lightCount : '') + '</span></div>' +
            '<div class="vscroll">' + bodyHtml +
            '<div class="block"><div class="block-head"><span class="block-title">颜色与材质</span>' +
            '<span class="block-note">' + esc((p.options[opts.ci || 0] || {}).label || '') + '</span></div>' +
            '<div class="opts"><div class="opts-inner">' +
            p.options.map(function (c, i) {
                return '<span class="opt' + (i === (opts.ci || 0) ? ' opt-on' : '') + '" data-ci="' + i + '">' +
                    '<span class="dot" style="background:' + esc(c.hex) + '"></span>' + esc(c.label) + '</span>';
            }).join('') + '</div></div>' +
            '<div class="vprice"><span class="vprice-n">' + esc(vPrice) + '</span>' +
            '<span class="vprice-note">' + (vPriceChanged ? '当前配色价格' : '官方指导价') + '</span></div></div>' +
            '<div class="vgrid">' + p.metrics.map(function (v) {
                return '<div class="cell"><div class="cell-v"><span class="cell-num">' + esc(v.value) + '</span>' +
                    (v.unit ? '<span class="cell-unit">' + esc(v.unit) + '</span>' : '') +
                    '</div><span class="cell-label">' + esc(v.label) + '</span></div>';
            }).join('') + '</div>' +
            '<div class="block"><div class="block-head"><span class="block-title">档位一览</span>' +
            '<span class="block-note">' + (p.gearReady ? p.gears.length + ' 档' : (p.gears.length ? p.gears.length + ' 档' : '待补录')) + '</span></div>' + gearsHtml + '</div>' +
            '<div class="tail">数据来源 · 产品画册（ANSI / NEMA FL1 标准）</div>' +
            '</div>' +
            '<div class="bar"><span class="bar-btn" id="bar-fav"><span class="bar-ico">' + (fav ? '★' : '☆') + '</span>收藏</span>' +
            '<span class="bar-btn" id="bar-spec">完整参数</span>' +
            '<span class="bar-btn" id="bar-share">分享</span>' +
            (p.hasShop ? '<span class="bar-btn primary" data-shop="1">去' + esc(p.shopLabel) + '买</span>' : '') +
            '</div>' +
            (opts.drawer ? renderDrawer(p) : '') +
            '</div>';

        document.getElementById('v-back').onclick = function () { history.back(); };
        document.getElementById('v-fav').onclick = function () { toggleFav(); renderViewer(id, opts); };
        document.getElementById('bar-fav').onclick = function () { toggleFav(); renderViewer(id, opts); };
        document.getElementById('bar-spec').onclick = function () { opts.drawer = true; renderViewer(id, opts); };
        document.getElementById('bar-share').onclick = function () { shareProduct(p); };

        appEl.querySelectorAll('[data-vtab]').forEach(function (el) {
            el.onclick = function () { renderViewer(id, Object.assign({}, opts, { tab: el.dataset.vtab })); };
        });
        appEl.querySelectorAll('[data-ci]').forEach(function (el) {
            el.onclick = function () {
                renderViewer(id, Object.assign({}, opts, { ci: Number(el.dataset.ci), drawer: opts.drawer }));
            };
        });
        appEl.querySelectorAll('[data-preview]').forEach(function (el) {
            el.onclick = function () { openLightbox(el.dataset.preview); };
        });
        appEl.querySelectorAll('[data-shop]').forEach(function (el) {
            el.onclick = function () {
                if (p.shops[0]) window.open(p.shops[0].url, '_blank');
            };
        });

        // 图集 / 光照轮播：滑动同步指示器
        var galEl = document.getElementById('gal');
        if (galEl) {
            galEl.addEventListener('scroll', function () {
                var i = Math.round(galEl.scrollLeft / galEl.clientWidth);
                var badge = document.getElementById('gal-badge');
                if (badge) badge.textContent = (i + 1) + ' / ' + gal.length;
                var dots = appEl.querySelectorAll('.gal-dot');
                dots.forEach(function (d, di) { d.classList.toggle('gal-dot-on', di === i); });
            });
        }
        var lightEl = document.getElementById('light-swiper');
        if (lightEl && lights.length) {
            lightEl.addEventListener('scroll', function () {
                var i = Math.round(lightEl.scrollLeft / lightEl.clientWidth);
                document.getElementById('light-idx').textContent = (i + 1) + ' / ' + lights.length;
                document.getElementById('light-kind').textContent = lights[i].type === 'video' ? '视频' : '图片';
            });
        }

        if (opts.drawer) bindDrawer(p, opts);
    }

    function renderDrawer(p) {
        return '<div class="mask" id="sheet-mask"></div>' +
            '<div class="sheet"><div class="sheet-top"><div class="sheet-handle"></div>' +
            '<div class="sheet-head"><span class="sheet-title">完整技术参数</span>' +
            '<span class="sheet-sub">' + esc(p.model) + ' · ' + p.fullSpecs.length + ' 项</span>' +
            '<span class="sheet-close" id="sheet-close">✕</span></div></div>' +
            '<div class="sheet-body"><div class="spec-grid">' +
            p.fullSpecs.map(function (s) {
                return '<div class="spec-item"><span class="spec-k">' + esc(s.k) + '</span><span class="spec-v">' + esc(s.v) + '</span></div>';
            }).join('') +
            '</div><div class="sheet-label">分档参数</div>' +
            (p.gearReady
                ? '<div class="gear-head"><span class="g-name">档位</span><span class="g-cell">亮度</span><span class="g-cell">续航</span></div>' +
                  p.gears.map(function (g) {
                      return '<div class="gear-row"><span class="g-name">' + esc(g.name) + '</span>' +
                          '<span class="g-cell">' + esc(g.lum) + '</span><span class="g-cell">' + esc(g.run) + '</span></div>';
                  }).join('')
                : (p.gears.length
                    ? '<div class="gear-list">' + p.gears.map(function (g) {
                        return '<span class="gear-chip">' + esc(g.name) + '</span>';
                    }).join('') + '</div>'
                    : '<div class="sheet-note">该页画册未提供分档表，档位数据待后台补录。</div>')) +
            '<div class="sheet-note">亮度单位为 lm；续航按 ANSI 标准自极亮档开始计时。</div></div>' +
            '<div class="sheet-actions"><span class="sheet-btn" id="sheet-poster">生成分享海报</span></div></div>';
    }

    function bindDrawer(p, opts) {
        document.getElementById('sheet-mask').onclick = function () { renderViewer(p.id, Object.assign({}, opts, { drawer: false })); };
        document.getElementById('sheet-close').onclick = function () { renderViewer(p.id, Object.assign({}, opts, { drawer: false })); };
        document.getElementById('sheet-poster').onclick = function () { location.hash = '#/poster/' + p.id; };
    }

    function toggleFav() {
        var m = location.hash.match(/viewer\/([^?]+)/);
        if (!m) return;
        var on = store.toggleFavorite(m[1]);
        toast(on ? '已收藏' : '已取消收藏');
        store.addHistory(m[1]);
    }

    function shareProduct(p) {
        var url = location.origin + location.pathname + '#/viewer/' + p.id;
        var text = p.model + ' · ' + p.metrics[0].value + ' 流明 / 射程 ' + p.metrics[1].value + ' 米';
        if (navigator.share) {
            navigator.share({ title: '雷明兔 · 产品画册', text: text, url: url }).catch(function () { /* 用户取消 */ });
        } else {
            copyText(url);
            toast('链接已复制，去粘贴分享吧');
        }
    }

    function copyText(t) {
        if (navigator.clipboard) { navigator.clipboard.writeText(t).catch(function () {}); return; }
        var ta = document.createElement('textarea');
        ta.value = t;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* noop */ }
        ta.remove();
    }

    /* ---------- 我的 ---------- */
    function renderProfile(mode) {
        mode = mode || 'fav';
        var favs = store.favs().map(function (id) { return model.byId[id]; }).filter(Boolean);
        var his = store.history().map(function (id) { return model.byId[id]; }).filter(Boolean);
        var list = mode === 'fav' ? favs : his;

        function rows(items) {
            return items.map(function (p) {
                var lum = p.metrics[0].value, thr = p.metrics[1].value;
                var meta = p.filter;
                if (lum !== '—') meta += ' · ' + lum + ' lm';
                else if (thr !== '—') meta += ' · ' + thr + ' m';
                return '<div class="row" data-open="' + esc(p.id) + '">' +
                    '<img class="row-img" src="' + esc(p.cover) + '" alt="">' +
                    '<div class="row-main"><span class="row-model">' + esc(p.model) + '</span>' +
                    '<span class="row-meta">' + esc(meta) + '</span></div>' +
                    '<span class="row-price">' + esc(p.priceText) + '</span></div>';
            }).join('');
        }

        appEl.innerHTML =
            '<div class="page mpage" style="padding-top:0.88rem">' +
            '<div class="nav"><div class="nav-inner"><span class="nav-title">我的</span></div></div>' +
            '<div style="overflow-y:auto;height:calc(100vh - 0.88rem)">' +
            '<div class="hero"><div class="hero-mark">L</div><div class="hero-txt">' +
            '<span class="hero-name">雷明兔 LUMINTOP</span><span class="hero-sub">产品画册 · ' + model.catalog.length + ' 款在册</span></div></div>' +
            '<div class="stats"><div class="stat' + (mode === 'fav' ? ' stat-on' : '') + '" data-pmode="fav">' +
            '<span class="stat-n">' + favs.length + '</span><span class="stat-l">收藏</span></div>' +
            '<div class="stat' + (mode === 'his' ? ' stat-on' : '') + '" data-pmode="his">' +
            '<span class="stat-n">' + his.length + '</span><span class="stat-l">最近浏览</span></div></div>' +
            (mode === 'fav'
                ? '<div class="pblock"><div class="pblock-head"><span class="pblock-title">我的收藏</span><span class="pblock-note">在详情页点 ☆ 收藏</span></div>' +
                  (favs.length ? rows(favs) : '<div class="empty"><span class="empty-title">还没有收藏</span><span class="empty-text">在任意产品详情页点右上角 ☆，就会出现在这里</span></div>') + '</div>'
                : '<div class="pblock"><div class="pblock-head"><span class="pblock-title">最近浏览</span><span class="pblock-note" id="clear-his">清空</span></div>' +
                  (his.length ? rows(his) : '<div class="empty"><span class="empty-title">暂无浏览记录</span><span class="empty-text">画册里翻过的产品会自动记录在这里</span></div>') + '</div>') +
            '<div class="menu"><div class="menu-row" id="menu-lib"><span>全部产品库</span><span class="arrow"></span></div>' +
            '<div class="menu-row"><span>数据来源</span><span class="menu-v">' + (CLOUD.enabled ? '云端后台（实时同步）' : '产品画册 2026 版') + '</span></div>' +
            '<div class="menu-row"><span>版本</span><span class="menu-v">H5 1.0.0</span></div></div>' +
            '<div class="foot">' + (CLOUD.enabled
                ? '数据由云端后台实时提供，与小程序共用同一套内容'
                : '当前为本地数据模式；接入云端后台后自动切换为在线数据，与小程序内容同步') + '</div>' +
            '</div>' + tabbarHtml('profile') + '</div>';

        appEl.querySelectorAll('[data-pmode]').forEach(function (el) {
            el.onclick = function () { renderProfile(el.dataset.pmode); };
        });
        appEl.querySelectorAll('.row').forEach(function (el) {
            el.onclick = function () { location.hash = '#/viewer/' + el.dataset.open; };
        });
        var clear = document.getElementById('clear-his');
        if (clear) clear.onclick = function () { store.clearHistory(); renderProfile('his'); };
        document.getElementById('menu-lib').onclick = function () { location.hash = '#/library'; };
    }

    /* ---------- 分享海报（pages/poster 的 H5 版） ---------- */
    function renderPoster(id) {
        var p = model.byId[id] || model.catalog[0];
        if (!p) { location.hash = '#/deck'; return; }

        appEl.innerHTML =
            '<div class="page poster-page" style="padding-top:0.88rem">' +
            '<div class="nav"><div class="nav-inner"><span class="nav-back" id="p-back"><span class="nav-back-icon"></span></span>' +
            '<span class="nav-title">分享海报</span></div></div>' +
            '<div class="poster-canvas-wrap"><canvas id="poster" width="1280" height="2000"></canvas></div>' +
            '<div class="poster-actions"><button class="poster-btn" id="poster-save">保存海报</button>' +
            '<button class="poster-btn ghost" id="poster-back">返回</button></div></div>';

        document.getElementById('p-back').onclick = function () { history.back(); };
        document.getElementById('poster-back').onclick = function () { history.back(); };
        document.getElementById('poster-save').onclick = function () {
            var a = document.createElement('a');
            a.download = (p.model || 'lumintop') + '-poster.jpg';
            a.href = document.getElementById('poster').toDataURL('image/jpeg', 0.92);
            a.click();
            toast('海报已生成，浏览器已开始下载');
        };

        var canvas = document.getElementById('poster');
        var ctx = canvas.getContext('2d');
        var W = 640, H = 1000;
        ctx.save();
        ctx.scale(2, 2);

        var accentSoft = '#FF9A4D';
        ctx.fillStyle = '#08090B';
        ctx.fillRect(0, 0, W, H);
        var glow = ctx.createRadialGradient(W / 2, 260, 20, W / 2, 300, 420);
        glow.addColorStop(0, 'rgba(28,34,48,1)');
        glow.addColorStop(1, 'rgba(8,9,11,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, 660);

        var img = new Image();
        img.onload = function () {
            var pad = 24;
            var iw = W - pad * 2;
            var cardH = iw * (img.height / img.width);
            var ih = 40 + cardH;
            ctx.save();
            roundRect(ctx, pad, 40, iw, cardH, 14);
            ctx.clip();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(pad, 40, iw, cardH);
            ctx.drawImage(img, pad, 40, iw, cardH);
            ctx.restore();

            text(ctx, p.model, 40, ih + 40, 40, '#FFFFFF', true);
            text(ctx, p.subtitle, 40, ih + 78, 18, '#7D8694');

            var top = ih + 130;
            p.metrics.forEach(function (m, i) {
                var cx = 40 + i * ((W - 80) / 4);
                text(ctx, m.value + (m.unit ? ' ' + m.unit : ''), cx, top, 24, '#F5F7FA', true);
                text(ctx, m.label, cx, top + 26, 13, '#5C6472');
            });

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(40, top + 60);
            ctx.lineTo(W - 40, top + 60);
            ctx.stroke();

            text(ctx, p.priceText, 40, top + 106, 30, accentSoft, true);
            text(ctx, '官方指导价', 40, top + 138, 13, '#5C6472');
            text(ctx, 'LUMINTOP 雷明兔', 40, H - 70, 16, '#A7AFBC', true);
            text(ctx, '打开链接查看完整参数与光照实拍 · 雷明兔产品画册', 40, H - 46, 12, '#5C6472');
            ctx.restore();
        };
        img.onerror = function () { toast('产品图加载失败'); };
        img.src = p.cover;

        function roundRect(c, x, y, w, h, r) {
            c.beginPath();
            c.moveTo(x + r, y);
            c.arcTo(x + w, y, x + w, y + h, r);
            c.arcTo(x + w, y + h, x, y + h, r);
            c.arcTo(x, y + h, x, y, r);
            c.arcTo(x, y, x + w, y, r);
            c.closePath();
        }

        function text(c, str, x, y, size, color, bold) {
            c.fillStyle = color;
            c.font = (bold ? '600 ' : '400 ') + size + 'px -apple-system, "PingFang SC", sans-serif';
            c.fillText(str || '', x, y);
        }
    }

    /* ---------- 路由 ---------- */
    function route() {
        var hash = location.hash.replace(/^#\/?/, '');
        var parts = hash.split('?');
        var segs = parts[0].split('/').filter(Boolean);
        var q = {};
        (parts[1] || '').split('&').forEach(function (kv) {
            if (!kv) return;
            var p = kv.split('=');
            q[p[0]] = p[1] || '';
        });

        if (segs[0] === 'library') return renderLibrary();
        if (segs[0] === 'profile') return renderProfile(q.mode);
        if (segs[0] === 'viewer' && segs[1]) {
            store.addHistory(decodeURIComponent(segs[1]));
            return renderViewer(decodeURIComponent(segs[1]), {
                tab: q.tab === 'light' ? 'light' : 'stage',
                drawer: q.drawer === '1',
            });
        }
        if (segs[0] === 'poster' && segs[1]) return renderPoster(decodeURIComponent(segs[1]));
        renderDeck();
    }

    window.addEventListener('hashchange', route);

    // 云端数据到达后刷新当前视图（保持 hash 不变）
    model.onChange(function () {
        if (location.hash.indexOf('viewer') < 0) route();
    });

    route();
})();
