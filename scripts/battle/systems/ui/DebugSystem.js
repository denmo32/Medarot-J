/**
 * @file デバッグシステム
 * ゲームのデバッグ情報をコンソールに出力するための専用システム。
 * CONFIG.DEBUGがtrueの場合にのみワールドに登録され、動作します。
 * 本番コードからデバッグ用のロジックを分離する責務を持ちます。
 */
import { BaseSystem } from '../../../engine/baseSystem.js';
import { GameEvents } from '../../common/events.js';

export class DebugSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // AIの戦略実行イベントを購読
        this.world.on(GameEvents.STRATEGY_EXECUTED, this.onStrategyExecuted.bind(this));
    }

    /**
     * AIのターゲティング戦略が実行された際に呼び出されます。
     * @param {object} detail - STRATEGY_EXECUTED イベントのペイロード
     */
    onStrategyExecuted(detail) {
        const { strategy, attackerId, target } = detail;
        console.log(
            `%c[AI DEBUG] Attacker ${attackerId} used strategy %c'${strategy}'%c -> Target: Entity ${target.targetId}, Part ${target.targetPartKey}`,
            'color: #90cdf4;',  // 水色
            'color: #faf089; font-weight: bold;', // 黄色・太字
            'color: #90cdf4;'   // 水色
        );
    }
}
