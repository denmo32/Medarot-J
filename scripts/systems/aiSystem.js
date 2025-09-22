/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { GameEvents } from '../common/events.js';
// ★改善: Medalコンポーネントをインポートし、性格を取得できるようにする
import { Medal } from '../core/components.js';
import { getAttackableParts } from '../utils/battleUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';
// ★改善: 新設したパーツ選択戦略をインポート
import { partSelectionStrategies, personalityToPartSelection } from '../ai/partSelectionStrategies.js';


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
            // 2. ★改善: どのパーツで攻撃するかを、外部の戦略モジュールに委譲して決定します。
            const attackerMedal = this.world.getComponent(entityId, Medal);
            // 性格に対応する戦略を取得、なければデフォルト(POWER_FOCUS)を使用
            const partStrategy = personalityToPartSelection[attackerMedal.personality] || partSelectionStrategies.POWER_FOCUS;
            const [partKey, part] = partStrategy(this.world, entityId, availableParts);
            
            // 3. ターゲット決定とイベント発行をユーティリティ関数に委譲します。
            const target = determineTarget(this.world, entityId);
            decideAndEmitAction(this.world, entityId, partKey, target);

        } else {
            // 攻撃可能なパーツが残っていない場合、自身が破壊されたものとしてイベントを発行します。
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    /**
     * ★廃止: AIのパーツ選択ロジックは partSelectionStrategies.js に分離されました。
     * これにより、AiSystemは思考ロジックの詳細から解放され、より管理的な役割に集中できます。
     */
    // _chooseActionPart(entityId, availableParts) { ... }
    
    // このシステムはイベント駆動で動作するため、毎フレーム実行されるupdate処理は不要です。
    update(deltaTime) {}
}