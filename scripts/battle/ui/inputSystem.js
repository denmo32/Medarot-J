import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { PlayerInfo, Parts, Medal } from '../core/components/index.js';
import { ModalType, EffectScope, TargetTiming } from '../common/constants.js';
import { getAllActionParts } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTargetCandidatesByPersonality } from '../ai/aiDecisionUtils.js';
import { determineActionPlans } from '../utils/targetingUtils.js';

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
     * AIと同じロジックで行動プランを生成し、UI表示を要求します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const context = { world: this.world, entityId };

        // --- Step 1: 性格に基づきターゲット候補リストを取得 ---
        const { candidates: targetCandidates } = determineTargetCandidatesByPersonality(context);
        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`Player ${entityId}: No valid target candidates found. Re-queueing.`);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        // --- Step 2: ターゲット候補と使用可能パーツから、行動プランのリストを生成 ---
        const actionPlans = determineActionPlans({ ...context, targetCandidates });
        if (actionPlans.length === 0) {
            console.warn(`Player ${entityId}: No attackable parts available.`);
            // この場合、本来は選択肢がないので自動でパスすべきだが、一旦再キュー
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        // --- Step 3: UIシステムにパネル表示を要求 ---
        const allPossibleParts = getAllActionParts(this.world, entityId);

        // UIボタンのデータを行動プランに基づいて生成
        // actionPlans には使用可能パーツしか含まれないため、破壊済みパーツも表示するために allPossibleParts をベースにする
        const buttonsData = allPossibleParts.map(([partKey, part]) => {
            const plan = actionPlans.find(p => p.partKey === partKey);
            return {
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action,
                // planが存在すれば、そのターゲット情報をボタンに含める
                target: plan ? plan.target : null
            };
        });

        const panelData = {
            entityId: entityId,
            title: '',
            ownerName: playerInfo.name,
            buttons: buttonsData,
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
     * @param {object} detail - イベントの詳細 ({ entityId, partKey, target })
     */
    onPartSelected(detail) {
        const { entityId, partKey, target } = detail;
        decideAndEmitAction(this.world, entityId, partKey, target);
    }

    update(deltaTime) {}
}