/**
 * @file EffectApplier.js
 * @description 戦闘計算結果に基づいて、実際にWorldの状態（コンポーネント）を更新するロジック群。
 * BattleSequenceSystemから副作用を分離し、拡張性を確保する。
 */
import { Parts } from '../../components/index.js';
import { GameEvents } from '../../common/events.js';
import { EffectType } from '../../common/constants.js';
import { PlayerStateType } from '../common/constants.js'; // 修正: バトル固有の定数ファイルを参照
import { PlayerStatusService } from '../services/PlayerStatusService.js';
import { CooldownService } from '../services/CooldownService.js';

// 各効果タイプに対応する適用ロジック
const appliers = {
    [EffectType.DAMAGE]: (world, effect) => {
        applyHpChange(world, effect);
    },
    [EffectType.HEAL]: (world, effect) => {
        applyHpChange(world, effect);
    },
    [EffectType.APPLY_GUARD]: (world, effect, context) => {
        // ガード効果が確定した時点で即座にGUARDING状態へ遷移させる
        PlayerStatusService.transitionTo(world, context.attackerId, PlayerStateType.GUARDING);
    },
    [EffectType.CONSUME_GUARD]: (world, effect) => {
        // ガード回数消費などは計算段階で済んでいるため、
        // ここでは「有効期限切れ」の場合の処理などを行う
        if (effect.isExpired) {
            // ガード解除イベントの発行などは計算結果(effect.events)に含まれている想定だが、
            // 状態遷移の強制力を持たせるならここで行う
        }
    },
    // 将来的にステータスバフ/デバフの適用などもここに追加
};

// 共通ヘルパー: HPの更新と破壊イベント
function applyHpChange(world, effect) {
    const parts = world.getComponent(effect.targetId, Parts);
    if (parts && parts[effect.partKey]) {
        parts[effect.partKey].hp = effect.newHp;
        
        if (effect.isPartBroken) {
            parts[effect.partKey].isBroken = true;
            world.emit(GameEvents.PART_BROKEN, { entityId: effect.targetId, partKey: effect.partKey });
        }
    }
}

export class EffectApplier {
    /**
     * 計算済みの効果をWorldに適用する
     * @param {World} world 
     * @param {object} resultData BattleResolverの計算結果
     */
    static applyResult(world, resultData) {
        const { appliedEffects, attackerId } = resultData;
        
        if (!appliedEffects) return;

        appliedEffects.forEach(effect => {
            const applier = appliers[effect.type];
            if (applier) {
                applier(world, effect, { attackerId });
            }

            // 汎用イベント処理 (計算フェーズで生成されたイベントを発行)
            if (effect.events) {
                effect.events.forEach(e => world.emit(e.type, e.payload));
            }
        });
    }
}