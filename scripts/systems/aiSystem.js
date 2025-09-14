/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { GameEvents } from '../common/events.js';
// ★追加: Partsコンポーネントをインポート
import { Parts } from '../core/components.js';
import { getAttackableParts } from '../utils/battleUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';

/**
 * AIの「脳」として機能するシステム。
 * TurnSystemからAIの行動ターンであることが通知されると、このシステムが起動します。
 * プレイヤーの入力を待つInputSystemと対になる存在であり、AIの意思決定プロセスを担います。
 */
export class AiSystem {
    constructor(world) {
        this.world = world;

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
            // 2. どのパーツで攻撃するかを決定します。
            const [partKey, part] = this._chooseActionPart(entityId, availableParts);
            
            // ★追加: 選択したパーツのアクションタイプ（'格闘' or '射撃'）を取得
            const selectedPartAction = this.world.getComponent(entityId, Parts)[partKey].action;

            // 3. アクションタイプに応じてターゲット決定戦略を分岐
            if (selectedPartAction === '格闘') {
                // 格闘の場合、ターゲットは未定のまま行動を決定
                this.world.emit(GameEvents.ACTION_SELECTED, { 
                    entityId, 
                    partKey, 
                    targetId: null, 
                    targetPartKey: null 
                });
            } else {
                // 射撃の場合、従来通りターゲットを決定
                const target = determineTarget(this.world, entityId);

                // ターゲットが見つからない場合は行動をスキップ
                if (!target) {
                    this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey: null, targetId: null, targetPartKey: null });
                    return;
                }
                const { targetId, targetPartKey } = target;

                // 4. 決定した行動内容をStateSystemに通知します。
                this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey, targetId, targetPartKey });
            }

        } else {
            // 攻撃可能なパーツが残っていない場合、自身が破壊されたものとしてイベントを発行します。
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    /**
     * AIが使用する攻撃パーツを選択する内部的な思考ロジックです。
     * なぜこのロジックが分離されているか？
     * 将来的に「脚部パーツの性能に応じて射撃パーツを優先する」など、より高度なAIを実装する際に、
     * この関数を修正するだけで済むように、パーツ選択のロジックをカプセル化しています。
     * @param {number} entityId - AIのエンティティID
     * @param {Array} availableParts - 使用可能なパーツのリスト
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト
     */
    _chooseActionPart(entityId, availableParts) {
        // 現在は、利用可能なパーツの中で最も攻撃力が高いものを選択する、という単純な戦略です。
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        // ★変更: ソート基準をpowerからmight(威力)に変更
        const sortedParts = [...availableParts].sort(([, partA], [, partB]) => partB.might - partA.might);
        return sortedParts[0];
    }
    
    // このシステムはイベント駆動で動作するため、毎フレーム実行されるupdate処理は不要です。
    update(deltaTime) {}
}