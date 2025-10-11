import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { PlayerInfo, Parts } from '../core/components.js';
import { ModalType } from '../common/constants.js';
import { getAllActionParts } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../ai/targetingUtils.js';
import { CONFIG } from '../common/config.js';

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
        
        // 破壊状態に関わらず、全ての行動可能パーツを取得する
        const allActionParts = getAllActionParts(this.world, entityId);
        
        // ★修正: 各ボタン（パーツ）に対応するターゲットを事前にすべて計算する
        const buttonsWithTargets = allActionParts.map(([partKey, part]) => {
            // 各パーツに対してターゲットを決定する。
            // targetTimingが'post-move'のアクション（格闘、回復）は、この時点ではターゲットを決定しない。
            let target = null;
            if (CONFIG.ACTION_PROPERTIES[part.action]?.targetTiming === 'pre-move') {
                target = determineTarget(this.world, entityId, partKey);
            }

            return {
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action,
                targetScope: part.targetScope,
                targetTiming: CONFIG.ACTION_PROPERTIES[part.action]?.targetTiming || 'pre-move',
                // ★追加: 各ボタンに固有のターゲット情報を持たせる
                target: target 
            };
        });

        // UIシステムにパネル表示を要求
        const panelData = {
            entityId: entityId,
            title: '',
            ownerName: playerInfo.name,
            // ★修正: 計算済みのボタン情報を渡す
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
        // ★変更: detailから targetId, targetPartKey を直接受け取る
        const { entityId, partKey, targetId, targetPartKey } = detail;

        // ★変更: ターゲットを再決定せず、イベントで渡された情報をそのまま使う
        const target = { targetId, targetPartKey };

        // イベント発行のロジックを共通化されたユーティリティ関数に委譲
        decideAndEmitAction(this.world, entityId, partKey, target);
    }


    // このシステムはイベント駆動なので、updateループでの処理は不要
    update(deltaTime) {}
}