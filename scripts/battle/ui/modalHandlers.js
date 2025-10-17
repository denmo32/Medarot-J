/**
 * @file アクションパネルのモーダルハンドラ定義 (新規作成)
 * ActionPanelSystemが使用する、各モーダルタイプの具体的な振る舞いを定義します。
 * これにより、ActionPanelSystemの責務を「管理」に集中させ、
 * 各モーダルの「内容」をこのファイルで一元管理します。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { ModalType, PartInfo, PartKeyToInfoMap, EffectType, EffectScope } from '../common/constants.js';

/**
 * ★リファクタリング: 攻撃結果メッセージを生成します。貫通ダメージにも対応。
 * @param {object} detail - ACTION_EXECUTEDイベントのペイロード
 * @param {World} world - ワールドオブジェクト
 * @returns {string} 表示するメッセージ (HTML文字列)
 * @private
 */
const _generateResultMessage = (detail, world) => {
    const { appliedEffects, isEvaded, isSupport, attackerId, guardianInfo } = detail;
    
    if (isSupport) {
        const effect = (appliedEffects && appliedEffects.length > 0) ? appliedEffects[0] : (detail.resolvedEffects ? detail.resolvedEffects[0] : {});
        return effect.message || '支援行動成功！';
    }
    if (isEvaded) {
        const action = world.getComponent(attackerId, Components.Action);
        const targetId = action ? action.targetId : null;
        const targetName = targetId ? world.getComponent(targetId, Components.PlayerInfo)?.name : null;
        return targetName ? `${targetName}は攻撃を回避！` : '攻撃は回避された！';
    }

    if (appliedEffects && appliedEffects.length > 0) {
        const firstDamageEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE);
        if (firstDamageEffect) {
            const { targetId, partKey, value: damage, isCritical, isDefended } = firstDamageEffect;
            const targetInfo = world.getComponent(targetId, Components.PlayerInfo);
            if (!targetInfo) return '不明なターゲットへの攻撃';

            const partName = PartKeyToInfoMap[partKey]?.name || '不明な部位';
            let message = isCritical ? 'クリティカル！ ' : '';
            
            if (guardianInfo) {
                message += `味方への攻撃を庇う！ ${guardianInfo.name}の${partName}に${damage}ダメージ！`;
            } else if (isDefended) {
                message += `${targetInfo.name}は${partName}で防御！ ${partName}に${damage}ダメージ！`;
            } else {
                message += `${targetInfo.name}の${partName}に${damage}ダメージ！`;
            }
            // ★注意: 貫通メッセージはActionPanelSystem側でアニメーションに合わせて動的に追加するため、ここでは最初のメッセージのみ生成します。
            return message;
        }
    }
    
    return '攻撃は空を切った！';
};


/**
 * ActionPanelSystemのインスタンスをコンテキストとして受け取り、
 * モーダルハンドラのオブジェクトを生成します。
 * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
 * @returns {object} モーダルハンドラのコレクション
 */
export const createModalHandlers = (system) => ({
    // --- スタート確認 ---
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
        getContentHTML: () => `
            <div class="buttons-center">
                <button id="panelBtnYes" class="action-panel-button">OK</button>
                <button id="panelBtnNo" class="action-panel-button bg-red-500 hover:bg-red-600">キャンセル</button>
            </div>`,
        setupEvents: (system, container) => {
            container.querySelector('#panelBtnYes').onclick = () => {
                system.world.emit(GameEvents.GAME_START_CONFIRMED);
                system.hideActionPanel();
            };
            container.querySelector('#panelBtnNo').onclick = () => system.hideActionPanel();
        }
    },
    // --- 行動選択 ---
    [ModalType.SELECTION]: {
        getOwnerName: (data) => data.ownerName,
        // ★リファクタリング: HTML生成ロジックをsystemインスタンス経由で呼び出す
        getContentHTML: (data, system) => system.generateTriangleLayoutHTML(data.buttons),
        setupEvents: (system, container, data) => system.setupSelectionEvents(container, data),
        handleNavigation: (system, key) => system.handleArrowKeyNavigation(key),
        handleConfirm: (system) => system.confirmSelection(),
        init: (system, data) => {
            const available = data.buttons.filter(b => !b.isBroken);
            const initialFocusKey = available.find(b => b.partKey === PartInfo.HEAD.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.RIGHT_ARM.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.LEFT_ARM.key)?.partKey;
            if (initialFocusKey) setTimeout(() => system.updateFocus(initialFocusKey), 0);
        }
    },
    // --- 攻撃宣言 ---
    [ModalType.ATTACK_DECLARATION]: {
        getActorName: (data) => data.message,
        isClickable: true,
        init: (system, data) => {
            system.dom.actionPanelActor.dataset.guardMessageShown = 'false';
        },
        handleConfirm: (system, data) => {
            const { entityId, resolvedEffects, isEvaded, isSupport, guardianInfo } = data;
            if (guardianInfo && system.dom.actionPanelActor.dataset.guardMessageShown === 'false') {
                system.dom.actionPanelActor.textContent = `${guardianInfo.name}のガード発動！`;
                system.dom.actionPanelActor.dataset.guardMessageShown = 'true';
                return;
            }
            // ★変更: entityId を attackerId にリネームしてイベントを発行
            system.world.emit(GameEvents.ATTACK_DECLARATION_CONFIRMED, { attackerId: entityId, resolvedEffects, isEvaded, isSupport, guardianInfo });
            // ★注意: ここでhideActionPanelは呼ばない。後続のACTION_EXECUTEDイベントで表示が更新されるため。
        }
    },
    // --- 結果表示 ---
    [ModalType.EXECUTION_RESULT]: {
        getActorName: (data) => _generateResultMessage(data, system.world),
        // ★リファクタリング: イベント設定ロジックをsystemインスタンス経由で呼び出す
        setupEvents: (system, container, data) => system.setupExecutionResultEvents(container, data),
        handleConfirm: (system, data) => {
            system.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: data.attackerId });
            system.hideActionPanel();
        }
    },
    // --- バトル開始確認 ---
    [ModalType.BATTLE_START_CONFIRM]: {
        getActorName: () => '合意と見てよろしいですね！？',
        isClickable: true,
        handleConfirm: (system) => {
            system.world.emit(GameEvents.BATTLE_START_CONFIRMED);
            system.hideActionPanel();
        },
        handleCancel: (system) => {
            system.world.emit(GameEvents.BATTLE_START_CANCELLED);
            system.hideActionPanel();
        }
    },
    // ---汎用メッセージ ---
    [ModalType.MESSAGE]: {
        getActorName: (data) => data.message,
        isClickable: true,
        handleConfirm: (system) => system.hideActionPanel(),
    },
    // --- ゲームオーバー ---
    [ModalType.GAME_OVER]: {
        getTitle: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
        getActorName: () => 'ロボトル終了！',
        isClickable: true,
        handleConfirm: (system) => {
            system.world.emit(GameEvents.RESET_BUTTON_CLICKED);
            system.hideActionPanel();
        }
    }
});