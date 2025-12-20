/**
 * @file システム基底クラス
 * @description すべてのSystemの親クラス。
 * イベントリスナー機能を除去し、純粋な更新処理のみを定義します。
 */
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class System {
    /**
     * @param {World} world 
     */
    constructor(world) {
        this.world = world;
    }

    /**
     * フレームごとの更新処理
     * @param {number} deltaTime - 前フレームからの経過時間(ms)
     */
    update(deltaTime) {
        // サブクラスで実装
    }

    /**
     * 安全な実行ラッパー
     * @param {number} deltaTime 
     */
    execute(deltaTime) {
        try {
            this.update(deltaTime);
        } catch (error) {
            ErrorHandler.handle(error, {
                system: this.constructor.name,
                method: 'update'
            });
        }
    }

    /**
     * システム終了時のクリーンアップ
     * 必要に応じてサブクラスでオーバーライド
     */
    destroy() {
        // デフォルトでは何もしない
    }

    /**
     * コンポーネントの組み合わせ条件に一致するエンティティを取得するヘルパー
     * @param {...Function} componentClasses 
     * @returns {number[]}
     */
    getEntities(...componentClasses) {
        return this.world.getEntitiesWith(...componentClasses);
    }
}