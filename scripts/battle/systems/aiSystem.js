/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Medal, Parts, PlayerInfo } from '../core/components/index.js'; // ★ PlayerInfo をインポート
// ★修正: 必要なユーティリティをインポート
import { getAttackableParts, getValidEnemies, getValidAllies, isValidTarget } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
// ★リファクタリング: `ai/targetingUtils` から `utils/targetingUtils` に変更
import { determineTarget } from '../utils/targetingUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
// ★追加: partSelectionStrategies を直接インポート
import { partSelectionStrategies } from '../ai/partSelectionStrategies.js';
import { targetingStrategies } from '../ai/targetingStrategies.js'; // ★新規: targetingStrategiesをインポート


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
     * ★リファクタリング: AIの意思決定を宣言的な「思考ルーチン」ベースに刷新。
     * 1. 性格レジストリから、その性格に定義された「思考ルーチン」のリストを取得します。
     * 2. リストを優先順位の高い順（配列の先頭から）にループ処理します。
     * 3. 各ルーチンで定義された「パーツ戦略」と「ターゲット戦略」を実行します。
     * 4. 有効なパーツとターゲットの組み合わせが見つかった時点で、その行動を決定し、思考を終了します。
     * 5. 全てのルーチンを試しても行動が決まらない場合、最終的なフォールバック戦略（通常はランダム攻撃）を実行します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;

        const availableParts = getAttackableParts(this.world, entityId);
        if (availableParts.length === 0) {
            // 攻撃可能なパーツがない場合は機能停止と見なす
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
            return;
        }

        const attackerMedal = this.world.getComponent(entityId, Medal);
        const strategies = getStrategiesFor(attackerMedal.personality);
        const context = { world: this.world, entityId, availableParts };

        let selectedPartKey = null;
        let finalTarget = null;

        // --- Step 1: 思考ルーチンを順番に試行 ---
        if (strategies.routines && strategies.routines.length > 0) {
            for (const routine of strategies.routines) {
                // --- ▼▼▼ ここからがリファクタリング箇所 ▼▼▼ ---
                // ★新規: ルーチンに実行条件(condition)が定義されていれば評価する
                if (routine.condition) {
                    // 条件を満たさなければ、このルーチンはスキップして次へ
                    if (!routine.condition(context)) {
                        continue;
                    }
                }
                // --- ▲▲▲ リファクタリング箇所ここまで ▲▲▲ ---

                // ★修正: part.targetScopeへの依存をなくし、ルーチン定義からターゲット候補を決定する
                const { partStrategy: partStrategyKey, targetStrategy: targetStrategyKey, targetCandidates: candidatesKey } = routine;
                
                // 1a. パーツ戦略でパーツを決定
                const partSelectionFunc = partSelectionStrategies[partStrategyKey];
                if (!partSelectionFunc) {
                    console.warn(`AiSystem: Unknown partStrategy '${partStrategyKey}' in routines for ${attackerMedal.personality}.`);
                    continue;
                }
                
                const [partKey, part] = partSelectionFunc(context);
                if (!partKey) continue; // この戦略に合うパーツがなければ、次のルーチンへ

                // 1b. ターゲット戦略でターゲットを決定
                const targetSelectionFunc = targetingStrategies[targetStrategyKey];
                if (!targetSelectionFunc) {
                    console.warn(`AiSystem: Unknown targetStrategy '${targetStrategyKey}' in routines for ${attackerMedal.personality}.`);
                    continue;
                }
                
                // ★リファクタリング: ルーチンの`targetCandidates`定義に基づいてターゲット候補リストを作成
                let candidates = [];
                switch (candidatesKey) {
                    case 'ENEMIES':
                        candidates = getValidEnemies(this.world, entityId);
                        break;
                    case 'ALLIES':
                        candidates = getValidAllies(this.world, entityId, false); // 自分を含まない
                        break;
                    case 'ALLIES_INCLUDING_SELF':
                        candidates = getValidAllies(this.world, entityId, true); // 自分を含む
                        break;
                    default:
                        console.warn(`AiSystem: Unknown targetCandidates key '${candidatesKey}'. Defaulting to enemies.`);
                        candidates = getValidEnemies(this.world, entityId);
                }
                    
                // ★修正: 第4引数に戦略キーを渡してイベント発行をトリガーする
                const target = determineTarget(this.world, entityId, targetSelectionFunc, candidates, targetStrategyKey);

                // 1c. 有効な行動が見つかったらループを抜け、行動を確定
                if (target) {
                    selectedPartKey = partKey;
                    finalTarget = target;
                    break; // 思考ルーチンの試行を終了
                }
            }
        }

        // --- Step 2: ルーチンで行動が決まらなかった場合の最終フォールバック ---
        if (!finalTarget) {
            console.warn(`AI ${entityId} (${attackerMedal.personality}) could not decide action via routines. Using fallback targeting.`);
            
            // 攻撃可能なパーツからランダムに1つ選択
            const [partKey] = partSelectionStrategies.RANDOM(context);
            
            if (partKey) {
                selectedPartKey = partKey;
                // 敵の中からフォールバック戦略でターゲットを決定
                const fallbackCandidates = getValidEnemies(this.world, entityId);
                // ★修正: フォールバック戦略のキーを動的に検索してイベントを発行
                const fallbackKey = Object.keys(targetingStrategies).find(key => targetingStrategies[key] === strategies.fallbackTargeting);
                finalTarget = determineTarget(this.world, entityId, strategies.fallbackTargeting, fallbackCandidates, fallbackKey);
            }
        }
        
        // --- Step 3: 最終決定した行動を発行 ---
        decideAndEmitAction(this.world, entityId, selectedPartKey, finalTarget);
    }
}