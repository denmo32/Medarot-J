/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Medal, Parts, PlayerInfo } from '../core/components.js'; // ★ PlayerInfo をインポート
// ★修正: 必要なユーティリティをインポート
import { getAttackableParts, getValidEnemies, getValidAllies, isValidTarget } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
// ★追加: partSelectionStrategies を直接インポート
import { partSelectionStrategies } from '../ai/partSelectionStrategies.js';


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
     * ★修正: ターゲット候補の決定責任をAiSystemが持つように思考フローを再構築。
     * 1. パーツ戦略に基づき、使用するパーツを仮決定する。
     * 2. パーツの役割に基づき、ターゲット候補（敵or味方）を決定する。
     * 3. ターゲット戦略でターゲットを決定する。
     * 4. ターゲットが見つからなければ、フォールバック戦略（攻撃）に移行し、パーツとターゲットを再決定する。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;

        const availableParts = getAttackableParts(this.world, entityId);
        if (availableParts.length === 0) {
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
            return;
        }

        const attackerMedal = this.world.getComponent(entityId, Medal);
        const strategies = getStrategiesFor(attackerMedal.personality);
        const context = { world: this.world, entityId, availableParts };

        let partKey, part, target = null;

        // --- Step 1: プライマリ戦略による行動決定 ---
        // 1a. プライマリパーツ戦略でパーツを仮決定
        [partKey, part] = strategies.partSelection(context);

        if (partKey) {
            // 1b. パーツの役割に応じてターゲット候補を決定
            const candidates = part.targetScope?.startsWith('ALLY_')
                ? getValidAllies(this.world, entityId, true)
                : getValidEnemies(this.world, entityId);
            
            // 1c. プライマリターゲット戦略でターゲットを決定
            target = determineTarget(this.world, entityId, strategies.primaryTargeting, candidates);
        }

        // --- Step 2: プライマリ戦略が失敗した場合のフォールバック ---
        if (!partKey || !target) {
            // 2a. フォールバック用のパーツ戦略で攻撃パーツを選択
            const fallbackPartSelection = strategies.fallbackPartSelection || partSelectionStrategies.POWER_FOCUS;
            [partKey, part] = fallbackPartSelection(context);
            
            if (partKey) {
                 // 2b. フォールバックターゲット（必ず敵）の候補を決定
                const fallbackCandidates = getValidEnemies(this.world, entityId);

                // 2c. フォールバックターゲット戦略でターゲットを決定
                target = determineTarget(this.world, entityId, strategies.fallbackTargeting, fallbackCandidates);
            }
        }
        
        // --- Step 3: 最終決定 ---
        // それでも行動が決まらない場合はランダムに行動
        if (!partKey || !target) {
            console.warn(`AI ${entityId} could not decide action, falling back to pure random.`);
            [partKey, part] = partSelectionStrategies.RANDOM(context);
            if (partKey) {
                const candidates = getValidEnemies(this.world, entityId);
                target = determineTarget(this.world, entityId, strategies.fallbackTargeting, candidates);
            }
        }

        decideAndEmitAction(this.world, entityId, partKey, target);
    }
}