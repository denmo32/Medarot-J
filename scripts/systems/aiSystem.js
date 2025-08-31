// scripts/systems/aiSystem.js:

import { GameEvents } from '../events.js';
import { determineTarget, getAttackableParts } from '../battleUtils.js';

/**
 * ★新規: AIの行動選択と思考ロジックを管理するシステム。
 * 旧DecisionSystemのAI担当部分の責務を継承しています。
 */
export class AiSystem {
    constructor(world) {
        this.world = world;

        // AIの行動が必要になった時のイベントのみをリッスン
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    /**
     * TurnSystemからAIの行動選択が要求された際のハンドラ。
     * AIの行動（使用パーツとターゲット）を決定し、結果をStateSystemに通知します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;

        // 攻撃に使用できるパーツのリストを取得
        const availableParts = getAttackableParts(this.world, entityId);

        if (availableParts.length > 0) {
            // 1. どのパーツで攻撃するかを思考ロジックに基づき選択
            const [partKey, part] = this._chooseActionPart(entityId, availableParts);
            
            // 2. 誰のどのパーツを攻撃するかを思考ロジックに基づき決定
            const target = determineTarget(this.world, entityId);
            if (!target) {
                // ターゲットが見つからない場合は行動をスキップ
                 this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey: null, targetId: null, targetPartKey: null });
                return;
            }
            const { targetId, targetPartKey } = target;

            // 3. 決定した完全な行動内容をStateSystemに通知する
            this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey, targetId, targetPartKey });

        } else {
            // 攻撃可能なパーツが残っていない場合
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    /**
     * AIが使用する攻撃パーツを選択する思考ロジック。
     * @param {number} entityId - AIのエンティティID
     * @param {Array} availableParts - 使用可能なパーツのリスト
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト
     */
    _chooseActionPart(entityId, availableParts) {
        // 現在は、利用可能なパーツの中で最も攻撃力が高いものを選択する単純なロジック
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        const sortedParts = [...availableParts].sort(([, partA], [, partB]) => partB.power - partA.power);
        return sortedParts[0];
    }
    
    // このシステムはイベント駆動なので、updateループでの処理は不要
    update(deltaTime) {}
}