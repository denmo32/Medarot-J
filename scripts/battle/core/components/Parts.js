import { CONFIG } from '../../common/config.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID, TargetTiming } from '../../common/constants.js';

// パーツ情報
export class Parts {
    /**
     * @param {object} head - 頭部パーツのマスターデータ
     * @param {object} rightArm - 右腕パーツのマスターデータ
     * @param {object} leftArm - 左腕パーツのマスターデータ
     * @param {object} legs - 脚部パーツのマスターデータ
     */
    constructor(head, rightArm, leftArm, legs) {
        /**
         * ★改善: マスターデータを元に、戦闘インスタンス用のパーツデータを生成します。
         * マスターデータ（設計図）と、戦闘中に変動する状態（HPなど）を明確に分離し、
         * データの不変性を保つことで、予期せぬバグを防ぎます。
         * @param {object} partData - パーツのマスターデータ
         * @returns {object | null} 戦闘インスタンス用のパーツオブジェクト、またはnull
         */
        const initializePart = (partData) => {
            if (!partData) return null;

            // ★リファクタリング: ロールのデフォルト値とパーツ固有の値をマージする
            // これにより、parts.jsの記述を簡潔に保ちつつ、完全なデータ構造を構築する
            // partData.roleが存在し、それがオブジェクトであることを確認
            const roleDefaults = (partData.role && typeof partData.role === 'object') ? { ...partData.role } : {};
            
            // マージの順序が重要: partDataがroleDefaultsを上書きする
            // これにより、パーツデータで定義された`effects`などがロールのデフォルトをオーバーライドできる
            const partInstance = { ...roleDefaults, ...partData };

            // HPはマスターデータから取得して初期化
            partInstance.hp = partData.maxHp;
            // 破壊状態は'false'で初期化
            partInstance.isBroken = false;
            
            // ★リファクタリング: effectの 'strategy' プロパティを 'type' に統一する
            // データ定義の互換性を保ちつつ、内部的には 'type' を使用する
            if (partInstance.effects && Array.isArray(partInstance.effects)) {
                partInstance.effects = partInstance.effects.map(effect => {
                    // strategyプロパティが存在すれば、typeにコピーして元のプロパティを削除
                    if (effect.strategy) {
                        const newEffect = { ...effect, type: effect.strategy };
                        delete newEffect.strategy;
                        return newEffect;
                    }
                    return effect;
                });
            }

            return partInstance;
        };

        /** @type {object | null} */
        this.head = initializePart(head);
        /** @type {object | null} */
        this.rightArm = initializePart(rightArm);
        /** @type {object | null} */
        this.leftArm = initializePart(leftArm);
        /** @type {object | null} */
        this.legs = initializePart(legs);
    }
}