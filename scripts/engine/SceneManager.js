/**
 * @file SceneManager.js
 * @description シーンの管理と切り替え、およびDOMコンテナの制御を専門に行うクラス。
 * 特定のゲームロジックやハードコードされたDOM IDに依存しない汎用的な実装です。
 */
export class SceneManager {
    /**
     * @param {World} world 
     * @param {object} containerMap - シーン名とDOM要素のマッピング { 'sceneName': HTMLElement }
     */
    constructor(world, containerMap = {}) {
        this.world = world;
        this.scenes = new Map();
        this.currentScene = null;
        this.containers = containerMap;

        // グローバルコンテキスト（シーンinitに渡されるデータ）
        this.globalContext = {};
        
        // シーンリセット後もWorldに再登録すべき永続コンポーネントのリスト
        this.persistentComponents = [];
    }

    /**
     * シーン間で共有するグローバルなインスタンスを登録します。
     * シーンのinitメソッドの引数として渡されます。
     * @param {string} key - コンテキストのキー (例: 'gameDataManager')
     * @param {any} instance - 登録するインスタンス
     */
    registerGlobalContext(key, instance) {
        this.globalContext[key] = instance;
    }

    /**
     * Worldのリセット後も維持すべきコンポーネントを登録します。
     * シーン切り替え時に自動的にWorldに再登録されます。
     * @param {object} component - 永続化したいコンポーネントインスタンス
     */
    registerPersistentComponent(component) {
        this.persistentComponents.push(component);
        // 初回登録時にもWorldに追加しておく
        this.world.addComponent(this.world.createEntity(), component);
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
            // シーンの破棄（内部でworld.reset()が呼ばれ、全エンティティ・コンポーネントが削除される）
            this.currentScene.destroy();
        }

        // 永続コンポーネントをWorldに再登録
        // world.reset() でIDカウンタもリセットされているため、新規エンティティを作成して付与する
        for (const component of this.persistentComponents) {
            this.world.addComponent(this.world.createEntity(), component);
        }

        this.currentScene = this.scenes.get(name);
        
        // UIコンテナの表示を切り替え
        Object.keys(this.containers).forEach(key => {
            const container = this.containers[key];
            if (container) {
                if (key === name) {
                    container.classList.remove('hidden');
                } else {
                    container.classList.add('hidden');
                }
            }
        });

        // 登録されたグローバルコンテキストを自動的にデータにマージ
        const sceneInitData = { ...this.globalContext, ...data };

        // シーンの初期化
        await this.currentScene.init(sceneInitData);
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