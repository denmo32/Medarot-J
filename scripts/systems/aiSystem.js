/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Medal } from '../core/components.js';
import { getAttackableParts } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';


/**
 * AIの「脳」として機能するシステム。
 * TurnSystemからAIの行動ターンであることが通知されると、このシステムが起動します。
 * プレイヤーの入力を待つInputSystemと対になる存在であり、AIの意思決定プロセスを担います。
 */
export class AiSystem extends BaseSystem {
    constructor(world) {
        super(world);

        // AIの行動が必要になった時（AIのターンが来た時）のイベントのみを購読します。
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    /**
     * TurnSystemからAIの行動選択が要求された際のハンドラ。AIの思考プロセスを開始します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;

        // 1. 攻撃に使用できるパーツのリストを取得します。
        const availableParts = getAttackableParts(this.world, entityId);

        if (availableParts.length > 0) {
            // 2. ★改善: 性格に応じた戦略セットをレジストリから取得します。
            const attackerMedal = this.world.getComponent(entityId, Medal);
            const strategies = getStrategiesFor(attackerMedal.personality);
            
            // 3. ★改善: パーツ選択戦略を実行し、使用するパーツを決定します。
            const [partKey, part] = strategies.partSelection({ world: this.world, entityId, availableParts });
            
            // 4. ターゲット決定とイベント発行をユーティリティ関数に委譲します。
            const target = determineTarget(this.world, entityId);
            decideAndEmitAction(this.world, entityId, partKey, target);

        } else {
            // 攻撃可能なパーツが残っていない場合、自身が破壊されたものとしてイベントを発行します。
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    
    // このシステムはイベント駆動で動作するため、毎フレーム実行されるupdate処理は不要です。
    update(deltaTime) {}
}