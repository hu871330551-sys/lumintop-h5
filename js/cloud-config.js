// 云端配置：云服务开通后把 activate 返回的 publicConfig 填到这里即可切换在线数据
// 未开通 / 字段为空时，画册自动使用本地打包数据（js/products.json + media/ 高清图库）
window.LUMINTOP_CLOUD = {
    enabled: false,
    endpoint: '',           // 例：https://xxx.workbuddy.link
    publishableKey: '',     // publicConfig.publishableKey
    mediaBase: '',          // 云存储公开桶地址（为空时用本地 media/ 目录）
};
