/**
 * @file DefaultVisualStrategy.js
 * @description 汎用的な演出生成ストラテジー。
 * EffectRegistryのresolveVisualを利用してメッセージを構築し、
 * ダイアログとHPバーアニメーションのタスクを生成する。
 */
import { VisualStrategy } from './VisualStrategy.js';
import { EffectRegistry } from '../../registries/EffectRegistry.js';
import { MessageFormatter } from '../../utils/MessageFormatter.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';
import { MessageKey } from '../../../data/messageRepository.js';
import { ModalType, EffectType } from '../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { PartKeyToInfoMap } from '../../../common/constants.js';

export class DefaultVisualStrategy extends VisualStrategy {
    constructor(world) {
        super();
        this.world = world;
    }

    createTasks(context, effect, visualConfig) {
        // Handlerから演出情報を取得
        const handler = EffectRegistry.get(effect.type);
        if (!handler) return [];

        const visualResult = handler.resolveVisual(effect, visualConfig);
        if (!visualResult || !visualResult.messageKey) return [];

        const tasks = [];
        
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);

        const params = {
            targetName: targetInfo?.name || '不明',
            partName: PartKeyToInfoMap[effect.partKey]?.name || '不明部位',
            damage: effect.value,
            healAmount: effect.value,
            scanBonus: effect.value,
            duration: effect.duration || 0,
            guardCount: effect.value,
            actorName: targetInfo?.name || '???',
            // マージされたパラメータ (resolveVisualで追加された場合)
            ...(visualResult.params || {})
        };

        // ガーディアンコンテキストの補完
        if (context.guardianInfo) {
            const guardianPlayerInfo = this.world.getComponent(context.guardianInfo.id, PlayerInfo);
            params.guardianName = guardianPlayerInfo?.name || context.guardianInfo.name;
        }

        let text = MessageFormatter.format(MessageKey[visualResult.messageKey] || visualResult.messageKey, params);
        
        if (effect.type === EffectType.DAMAGE && effect.isCritical) {
            text = MessageFormatter.format(MessageKey.CRITICAL_HIT) + text;
        }

        tasks.push({
            type: 'DIALOG',
            text,
            options: { modalType: ModalType.EXECUTION_RESULT }
        });

        // HPバー演出の有無判定
        // EffectVisualConfig -> Default Fallback
        const effectVisualDef = visualConfig?.impacts?.[effect.type] || VisualDefinitions[effect.type];
        const shouldShowHpBar = effectVisualDef?.showHpBar;

        if (shouldShowHpBar && effect.value > 0) {
            tasks.push({ type: 'UI_ANIMATION', targetType: 'HP_BAR', data: { appliedEffects: [effect] } });
        }

        return tasks;
    }
}