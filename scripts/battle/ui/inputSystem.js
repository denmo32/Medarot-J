// scripts/systems/inputSystem.js:

import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
// ★追加: Partsコンポーネントをインポート
import { PlayerInfo, Parts } from '../core/components.js';
import { ModalType } from '../common/constants.js';
// ★変更: 新しいユーティリティ関数 decideAndEmitAction をインポート
import { getAllActionParts } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';

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
        
        // 破壊状態に関わらず、全ての攻撃パーツを取得する
        const allActionParts = getAllActionParts(this.world, entityId);
        
        // ターゲットを事前に決定
        const target = determineTarget(this.world, entityId);

        // UIシステムにパネル表示を要求
        const panelData = {
            entityId: entityId,
            title: '', // ★修正: タイトルは空文字にして、所有者名を別途表示
            ownerName: playerInfo.name,
            buttons: allActionParts.map(([partKey, part]) => ({
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action // ★追加: ViewSystemが参照するためにアクションタイプを渡す
            })),
            // 決定したターゲット情報をパネルデータに含める
            targetId: target ? target.targetId : null,
            targetPartKey: target ? target.targetPartKey : null
        };
        
        // ★修正: 即座にモーダルを表示（シーケンス管理をスキップ）
        this.world.emit(GameEvents.SHOW_MODAL, { 
            type: ModalType.SELECTION, 
            data: panelData,
            immediate: true // ★追加: 即座表示フラグ
        });
    }

    /**
     * プレイヤーがUIでパーツを選択した際のハンドラ。
     * 選択されたパーツに基づき、ターゲットを決定して完全な行動内容をStateSystemに通知します。
     * @param {object} detail - イベントの詳細 ({ entityId, partKey })
     */
    onPartSelected(detail) {
        // ViewSystemから渡された、事前に決定済みのターゲット情報を含む詳細を受け取る
        const { entityId, partKey, targetId, targetPartKey } = detail;

        // ★変更: イベント発行のロジックを共通化されたユーティリティ関数に委譲します。
        // UIから渡されたターゲット情報をそのまま関数に渡します。
        decideAndEmitAction(this.world, entityId, partKey, { targetId, targetPartKey });
    }

    // このシステムはイベント駆動なので、updateループでの処理は不要
    update(deltaTime) {}
}
