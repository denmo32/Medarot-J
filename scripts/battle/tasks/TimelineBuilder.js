/**
 * @file TimelineBuilder.js
 * @description 戦闘アクションの実行シーケンス（タスクリスト）を構築する。
 * EffectRegistry導入により、演出生成ロジックを委譲。
 */
import { 
    createAnimateTask, createEventTask, createCustomTask,
    createDialogTask
} from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { ModalType } from '../common/constants.js';
import { MessageGenerator } from '../utils/MessageGenerator.js';
import { CooldownService } from '../services/CooldownService.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js'; // 変更

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
        this.messageGenerator = new MessageGenerator(world);
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
        if (declarationSeq.length > 0) {
            const text = declarationSeq[0].text;
            tasks.push(createDialogTask(text, { modalType: ModalType.ATTACK_DECLARATION }));
        }

        // 3. 結果演出 (EffectRegistryに委譲)
        if (appliedEffects && appliedEffects.length > 0) {
            // 複数の効果がある場合、最初の効果タイプに基づいてタスクを一括生成する方式をとるか、
            // 効果ごとに生成して結合するか。現状の設計ではメインの効果タイプ（先頭）に依存する形が自然。
            // ただし、Scanのようにチーム全体にかかるものはまとめて1つ、
            // ダメージのように連続するものはまとめてシーケンス化したい。
            // EffectRegistry.createTasks に全効果を渡して、Effect側で判断させる。

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