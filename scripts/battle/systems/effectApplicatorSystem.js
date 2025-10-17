/**
 * @file 効果適用システム (新規作成)
 * このファイルは、ActionSystemによって「解決（計算）」された効果を、
 * 実際にエンティティのコンポーネントに「適用（反映）」する責務を持ちます。
 * これにより、効果の計算ロジックと状態変更ロジックを明確に分離します。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Parts, ActiveEffects, PlayerInfo } from '../core/components/index.js';
import { EffectType, PartInfo } from '../common/constants.js';
// ★新規: 貫通ターゲット選択用のユーティリティをインポート
import { findRandomPenetrationTarget } from '../utils/queryUtils.js';

/**
 * ActionSystemが発行するEFFECTS_RESOLVEDイベントを購読し、
 * ダメージ、回復、状態異常などの効果をワールドの状態に反映させるシステム。
 */
export class EffectApplicatorSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // ★変更: ActionSystemが計算を終えた後、UI(攻撃宣言モーダル)の確認を経てから効果を適用するため、
        // 購読するイベントを ATTACK_DECLARATION_CONFIRMED に変更します。
        this.world.on(GameEvents.ATTACK_DECLARATION_CONFIRMED, this.onAttackDeclarationConfirmed.bind(this));
    }

    /**
     * ★リファクタリング: 計算済みの効果を受け取り、ワールドの状態を更新します。
     * 貫通ダメージの生成もこのメソッドが担当します。
     * @param {object} detail - ATTACK_DECLARATION_CONFIRMEDイベントのペイロード
     */
    onAttackDeclarationConfirmed(detail) {
        const { attackerId, resolvedEffects, isEvaded, isSupport, guardianInfo } = detail;
        
        // ★新規: 最終的に適用された全効果を格納するリスト
        const appliedEffects = [];
        // ★新規: 貫通などで動的に効果が追加される可能性があるため、キューで処理します
        const effectQueue = [...(resolvedEffects || [])];

        // --- 1. ガード処理 ---
        if (guardianInfo) {
            const guardianEffects = this.world.getComponent(guardianInfo.id, ActiveEffects);
            if (guardianEffects) {
                const guardEffect = guardianEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
                if (guardEffect) {
                    guardEffect.count--;
                    if (guardEffect.count <= 0) {
                        this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId: guardianInfo.id, effect: guardEffect });
                    }
                }
            }
        }

        if (!effectQueue || effectQueue.length === 0) {
            // 効果がなくても、他のシステムが結果を待っている可能性があるためイベントを発行
            this.world.emit(GameEvents.ACTION_EXECUTED, {
                attackerId: attackerId,
                appliedEffects: [],
                isEvaded: isEvaded,
                isSupport: isSupport,
                guardianInfo: guardianInfo,
            });
            return;
        }

        // --- 2. 各効果の適用 (キュー処理) ---
        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            let appliedResult = null;

            switch (effect.type) {
                case EffectType.DAMAGE:
                    appliedResult = this.applyDamage(effect);
                    break;
                case EffectType.HEAL:
                    appliedResult = this.applyHeal(effect);
                    break;
                case EffectType.APPLY_SCAN:
                    this.applyTeamEffect(effect);
                    // 適用結果はチーム全体に及ぶため、個別のappliedResultは不要
                    break;
                case EffectType.APPLY_GUARD:
                    this.applySingleEffect({ ...effect, targetId: attackerId });
                    break;
            }

            if (appliedResult) {
                appliedEffects.push(appliedResult);
                
                // ★新規: 貫通ダメージの生成ロジック
                if (appliedResult.isPartBroken && effect.penetrates && appliedResult.overkillDamage > 0) {
                    const penetrationTargetPartKey = findRandomPenetrationTarget(this.world, appliedResult.targetId, appliedResult.partKey);
                    if (penetrationTargetPartKey) {
                        // 新しい貫通ダメージ効果をキューの先頭に追加して、次のループで処理させる
                        effectQueue.unshift({
                            ...effect, // 元の効果情報（クリティカル等）を継承
                            type: EffectType.DAMAGE,
                            targetId: appliedResult.targetId,
                            partKey: penetrationTargetPartKey,
                            value: appliedResult.overkillDamage, // 余剰ダメージを威力とする
                            isPenetration: true, // 貫通ダメージであることを示すフラグ
                        });
                    }
                }
            }
        }

        // --- 3. 最終的な適用結果をイベントで発行 ---
        this.world.emit(GameEvents.ACTION_EXECUTED, {
            attackerId: attackerId,
            appliedEffects: appliedEffects, // ★変更: 実際に適用された効果(貫通含む)のリスト
            isEvaded: isEvaded,
            isSupport: isSupport,
            guardianInfo: guardianInfo,
        });
    }

    /**
     * ダメージ効果を適用し、適用結果を返します。
     * @param {object} effect - ダメージ効果オブジェクト
     * @returns {object} 適用結果オブジェクト
     * @private
     */
    applyDamage(effect) {
        const { targetId, partKey, value: damage } = effect;
        if (targetId === null || targetId === undefined) return null;

        const targetParts = this.world.getComponent(targetId, Parts);
        if (!targetParts || !targetParts[partKey]) return null;

        const part = targetParts[partKey];
        const oldHp = part.hp;
        const newHp = Math.max(0, oldHp - damage);
        part.hp = newHp;

        const actualDamage = oldHp - newHp;
        const overkillDamage = damage - actualDamage;
        const isPartBroken = oldHp > 0 && newHp === 0;

        this.world.emit(GameEvents.HP_UPDATED, {
            entityId: targetId,
            partKey: partKey,
            newHp: part.hp,
            maxHp: part.maxHp,
            change: -actualDamage,
            isHeal: false,
        });

        if (isPartBroken) {
            part.isBroken = true;
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey: partKey });
            if (partKey === PartInfo.HEAD.key) {
                const playerInfo = this.world.getComponent(targetId, PlayerInfo);
                if (playerInfo) {
                    this.world.emit(GameEvents.PLAYER_BROKEN, { 
                        entityId: targetId,
                        teamId: playerInfo.teamId
                    });
                }
            }
        }
        
        // ★新規: 適用結果を詳細に返す
        return {
            ...effect,
            value: actualDamage, // 実際に与えたダメージ
            overkillDamage: overkillDamage,
            isPartBroken: isPartBroken,
        };
    }

    /**
     * 回復効果を適用し、適用結果を返します。
     * @param {object} effect - 回復効果オブジェクト
     * @returns {object} 適用結果オブジェクト
     * @private
     */
    applyHeal(effect) {
        const { targetId, partKey, value: healAmount } = effect;
        if (targetId === null || targetId === undefined) return null;

        const targetParts = this.world.getComponent(targetId, Parts);
        if (!targetParts || !targetParts[partKey]) return null;

        const part = targetParts[partKey];
        let actualHealAmount = 0;
        if (!part.isBroken) {
            const oldHp = part.hp;
            part.hp = Math.min(part.maxHp, part.hp + healAmount);
            actualHealAmount = part.hp - oldHp;

            if (actualHealAmount > 0) {
                this.world.emit(GameEvents.HP_UPDATED, {
                    entityId: targetId,
                    partKey: partKey,
                    newHp: part.hp,
                    maxHp: part.maxHp,
                    change: actualHealAmount,
                    isHeal: true,
                });
            }
        }
        
        return {
            ...effect,
            value: actualHealAmount,
        };
    }
    
    /**
     * @private
     */
    applyTeamEffect(effect) {
        if (!effect.scope?.endsWith('_TEAM')) return;
        const sourceInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        if (!sourceInfo) return;
        const teamMembers = this.world.getEntitiesWith(PlayerInfo, ActiveEffects)
            .filter(id => this.world.getComponent(id, PlayerInfo).teamId === sourceInfo.teamId);
        
        teamMembers.forEach(id => this.applySingleEffect({ ...effect, targetId: id }));
    }

    /**
     * @private
     */
    applySingleEffect(effect) {
        const { targetId } = effect;
        const activeEffects = this.world.getComponent(targetId, ActiveEffects);
        if (!activeEffects) return;
        activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
        activeEffects.effects.push({
            type: effect.type,
            value: effect.value,
            duration: effect.duration,
            count: effect.value,
            partKey: effect.partKey,
        });
    }

    update(deltaTime) {}
}