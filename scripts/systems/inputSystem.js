// scripts/systems/inputSystem.js:

import { GameEvents } from '../events.js';
import { PlayerInfo } from '../components.js';
import { ModalType } from '../constants.js';
import { getAllActionParts } from '../utils/battleUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';

/**
 * プレイヤーからの入力を処理し、行動を決定するシステム。
 * UiSystemからのUIイベントを受け取り、ゲームロジックで扱えるACTION_SELECTEDイベントに変換します。
 * 旧DecisionSystemのプレイヤー担当部分の責務を継承しています。
 */
export class InputSystem {
    constructor(world) {
        this.world = world;

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
        
        // 破壊状態に関わらず、全ての攻撃パーツを取得する
        const allActionParts = getAllActionParts(this.world, entityId);
        
        // ターゲットを事前に決定
        const target = determineTarget(this.world, entityId);

        // UIシステムにパネル表示を要求
        const panelData = {
            entityId: entityId,
            title: '',
            ownerName: playerInfo.name,
            buttons: allActionParts.map(([partKey, part]) => ({
                text: `${part.name} (${part.action})`,
                partKey: partKey,
                isBroken: part.isBroken
            })),
            // 決定したターゲット情報をパネルデータに含める
            targetId: target ? target.targetId : null,
            targetPartKey: target ? target.targetPartKey : null
        };
        this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.SELECTION, data: panelData });
    }

    /**
     * プレイヤーがUIでパーツを選択した際のハンドラ。
     * 選択されたパーツに基づき、ターゲットを決定して完全な行動内容をStateSystemに通知します。
     * @param {object} detail - イベントの詳細 ({ entityId, partKey })
     */
    onPartSelected(detail) {
        // ViewSystemから渡された、事前に決定済みのターゲット情報を含む詳細を受け取る
        const { entityId, partKey, targetId, targetPartKey } = detail;

        // ターゲットが見つからない場合は行動をスキップ
        if (!targetId) {
            this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey: null, targetId: null, targetPartKey: null });
            return;
        }

        // 決定した完全な行動内容をStateSystemに通知する
        this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey, targetId, targetPartKey });
    }

    // このシステムはイベント駆動なので、updateループでの処理は不要
    update(deltaTime) {}
}