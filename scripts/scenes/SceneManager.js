/**
 * @file SceneManager.js
 * @description シーンの管理と切り替えを専門に行うクラス。
 */
export class SceneManager {
    /**
     * @param {World} world 
     */
    constructor(world) {
        this.world = world;
        this.scenes = new Map();
        this.currentScene = null;

        // UIコンテナの参照
        this.containers = {
            map: document.getElementById('map-container'),
            battle: document.getElementById('battle-container'),
            customize: document.getElementById('customize-container'),
            title: document.getElementById('title-container'),
        };
    }

    /**
     * シーンを登録します。
     * @param {string} name - シーンの名前
     * @param {BaseScene} sceneClass - シーンのクラス
     */
    register(name, sceneClass) {
        this.scenes.set(name, new sceneClass(this.world, this));
    }

    /**
     * 指定されたシーンに切り替えます。
     * @param {string} name - 切り替えたいシーンの名前
     * @param {object} [data={}] - 新しいシーンに渡すデータ
     */
    async switchTo(name, data = {}) {
        if (!this.scenes.has(name)) {
            console.error(`SceneManager: Scene '${name}' not registered.`);
            return;
        }

        if (this.currentScene) {
            this.currentScene.destroy();
        }

        this.currentScene = this.scenes.get(name);
        
        // UIコンテナの表示を切り替え
        Object.keys(this.containers).forEach(key => {
            this.containers[key]?.classList.toggle('hidden', key !== name);
        });

        // シーンの初期化（非同期の可能性があるためawait）
        await this.currentScene.init(data);
    }

    /**
     * 現在のシーンのupdateメソッドを呼び出します。
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        if (this.currentScene) {
            this.currentScene.update(deltaTime);
        }
    }
}