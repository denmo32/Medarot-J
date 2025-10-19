/**
 * @file メッセージ生成システム
 * このシステムは、ゲーム内で発生する様々なイベントを購読し、
 * それに応じたUIメッセージを生成して表示を要求する責務を持ちます。
 * ロジックと表示（メッセージ）を完全に分離するための中心的な役割を担います。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { ModalType, PartKeyToInfoMap, EffectType } from '../common/constants.js';
import { MessageTemplates, MessageKey } from '../data/messageRepository.js';
import { PlayerInfo, Parts } from '../core/components/index.js';

export class MessageSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // メッセージ生成ロジックを効果タイプごとのマップに集約
        // これにより、新しい効果タイプを追加する際にこのマップにエントリを追加するだけで済む
        this.supportMessageFormatters = {
            [EffectType.HEAL]: this._formatHealMessage.bind(this),
            [EffectType.APPLY_SCAN]: this._formatScanMessage.bind(this),
            [EffectType.APPLY_GLITCH]: this._formatGlitchMessage.bind(this),
            [EffectType.APPLY_GUARD]: this._formatGuardMessage.bind(this),
        };
        
        // メッセージ生成のトリガーとなるイベントを購読
        this.world.on(GameEvents.ACTION_DECLARED, this.onActionDeclared.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        // ガード破壊イベントを購読
        this.world.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    /**
     * 行動が宣言された時に、攻撃宣言モーダルのメッセージシーケンスを生成します。
     * @param {object} detail - ACTION_DECLAREDイベントのペイロード
     */
    onActionDeclared(detail) {
        const { attackerId, targetId, attackingPart, isSupport, guardianInfo } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        // メッセージを順番に表示するためのシーケンス配列
        const messageSequence = [];

        // --- 1. メインの宣言メッセージを生成 ---
        let mainMessageText;
        if (isSupport) {
            mainMessageText = this.format(MessageKey.SUPPORT_DECLARATION, {
                attackerName: attackerInfo.name,
                actionType: attackingPart.action,
                trait: attackingPart.trait,
            });
        } else if (!targetId) {
            mainMessageText = this.format(MessageKey.ATTACK_MISSED, {
                attackerName: attackerInfo.name,
            });
        } else {
            mainMessageText = this.format(MessageKey.ATTACK_DECLARATION, {
                attackerName: attackerInfo.name,
                attackType: attackingPart.type,
                trait: attackingPart.trait,
            });
        }
        // シーケンスの最初のステップとして追加
        messageSequence.push({ text: mainMessageText });

        // --- 2. ガードメッセージをシーケンスに追加 ---
        if (guardianInfo) {
            const guardMessageText = this.format(MessageKey.GUARDIAN_TRIGGERED, {
                guardianName: guardianInfo.name,
            });
            // シーケンスの2番目のステップとして追加
            messageSequence.push({ text: guardMessageText });
        }

        // --- 3. ActionPanelSystemにモーダル表示を要求 ---
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: { ...detail }, // 元のイベントデータを引き継ぐ
            messageSequence: messageSequence, // 生成したシーケンスを渡す
            immediate: true,
        });
    }

    /**
     * 行動が実行された後に、結果表示モーダルのメッセージシーケンスを生成します。
     * @param {object} detail - ACTION_EXECUTEDイベントのペイロード
     */
    onActionExecuted(detail) {
        const { appliedEffects, isEvaded, isSupport, attackerId, targetId, guardianInfo } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        let messageSequence = [];
        const isHealAction = appliedEffects && appliedEffects.some(e => e.type === EffectType.HEAL);

        if (isSupport && !isHealAction) {
            // 回復以外の支援行動
            const supportMessage = this.generateSupportResultMessage(appliedEffects[0]);
            messageSequence.push({ text: supportMessage });
        } else if (isEvaded) {
            const targetName = targetId ? this.world.getComponent(targetId, PlayerInfo)?.name : '相手';
            const evadedMessage = this.format(MessageKey.ATTACK_EVADED, { targetName });
            messageSequence.push({ text: evadedMessage });
        } else if (appliedEffects && appliedEffects.length > 0) {
            // ダメージ/回復結果をシーケンスに変換
            messageSequence = this.generateDamageResultSequence(appliedEffects, guardianInfo);
        } else {
            const missedMessage = this.format(MessageKey.ATTACK_MISSED, { attackerName: attackerInfo.name });
            messageSequence.push({ text: missedMessage });
        }
        
        // ActionPanelSystemにモーダル表示を要求
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: { ...detail }, // 元のイベントデータを引き継ぐ
            messageSequence: messageSequence, // 生成したシーケンスを渡す
            immediate: true
        });
    }

    /**
     * 行動がキャンセルされた時のメッセージを生成します。
     * @param {object} detail - ACTION_CANCELLEDイベントのペイロード
     */
    onActionCancelled(detail) {
        const { entityId, reason } = detail;
        const actorInfo = this.world.getComponent(entityId, PlayerInfo);
        if (!actorInfo) return;

        let messageKey;
        if (reason === 'PART_BROKEN') {
            messageKey = MessageKey.CANCEL_PART_BROKEN;
        } else if (reason === 'TARGET_LOST') {
            messageKey = MessageKey.CANCEL_TARGET_LOST;
        } else {
            return; // 不明な理由の場合は何もしない
        }
        
        const message = this.format(messageKey, { actorName: actorInfo.name });
        
        // 汎用メッセージモーダルで表示（これは単一メッセージなのでシーケンスは不要）
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }

    /**
     * ガードパーツが破壊された時のメッセージを生成します。
     * @param {object} detail - GUARD_BROKENイベントのペイロード
     */
    onGuardBroken(detail) {
        const { entityId } = detail;
        const message = this.format(MessageKey.GUARD_BROKEN);
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }
    
    // --- ヘルパーメソッド ---

    /**
     * 複数のダメージ/回復効果を元に、連結されたメッセージを生成します。
     * @private
     */
    generateDamageResultMessage(effects, guardianInfo) {
        let messages = [];
        if (!effects || effects.length === 0) return '';
    
        const firstEffect = effects[0];
    
        if (firstEffect.type === EffectType.HEAL) {
            messages.push(this._formatHealMessage(firstEffect));
        } else { // HEAL以外はダメージ系として扱う
            let prefix = firstEffect.isCritical ? this.format(MessageKey.CRITICAL_HIT) : '';
            const targetInfo = this.world.getComponent(firstEffect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[firstEffect.partKey]?.name || '不明部位';
    
            if (guardianInfo) {
                messages.push(prefix + this.format(MessageKey.GUARDIAN_DAMAGE, {
                    guardianName: guardianInfo.name,
                    partName: partName,
                    damage: firstEffect.value,
                }));
            } else if (firstEffect.isDefended) {
                messages.push(prefix + this.format(MessageKey.DEFENSE_SUCCESS, {
                    targetName: targetInfo.name,
                    partName: partName,
                    damage: firstEffect.value,
                }));
            } else {
                messages.push(prefix + this.format(MessageKey.DAMAGE_APPLIED, {
                    targetName: targetInfo.name,
                    partName: partName,
                    damage: firstEffect.value,
                }));
            }
        }
    
        // 2つ目以降の貫通ダメージメッセージを生成
        for (let i = 1; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.isPenetration) {
                const penetratedPartName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
                messages.push(this.format(MessageKey.PENETRATION_DAMAGE, {
                    partName: penetratedPartName,
                    damage: effect.value,
                }));
            }
        }
    
        return messages.join('<br>'); // HTMLの改行タグで連結
    }

    /**
     * ダメージ/回復効果を元に、アニメーション待機を含むメッセージシーケンスを生成します。
     * @private
     */
    generateDamageResultSequence(effects, guardianInfo) {
        const sequence = [];
        if (!effects || effects.length === 0) return [];
        
        // generateDamageResultMessageは<br>で連結された単一の文字列を返す
        const messageLines = this.generateDamageResultMessage(effects, guardianInfo).split('<br>');

        // HP変動があったかどうかのフラグ
        const hasHpChange = effects.some(e => (e.type === EffectType.DAMAGE || e.type === EffectType.HEAL) && e.value > 0);

        if (messageLines.length > 0) {
            // 最初のメッセージを表示
            sequence.push({ text: messageLines[0] });

            // HP変動があった場合、アニメーション待機ステップを挿入
            if (hasHpChange) {
                sequence.push({ waitForAnimation: GameEvents.HP_BAR_ANIMATION_COMPLETED });
            }

            // 貫通など、2つ目以降のメッセージがあれば追加
            for (let i = 1; i < messageLines.length; i++) {
                sequence.push({ text: messageLines[i] });
            }
        }
        
        return sequence;
    }

    // 巨大なswitch文を廃止し、マップベースのディスパッチに変更
    /**
     * 支援行動の結果メッセージを生成します。
     * @private
     */
    generateSupportResultMessage(effect) {
        if (!effect) return '支援行動成功！';
        
        // マップから対応するフォーマッター関数を取得
        const formatter = this.supportMessageFormatters[effect.type];
        
        // フォーマッターが存在すれば実行し、なければデフォルトメッセージを返す
        return formatter ? formatter(effect) : '支援行動成功！';
    }

    /**
     * 回復行動の結果メッセージを生成します。
     * @param {object} effect - 回復効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatHealMessage(effect) {
        if (effect.value > 0) {
            const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
            return this.format(MessageKey.HEAL_SUCCESS, { 
                targetName: targetInfo.name, 
                partName: partName, 
                healAmount: effect.value 
            });
        }
        return this.format(MessageKey.HEAL_FAILED);
    }

    /**
     * スキャン行動の結果メッセージを生成します。
     * @param {object} effect - スキャン効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatScanMessage(effect) {
        return this.format(MessageKey.SUPPORT_SCAN_SUCCESS, { 
            scanBonus: effect.value, 
            duration: effect.duration 
        });
    }

    /**
     * 妨害行動の結果メッセージを生成します。
     * @param {object} effect - 妨害効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatGlitchMessage(effect) {
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        return effect.wasSuccessful
            ? this.format(MessageKey.INTERRUPT_GLITCH_SUCCESS, { targetName: targetInfo.name })
            : this.format(MessageKey.INTERRUPT_GLITCH_FAILED);
    }

    /**
     * 防御行動の結果メッセージを生成します。
     * @param {object} effect - 防御効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatGuardMessage(effect) {
        return this.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
    }

    /**
     * メッセージテンプレートをデータでフォーマットします。
     * @param {string} key - MessageTemplatesのキー
     * @param {object} data - プレースホルダーを置き換えるデータ
     * @returns {string} フォーマット済みのメッセージ
     */
    format(key, data = {}) {
        let template = MessageTemplates[key] || '';
        for (const placeholder in data) {
            template = template.replace(new RegExp(`{${placeholder}}`, 'g'), data[placeholder]);
        }
        return template;
    }

    update(deltaTime) {}
}