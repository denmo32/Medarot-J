/**
 * @file シーン基底クラス
 * @description すべてのシーンクラスの基底となる抽象クラス。
 * イベント発行を廃止し、純粋な更新処理のみを行います。
 */
export class Scene {
    /**
     * @param {World} world - グローバルなWorldインスタンス
     * @param {SceneManager} sceneManager - シーンマネージャーのインスタンス
     */
    constructor(world, sceneManager) {
        if (this.constructor === Scene) {
            throw new Error("Scene is an abstract class and cannot be instantiated directly.");
        }
        this.world = world;
        this.sceneManager = sceneManager;
    }

    /**
     * シーン初期化時に呼び出されます。
     * @param {object} [data={}] - 前のシーンから渡されるデータ
     */
    init(data = {}) {
        throw new Error("Method 'init()' must be implemented.");
    }

    /**
     * 毎フレーム呼び出されます。
     * @param {number} deltaTime
     */
    update(deltaTime) {
        this.world.update(deltaTime);
    }

    /**
     * シーン終了時に呼び出されます。
     */
    destroy() {
        // イベント発行を削除
        // this.world.emit('SCENE_WILL_DESTROY'); 
        this.world.reset();
    }
}