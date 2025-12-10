/**
 * @file TimelineBuilder.js
 * @description 戦闘アクションの実行シーケンス（タスクリスト）を構築する。
 */
import { 
    createAnimateTask, 
    createEventTask, 
    createCustomTask,
    createDialogTask,
    createUiAnimationTask
} from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { ModalType } from '../common/constants.js';
import { MessageService } from '../services/MessageService.js';
import { CooldownService } from '../services/CooldownService.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
        this.messageGenerator = new MessageService(world);
    }

    buildAttackSequence(resultData) {
        const tasks = [];
        const { attackerId, intendedTargetId, targetId, isCancelled, appliedEffects, guardianInfo } = resultData;

        if (isCancelled) {
            return [];
        }

        // 1. ターゲットアニメーション
        const animationTargetId = intendedTargetId || targetId;
        if (animationTargetId) {
            tasks.push(createAnimateTask(attackerId, animationTargetId, 'attack'));
        } else {
            tasks.push(createAnimateTask(attackerId, attackerId, 'support'));
        }

        // 2. 攻撃宣言メッセージ
        const declarationSeq = this.messageGenerator.createDeclarationSequence(resultData);
        declarationSeq.forEach(msg => {
            tasks.push(createDialogTask(msg.text, { modalType: ModalType.ATTACK_DECLARATION }));
        });

        // 3. 結果演出
        if (appliedEffects && appliedEffects.length > 0) {
            const mainEffectType = appliedEffects[0].type;
            const resultTasks = EffectRegistry.createTasks(mainEffectType, {
                world: this.world,
                effects: appliedEffects,
                guardianInfo,
                messageGenerator: this.messageGenerator
            });
            tasks.push(...resultTasks);

        } else if (!resultData.outcome.isHit && resultData.intendedTargetId) {
             // 回避メッセージ
             const resultSeq = this.messageGenerator.createResultSequence(resultData);
             if (resultSeq.length > 0 && resultSeq[0].text) {
                 tasks.push(createDialogTask(resultSeq[0].text, { modalType: ModalType.EXECUTION_RESULT }));
             }
        }

        // 4. クールダウンへの移行
        tasks.push(createCustomTask((world) => {
            CooldownService.transitionToCooldown(world, attackerId);
        }));
        
        // 5. UI更新とキャンセルチェック
        tasks.push(createEventTask(GameEvents.REFRESH_UI, {}));
        tasks.push(createEventTask(GameEvents.CHECK_ACTION_CANCELLATION, {}));

        return tasks;
    }
}