// scripts/systems/inputSystem.js:

import { GameEvents } from '../events.js';
import { PlayerInfo } from '../components.js';
import { ModalType } from '../constants.js';
import { determineTarget, getAttackableParts } from '../battleUtils.js';

/**
 * ★新規: プレイヤーからの入力を処理し、行動を決定するシステム。
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
     * プレイヤーの行動選択UI（モーダル）の表示をUiSystemに要求します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        
        // 攻撃可能なパーツを取得
        const availableParts = getAttackableParts(this.world, entityId);
        
        // UIシステムにモーダル表示を要求
        const modalData = {
            entityId: entityId,
            title: '行動選択',
            actorName: `${playerInfo.name} の番です。`,
            buttons: availableParts.map(([partKey, part]) => ({
                text: `${part.name} (${part.action})`,
                partKey: partKey
            }))
        };
        this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.SELECTION, data: modalData });
    }

    /**
     * プレイヤーがUIでパーツを選択した際のハンドラ。
     * 選択されたパーツに基づき、ターゲットを決定して完全な行動内容をStateSystemに通知します。
     * @param {object} detail - イベントの詳細 ({ entityId, partKey })
     */
    onPartSelected(detail) {
        const { entityId, partKey } = detail;

        // 1. ターゲットを決定 (battleUtilsの汎用関数を利用)
        const target = determineTarget(this.world, entityId);
        if (!target) {
            // ターゲットが見つからない場合は行動をスキップ
            this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey: null, targetId: null, targetPartKey: null });
            return;
        }
        const { targetId, targetPartKey } = target;

        // 2. 決定した完全な行動内容をStateSystemに通知する
        this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey, targetId, targetPartKey });
    }

    // このシステムはイベント駆動なので、updateループでの処理は不要
    update(deltaTime) {}
}