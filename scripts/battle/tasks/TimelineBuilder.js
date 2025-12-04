/**
 * @file TimelineBuilder.js
 * @description 戦闘アクションの実行シーケンス（タスクリスト）を構築する。
 * VisualizerRegistry導入により、演出生成ロジックを分離。
 */
import { 
    createAnimateTask, createEventTask, createCustomTask,
    createDialogTask
} from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { ModalType } from '../common/constants.js';
import { MessageGenerator } from '../utils/MessageGenerator.js';
import { PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { CooldownService } from '../services/CooldownService.js';
import { VisualizerRegistry } from './visualizers/VisualizerRegistry.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
        this.messageGenerator = new MessageGenerator(world);
    }

    buildAttackSequence(resultData) {
        const tasks = [];
        const { attackerId, intendedTargetId, targetId, isCancelled, appliedEffects, summary, guardianInfo } = resultData;

        if (isCancelled) {
            return [];
        }

        // 1. ターゲットアニメーション（攻撃演出）
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

        // 3. 結果演出 (VisualizerRegistryに委譲)
        // appliedEffects が存在する場合のみ実行
        if (appliedEffects && appliedEffects.length > 0) {
            const resultTasks = VisualizerRegistry.createVisualTasks(this.world, appliedEffects, { guardianInfo });
            tasks.push(...resultTasks);
        } else if (!resultData.outcome.isHit && resultData.intendedTargetId) {
             // 回避メッセージ (Visualizerが処理しないケース)
             const resultSeq = this.messageGenerator.createResultSequence(resultData);
             if (resultSeq.length > 0 && resultSeq[0].text) {
                 tasks.push(createDialogTask(resultSeq[0].text, { modalType: ModalType.EXECUTION_RESULT }));
             }
        }

        // 4. ガード回数終了メッセージ
        if (summary.isGuardExpired) {
            const expiredEffect = appliedEffects.find(e => e.type === EffectType.CONSUME_GUARD && e.isExpired);
            if (expiredEffect) {
                const actorInfo = this.world.getComponent(expiredEffect.targetId, PlayerInfo);
                const message = this.messageGenerator.format(MessageKey.GUARD_EXPIRED, { actorName: actorInfo?.name || '???' });
                tasks.push(createDialogTask(message, { modalType: ModalType.MESSAGE }));
            }
        }

        // 5. クールダウンへの移行
        tasks.push(createCustomTask((world) => {
            CooldownService.transitionToCooldown(world, attackerId);
        }));
        
        // 6. UIの最終整合性確保
        tasks.push(createEventTask(GameEvents.REFRESH_UI, {}));

        // 7. キャンセル状態チェック
        tasks.push(createEventTask(GameEvents.CHECK_ACTION_CANCELLATION, {}));

        return tasks;
    }
}