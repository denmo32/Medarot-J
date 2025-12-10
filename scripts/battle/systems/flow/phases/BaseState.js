/**
 * @file BaseState.js
 * @description バトルフェーズステートの基底クラス。
 */
export class BaseState {
    /**
     * @param {PhaseSystem} system PhaseSystemのインスタンス
     */
    constructor(system) {
        this.system = system;
        this.world = system.world;
        this.battleContext = system.battleContext;
    }

    /**
     * フェーズ開始時に一度だけ呼ばれる
     */
    enter() {
        // デフォルト実装はなし
    }

    /**
     * 毎フレーム呼ばれる
     * @param {number} deltaTime 
     * @returns {BaseState|null} 次のステート（遷移する場合）、またはnull（継続する場合）
     */
    update(deltaTime) {
        return null;
    }

    /**
     * フェーズ終了時に一度だけ呼ばれる
     */
    exit() {
        // デフォルト実装はなし
    }
}