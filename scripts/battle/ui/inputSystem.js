import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { PlayerInfo, Parts, Medal } from '../core/components.js'; // ★ Medalをインポート
import { ModalType, EffectScope } from '../common/constants.js'; // ★ EffectScopeをインポート
import { getAllActionParts, getValidEnemies, getValidAllies } from '../utils/queryUtils.js'; // ★ getValid...をインポート
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js'; // ★ getStrategiesForをインポート
import { targetingStrategies } from '../ai/targetingStrategies.js'; // ★新規: targetingStrategiesをインポート

/**
 * プレイヤーからの入力を処理し、行動を決定するシステム。
 * UiSystemからのUIイベントを受け取り、ゲームロジックで扱えるACTION_SELECTEDイベントに変換します。
 * 旧DecisionSystemのプレイヤー担当部分の責務を継承しています。
 */
export class InputSystem extends BaseSystem {
    constructor(world) {
        super(world);

        // プレイヤーの入力が必要になった時と、実際にUIでパーツが選択された時のイベントをリッスン
        this.world.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
        this.world.on(GameEvents.PART_SELECTED, this.onPartSelected.bind(this));
    }

    /**
     * TurnSystemからプレイヤーの行動選択が要求された際のハンドラ。
     * プレイヤーの行動選択UI（パネル）の表示をViewSystemに要求します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const playerMedal = this.world.getComponent(entityId, Medal);
        const strategies = getStrategiesFor(playerMedal.personality);
        
        const allActionParts = getAllActionParts(this.world, entityId);
        
        const buttonsWithTargets = allActionParts.map(([partKey, part]) => {
            let target = null;
            // ターゲットを事前に決定する必要があるアクション（射撃など）の場合
            if (part.targetTiming === 'pre-move') {
                const isAllyTargeting = part.targetScope.startsWith('ALLY_');
                
                // ★リファクタリング: AIの思考ロジック変更に伴い、ターゲット候補の決定方法を更新。
                // 性格に定義された思考ルーチンの「最初の」ターゲット戦略を、プレイヤーの補助機能（推奨ターゲット）として使用します。
                
                // Step 1: プライマリ戦略（ルーチンの最初の戦略）でターゲットを試行
                let primaryTargetingFunc = null;
                if (strategies.routines && strategies.routines.length > 0) {
                    const primaryTargetStrategyKey = strategies.routines[0].targetStrategy;
                    primaryTargetingFunc = targetingStrategies[primaryTargetStrategyKey];
                }

                if (primaryTargetingFunc) {
                    // パーツが味方対象か敵対象かに応じて、適切な候補リストを作成
                    const primaryCandidates = isAllyTargeting
                        ? getValidAllies(this.world, entityId, true)
                        : getValidEnemies(this.world, entityId);
                    target = determineTarget(this.world, entityId, primaryTargetingFunc, primaryCandidates);
                }
                
                // Step 2: プライマリ戦略が失敗した場合、フォールバック戦略を試行
                if (!target) {
                    // フォールバックは通常、敵を対象とする
                    const fallbackCandidates = getValidEnemies(this.world, entityId);
                    target = determineTarget(this.world, entityId, strategies.fallbackTargeting, fallbackCandidates);
                }
            }

            return {
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action,
                targetScope: part.targetScope,
                targetTiming: part.targetTiming || 'pre-move',
                target: target 
            };
        });

        // UIシステムにパネル表示を要求
        const panelData = {
            entityId: entityId,
            title: '',
            ownerName: playerInfo.name,
            buttons: buttonsWithTargets,
        };
        
        this.world.emit(GameEvents.SHOW_MODAL, { 
            type: ModalType.SELECTION, 
            data: panelData,
            immediate: true
        });
    }

    /**
     * プレイヤーがUIでパーツを選択した際のハンドラ。
     * 選択されたパーツに基づき、ターゲットを決定して完全な行動内容をStateSystemに通知します。
     * @param {object} detail - イベントの詳細 ({ entityId, partKey, targetId, targetPartKey })
     */
    onPartSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const target = { targetId, targetPartKey };
        decideAndEmitAction(this.world, entityId, partKey, target);
    }

    update(deltaTime) {}
}