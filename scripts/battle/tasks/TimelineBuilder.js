/**
 * @file TimelineBuilder.js
 * @description 戦闘アクションの実行シーケンス（タスクリスト）を構築する。
 * Logicデータの更新はSystem側で行われるため、ここではVisual演出用のタスク生成に集中する。
 */
import { 
    createWaitTask, createAnimateTask, 
    createMessageTask, createEventTask, createCustomTask 
} from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { ModalType, ActionCancelReason } from '../common/constants.js';
import { MessageGenerator } from '../utils/MessageGenerator.js';
import { PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { CooldownService } from '../services/CooldownService.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
        this.messageGenerator = new MessageGenerator(world);
    }

    buildAttackSequence(resultData) {
        const tasks = [];
        const { attackerId, intendedTargetId, targetId, isCancelled, cancelReason, appliedEffects, guardianInfo, summary } = resultData;

        // --- キャンセル時のシーケンス ---
        // (BattleSequenceSystemで直接処理されるようになったため、ここには到達しないはずだが念のため残す)
        if (isCancelled) {
            return [];
        }

        // --- 正常実行時のシーケンス ---

        // 1. ターゲットアニメーション（攻撃演出）
        const animationTargetId = intendedTargetId || targetId;
        if (animationTargetId) {
            tasks.push(createAnimateTask(attackerId, animationTargetId, 'attack'));
        } else {
            tasks.push(createAnimateTask(attackerId, attackerId, 'support'));
        }

        // 2. 統合メッセージシーケンス（宣言 + 結果表示 + HPバーアニメーション）
        // Logicデータは既に更新済み。Visualとの同期（アニメーション）はメッセージ表示中に行われる。
        // AnimationSystem は appliedEffects 内の oldHp / newHp を見てTweenを行う。
        const declarationSeq = this.messageGenerator.createDeclarationSequence(resultData);
        const resultSeq = this.messageGenerator.createResultSequence(resultData);
        const fullMessageSequence = [...declarationSeq, ...resultSeq];

        tasks.push(createMessageTask(ModalType.ATTACK_DECLARATION, { ...resultData }, fullMessageSequence));

        // 3. ガード回数終了メッセージ
        if (summary.isGuardExpired) {
            const expiredEffect = appliedEffects.find(e => e.type === EffectType.CONSUME_GUARD && e.isExpired);
            if (expiredEffect) {
                const actorInfo = this.world.getComponent(expiredEffect.targetId, PlayerInfo);
                const message = this.messageGenerator.format(MessageKey.GUARD_EXPIRED, { actorName: actorInfo?.name || '???' });
                
                tasks.push(createMessageTask(ModalType.MESSAGE, { message }, [{ text: message }]));
            }
        }

        // 4. クールダウンへの移行 (Service呼び出し)
        tasks.push(createCustomTask((world) => {
            CooldownService.transitionToCooldown(world, attackerId);
        }));
        
        // 5. UIの最終整合性確保 (VisualコンポーネントをLogicデータと完全同期)
        // アニメーションでズレが生じている可能性があるため念押し
        tasks.push(createEventTask(GameEvents.REFRESH_UI, {}));

        // 6. キャンセル状態チェック
        tasks.push(createEventTask(GameEvents.CHECK_ACTION_CANCELLATION, {}));

        return tasks;
    }
}