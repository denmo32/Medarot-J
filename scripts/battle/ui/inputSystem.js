import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { PlayerInfo, Parts, Medal } from '../core/components/index.js';
import { ModalType, EffectScope, TargetTiming } from '../common/constants.js';
import { getAllActionParts } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineRecommendedTarget } from '../ai/aiDecisionUtils.js';

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
        
        const allActionParts = getAllActionParts(this.world, entityId);
        
        // ターゲットの事前計算ロジックを `targetingUtils` の共通関数に委譲
        const buttonsWithTargets = allActionParts.map(([partKey, part]) => {
            let target = null;
            // ターゲットを事前に決定する必要があるアクション（射撃など）の場合のみ計算
            if (part.targetTiming === TargetTiming.PRE_MOVE) {
                target = determineRecommendedTarget(this.world, entityId, part);
            }

            return {
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action,
                targetScope: part.targetScope,
                targetTiming: part.targetTiming || TargetTiming.PRE_MOVE,
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