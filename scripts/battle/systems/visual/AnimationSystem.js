/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントのアニメーション制御。
 * 内部状態(activeTweens)を排除し、ActiveTweenコンポーネントによるデータ駆動型へリファクタリング。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual } from '../../components/index.js';
import { AnimateTask, UiAnimationTask } from '../../components/Tasks.js';
import { AnimationState, UIStateUpdateState, ActiveTween, TweenCompletedSignal } from '../../components/States.js';
import {
    BattleStartAnimationRequest,
    BattleStartAnimationCompleted,
    RefreshUIRequest
} from '../../components/Requests.js';
import { Parts } from '../../../components/index.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType } from '../../common/constants.js';
import { Easing, lerp } from '../../../../engine/utils/Tween.js';

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        // ステートレス: activeTweens などの保持変数は削除
    }

    update(deltaTime) {
        // 0. リクエスト処理
        this._processBattleStartRequests();
        this._processAnimationStates();
        this._processRefreshRequests();

        // 1. ActiveTween の更新
        this._processActiveTweens(deltaTime);

        // 2. AnimateTask の処理
        const animateTasks = this.getEntities(AnimateTask);
        for (const entityId of animateTasks) {
            this._processAnimationTask(entityId, deltaTime);
        }

        // 3. UiAnimationTask の処理 (完了監視)
        const uiTaskEntities = this.getEntities(UiAnimationTask);
        for (const entityId of uiTaskEntities) {
            this._processUiAnimationTask(entityId);
        }
    }

    // --- Active Tween Processing ---

    _processActiveTweens(deltaTime) {
        const tweenEntities = this.getEntities(ActiveTween);
        
        for (const entityId of tweenEntities) {
            const tween = this.world.getComponent(entityId, ActiveTween);
            
            tween.elapsed += deltaTime;
            const progress = Math.min(tween.elapsed / tween.duration, 1.0);
            
            // イージング適用
            const easeFn = Easing[tween.easing] || Easing.linear;
            const t = easeFn(progress);
            
            // 値の適用
            this._applyTweenValue(tween, t);

            // 完了判定
            if (progress >= 1.0) {
                // 親への通知
                if (tween.parentId && this.world.entities.has(tween.parentId)) {
                    // 親エンティティに完了シグナルを付与（重複可とするため、エンティティを分けるかカウンタを減らす）
                    // ここではシンプルに、親エンティティに「完了通知タグ」を付ける形にするが、
                    // 1フレームに複数が完了する場合を考慮し、専用の通知エンティティを作るのが安全。
                    const signal = this.world.createEntity();
                    this.world.addComponent(signal, new TweenCompletedSignal());
                    // Signalに親IDを持たせて紐付ける
                    signal.parentId = tween.parentId; // JS動的プロパティ利用（本来はComponent定義すべき）
                }
                
                this.world.destroyEntity(entityId);
            }
        }
    }

    _applyTweenValue(tween, t) {
        if (tween.type === 'HP_UPDATE') {
            const visual = this.world.getComponent(tween.targetId, Visual);
            if (visual && visual.partsInfo[tween.partKey]) {
                const currentVal = lerp(tween.start, tween.end, t);
                visual.partsInfo[tween.partKey].current = currentVal;
            }
        }
    }

    // --- Request Processors ---

    _processBattleStartRequests() {
        const entities = this.getEntities(BattleStartAnimationRequest);
        for (const entityId of entities) {
            this._startBattleStartAnimation();
            this.world.destroyEntity(entityId);
        }
    }

    _processAnimationStates() {
        const entities = this.getEntities(AnimationState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, AnimationState);
            if (state.type === 'HP_BAR') {
                // UIタスクとして処理せず、直接Tweenを発行して完了を待つ簡易フロー
                // ここではデモ用として完了通知エンティティを即座に作成するコールバック渡し...ではなく
                // AnimationState自体をタスク化するか、UiAnimationTaskと同様のフローに乗せるのが正しい。
                // 既存ロジック互換のため、不可視のUiAnimationTask相当の処理を行う。
                
                const taskEntity = this.world.createEntity();
                const task = new UiAnimationTask('HP_BAR', state.data);
                // 完了時に UIStateUpdateState を発行するフラグなどが必要だが、
                // ここでは簡略化のため state.onComplete 相当のことを行う。
                
                // 修正: AnimationState自体は単発リクエスト的なので、
                // これをUiAnimationTaskに変換して処理を委譲するのがスマート。
                this.world.addComponent(taskEntity, task);
                
                // 完了監視用のタグなどを付ける必要があるが、
                // ModalSystem側が UIStateUpdateState を待っているので、
                // Task完了時にそれを発行するように UiAnimationTask にメタデータを持たせたい。
                task.emitOnComplete = 'ANIMATION_COMPLETED';

                // リクエスト消費
                state.type = null; 
            }
        }
    }

    _processRefreshRequests() {
        const entities = this.getEntities(RefreshUIRequest);
        if (entities.length > 0) {
            this._refreshUI();
            for (const id of entities) this.world.destroyEntity(id);
        }
    }

    // --- Task Processors ---

    _processAnimationTask(entityId, deltaTime) {
        const task = this.world.getComponent(entityId, AnimateTask);
        
        if (!task._startTime) {
            task._startTime = performance.now();
            task._duration = 0;
            
            if (task.animationType === 'attack') {
                this._startAttackAnimation(entityId, task.targetId);
                task._duration = 600; 
            } else {
                task._duration = UI_CONFIG.ANIMATION.DURATION || 300;
            }
        }

        if (!task._elapsed) task._elapsed = 0;
        task._elapsed += deltaTime;

        if (task._elapsed >= task._duration) {
            if (task.animationType === 'attack') {
                this._cleanupAttackAnimation();
            }
            this.world.removeComponent(entityId, AnimateTask);
        }
    }

    _startAttackAnimation(attackerId, targetId) {
        const visualAttacker = this.world.getComponent(attackerId, Visual);
        const visualTarget = this.world.getComponent(targetId, Visual);

        if (visualAttacker) {
            visualAttacker.classes.add('attacker-active');
        }
        if (visualTarget) {
            visualTarget.classes.add('target-lockon');
        }
    }

    _cleanupAttackAnimation() {
        const entities = this.getEntities(Visual);
        for (const entityId of entities) {
            const visual = this.world.getComponent(entityId, Visual);
            if (visual.classes.has('attacker-active')) visual.classes.delete('attacker-active');
            if (visual.classes.has('target-lockon')) visual.classes.delete('target-lockon');
        }
    }

    _processUiAnimationTask(entityId) {
        const task = this.world.getComponent(entityId, UiAnimationTask);
        
        if (task.targetType === 'HP_BAR') {
            if (!task._initialized) {
                task._initialized = true;
                
                const tweenCount = this._spawnHpBarTweens(entityId, task.data.appliedEffects);
                task._pendingTweens = tweenCount;

                if (tweenCount === 0) {
                    this._completeUiTask(entityId, task);
                }
            } else {
                // 完了シグナルをチェック
                // このフレームで完了したTweenの数だけカウントを減らす
                // TweenCompletedSignal は一時エンティティなので全検索してもコストは低い
                // (最適化: SignalにparentIdを持たせてフィルタリング)
                
                // 動的プロパティ parentId を持つ Signal エンティティを探す
                // 注意: getEntities はコンポーネントクラスを引数にとる
                // ここでは全エンティティスキャンは重いので、TweenCompletedSignalをQueryでキャッシュすべきだが、
                // 簡易的に World.js の実装依存で処理する。
                // 実際には System.getEntities(TweenCompletedSignal) で取得可能。
                
                const signals = this.getEntities(TweenCompletedSignal);
                let completedCount = 0;
                
                for (const signalId of signals) {
                    const signalEntity = this.world.entities.get(signalId);
                    // シグナルエンティティ自体に動的にプロパティがついている場合
                    // (先ほどの _processActiveTweens で signal.parentId = ... とした)
                    // ECS的にはコンポーネントデータを見るべきだが、動的プロパティで代用
                    // 厳密には TweenCompletedSignal に parentId プロパティを持たせるべき
                    
                    // 実装修正: TweenCompletedSignalコンポーネント自体にはデータを持たせず、
                    // JSオブジェクトとしてのエンティティ(あるいはコンポーネントインスタンス)にデータを持たせている想定
                    // ここではコンポーネントインスタンスを取得して確認できないため（Worldの実装による）、
                    // _processActiveTweens で createEntity した際に、
                    // コンポーネントそのものではなく、signalエンティティオブジェクト(JS)にプロパティを付けるのは
                    // ECSフレームワークの仕様依存になる。
                    
                    // よって、_processActiveTweens で Signal ではなく、
                    // 直接 task._pendingTweens を減らすことは System 間の結合になるため避ける。
                    // ここでは、「TweenCompletedSignalコンポーネントが付与されたエンティティ」の
                    // 検索を行う。
                    // 簡略化: parentIdを保持するコンポーネント `ParentLink` を定義して付けるのが正解。
                    
                    // 今回はコード量の制約上、動的プロパティ `signal.parentId` を
                    // `this.world.entities.get(signalId).parentId` ではなく
                    // `this.world.getComponent(signalId, TweenCompletedSignal)` にデータを持たせる変更を行うべきだが、
                    // TweenCompletedSignal はタグとして定義されている。
                    
                    // 解決策: signal.parentId は検索できないので、
                    // task._pendingTweens を減らすロジックを ActiveTween 処理時に行う方が現実的だが、
                    // それは System が Task コンポーネントを知っていることになる。
                    // アニメーションシステムなのでそれは許容範囲。
                    
                    // したがって、_processActiveTweens 内で直接減算する方式に変更する。
                    // ECS原則「通信は疎結合」からは少し外れるが、親子関係が明確なため許容。
                }
            }
        } else {
            this.world.removeComponent(entityId, UiAnimationTask);
        }
    }
    
    // _processActiveTweens 内で呼び出される完了ハンドラ相当
    _onTweenComplete(parentId) {
        if (!parentId) return;
        const task = this.world.getComponent(parentId, UiAnimationTask);
        if (task && task._pendingTweens > 0) {
            task._pendingTweens--;
            if (task._pendingTweens <= 0) {
                this._completeUiTask(parentId, task);
            }
        }
    }

    _completeUiTask(entityId, task) {
        if (task.emitOnComplete === 'ANIMATION_COMPLETED') {
            const stateEntity = this.world.createEntity();
            const uiStateUpdateState = new UIStateUpdateState();
            uiStateUpdateState.type = 'ANIMATION_COMPLETED';
            this.world.addComponent(stateEntity, uiStateUpdateState);
        }
        this.world.removeComponent(entityId, UiAnimationTask);
    }

    /**
     * Tweenエンティティを生成する
     */
    _spawnHpBarTweens(parentId, appliedEffects) {
        if (!appliedEffects || appliedEffects.length === 0) return 0;
        let count = 0;

        for (const effect of appliedEffects) {
            if (effect.type !== EffectType.DAMAGE && effect.type !== EffectType.HEAL) continue;

            const { targetId, partKey, oldHp, newHp } = effect;
            if (targetId == null || !partKey || oldHp === undefined || newHp === undefined || oldHp === newHp) {
                this._syncHpValue(targetId, partKey, newHp);
                continue;
            }

            const visual = this.world.getComponent(targetId, Visual);
            if (!visual) continue;

            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: oldHp, max: 100 };
            
            // Tweenエンティティ生成
            const tweenEntity = this.world.createEntity();
            const tween = new ActiveTween({
                targetId,
                type: 'HP_UPDATE',
                partKey,
                start: oldHp,
                end: newHp,
                duration: UI_CONFIG.ANIMATION.HP_BAR.DURATION,
                easing: 'easeOutQuad', // 文字列で指定
                parentId
            });
            this.world.addComponent(tweenEntity, tween);
            
            count++;
        }
        return count;
    }
    
    // ActiveTween処理を上書き（parentIdへの通知を追加）
    _processActiveTweens(deltaTime) {
        const tweenEntities = this.getEntities(ActiveTween);
        
        for (const entityId of tweenEntities) {
            const tween = this.world.getComponent(entityId, ActiveTween);
            
            tween.elapsed += deltaTime;
            const progress = Math.min(tween.elapsed / tween.duration, 1.0);
            
            const easeFn = Easing[tween.easing] || Easing.linear;
            const t = easeFn(progress);
            
            this._applyTweenValue(tween, t);

            if (progress >= 1.0) {
                // 直接通知方式
                if (tween.parentId) {
                    this._onTweenComplete(tween.parentId);
                }
                this.world.destroyEntity(entityId);
            }
        }
    }

    _refreshUI() {
        const entities = this.getEntities(Parts, Visual);
        for (const entityId of entities) {
            const parts = this.world.getComponent(entityId, Parts);
            const visual = this.world.getComponent(entityId, Visual);
            Object.keys(parts).forEach(key => {
                if (parts[key]) {
                    if (!visual.partsInfo[key]) visual.partsInfo[key] = {};
                    visual.partsInfo[key].current = parts[key].hp;
                    visual.partsInfo[key].max = parts[key].maxHp;
                }
            });
        }
    }

    _syncHpValue(entityId, partKey, hp) {
        const visual = this.world.getComponent(entityId, Visual);
        if (visual) {
            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: hp, max: 100 };
            visual.partsInfo[partKey].current = hp;
        }
    }
    
    _startBattleStartAnimation() {
        const textId = this.world.createEntity();
        const textVisual = new Visual();
        textVisual.x = 0.5;
        textVisual.y = 50;
        textVisual.classes.add('battle-start-text');
        this.world.addComponent(textId, textVisual);
        
        setTimeout(() => {
            if (this.world.entities.has(textId)) {
                this.world.destroyEntity(textId);
                this.world.addComponent(this.world.createEntity(), new BattleStartAnimationCompleted());
            }
        }, 2000);
    }
}