/**
 * @file BaseScene.js
 * @description すべてのシーンクラスの基底となる抽象クラス。
 * シーンが持つべき共通のインターフェース（ライフサイクルメソッド）を定義します。
 */
export class BaseScene {
    /**
     * @param {World} world - グローバルなWorldインスタンス
     * @param {SceneManager} sceneManager - シーンマネージャーのインスタンス
     */
    constructor(world, sceneManager) {
        if (this.constructor === BaseScene) {
            throw new Error("BaseScene is an abstract class and cannot be instantiated directly.");
        }
        this.world = world;
        this.sceneManager = sceneManager;
    }

    /**
     * シーンがアクティブになる直前に一度だけ呼び出されます。
     * このメソッドで、システム、エンティティ、イベントリスナーのセットアップを行います。
     * @param {object} [data={}] - 前のシーンから渡されるデータ
     */
    init(data = {}) {
        throw new Error("Method 'init()' must be implemented.");
    }

    /**
     * シーンがアクティブな間、毎フレーム呼び出されます。
     * @param {number} deltaTime - 前のフレームからの経過時間
     */
    update(deltaTime) {
        this.world.update(deltaTime);
    }

    /**
     * シーンが非アクティブになる直前に一度だけ呼び出されます。
     * このメソッドで、イベントリスナーのクリーンアップやWorldのリセットを行います。
     */
    destroy() {
        this.world.emit('SCENE_WILL_DESTROY'); // 汎用的な破棄イベント
        this.world.reset();
    }
}