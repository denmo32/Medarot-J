/**
 * @file SceneRequests.js
 * @description シーン遷移やシーン間のやり取りに関連するリクエストコンポーネント。
 */

export class SceneChangeRequest {
    /**
     * @param {string} sceneName - 遷移先のシーン名
     * @param {object} [data={}] - 遷移先に渡すデータ
     */
    constructor(sceneName, data = {}) {
        this.sceneName = sceneName;
        this.data = data;
    }
}