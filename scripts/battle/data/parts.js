/**
 * @file パーツマスターデータ
 * ゲームに登場するすべてのパーツの性能を定義します。
 * パーツIDをキーとしたオブジェクト形式で管理します。
 */

// ★改善: PartInfoを参照することで、パーツに関する定義元を一元化
// ★修正: TargetTimingをインポート
import { PartInfo, EffectType, EffectScope, TargetTiming, ActionType } from '../common/constants.js';
// ★新規: PartRolesをインポートし、データ駆動設計を強化
import { PartRoles } from './partRoles.js';
// ★新規: PostMoveTargetingStrategyKeyをインポートし、タイプセーフティを向上
import { PostMoveTargetingStrategyKey } from '../ai/postMoveTargetingStrategies.js';

export const PARTS_DATA = {
    // --- 頭部パーツ ---
    [PartInfo.HEAD.key]: {
        // ★リファクタリング: roleプロパティにPartRolesを指定。targetScopeとeffectsの記述が不要になり簡潔化。
        // ★修正: targetTimingの値を定数に置き換え
        'head_001': { name: 'ヘッドライフル', maxHp: 40, action: '射撃', type: '撃つ', trait: 'ライフル', success: 70, might: 15, role: PartRoles.DAMAGE, targetTiming: TargetTiming.PRE_MOVE },
        'head_002': { name: 'ヘッドソード', maxHp: 50, action: '格闘', type: '殴る', trait: 'ソード', success: 60, might: 10, role: { ...PartRoles.DAMAGE, actionType: ActionType.MELEE }, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'head_003': { name: 'ヘッドガトリング', maxHp: 35, action: '射撃', type: '狙い撃ち', trait: 'ガトリング', success: 85, might: 12, role: PartRoles.DAMAGE, targetTiming: TargetTiming.PRE_MOVE },
        'head_004': { name: 'ヘッドハンマー', maxHp: 30, action: '格闘', type: '我武者羅', trait: 'ハンマー', success: 50, might: 30, role: { ...PartRoles.DAMAGE, actionType: ActionType.MELEE }, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'head_005': { name: 'ヘッドスキャン', maxHp: 50, action: '援護', type: '支援', trait: 'スキャン', success: 50, might: 50, role: PartRoles.SUPPORT_SCAN, targetTiming: TargetTiming.PRE_MOVE },
        'head_006': { name: 'ヘッドリペア', maxHp: 50, action: '回復', type: '修復', trait: 'リペア', success: 50, might: 40, role: PartRoles.HEAL, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.MOST_DAMAGED_ALLY },
        'head_007': { name: 'ヘッドグリッチ', maxHp: 45, action: '妨害', type: '妨害', trait: 'グリッチ', success: 70, might: 0, role: PartRoles.SUPPORT_GLITCH, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'head_008': { name: 'ヘッドガード', maxHp: 120, action: '防御', type: '守る', trait: 'ガード', success: 0, might: 30, role: PartRoles.DEFENSE, targetTiming: TargetTiming.POST_MOVE },
    },
    // --- 右腕パーツ ---
    [PartInfo.RIGHT_ARM.key]: {
        'rarm_001': { name: 'ライトライフル', maxHp: 50, action: '射撃', type: '撃つ', trait: 'ライフル', success: 65, might: 25, role: PartRoles.DAMAGE, targetTiming: TargetTiming.PRE_MOVE },
        'rarm_002': { name: 'ライトソード', maxHp: 50, action: '格闘', type: '殴る', trait: 'ソード', success: 55, might: 30, role: { ...PartRoles.DAMAGE, actionType: ActionType.MELEE }, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'rarm_003': { name: 'ライトガトリング', maxHp: 45, action: '射撃', type: '狙い撃ち', trait: 'ガトリング', success: 75, might: 20, role: PartRoles.DAMAGE, targetTiming: TargetTiming.PRE_MOVE },
        'rarm_004': { name: 'ライトハンマー', maxHp: 40, action: '格闘', type: '我武者羅', trait: 'ハンマー', success: 80, might: 18, role: { ...PartRoles.DAMAGE, actionType: ActionType.MELEE }, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
		'rarm_005': { name: 'ライトスキャン', maxHp: 50, action: '援護', type: '支援', trait: 'スキャン', success: 50, might: 50, role: PartRoles.SUPPORT_SCAN, targetTiming: TargetTiming.PRE_MOVE },
		'rarm_006': { name: 'ライトリペア', maxHp: 50, action: '回復', type: '修復', trait: 'リペア', success: 50, might: 40, role: PartRoles.HEAL, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.MOST_DAMAGED_ALLY },
        'rarm_007': { name: 'ライトグリッチ', maxHp: 55, action: '妨害', type: '妨害', trait: 'グリッチ', success: 80, might: 0, role: PartRoles.SUPPORT_GLITCH, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'rarm_008': { name: 'ライトガード', maxHp: 120, action: '防御', type: '守る', trait: 'ガード', success: 0, might: 30, role: PartRoles.DEFENSE, targetTiming: TargetTiming.POST_MOVE },
    },
    // --- 左腕パーツ ---
    [PartInfo.LEFT_ARM.key]: {
        'larm_001': { name: 'レフトライフル', maxHp: 50, action: '射撃', type: '狙い撃ち', trait: 'ライフル', success: 70, might: 22, role: PartRoles.DAMAGE, targetTiming: TargetTiming.PRE_MOVE },
        'larm_002': { name: 'レフトソード', maxHp: 50, action: '格闘', type: '我武者羅', trait: 'ソード', success: 50, might: 35, role: { ...PartRoles.DAMAGE, actionType: ActionType.MELEE }, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'larm_003': { name: 'レフトガトリング', maxHp: 45, action: '射撃', type: '撃つ', trait: 'ガトリング', success: 60, might: 28, role: PartRoles.DAMAGE, targetTiming: TargetTiming.PRE_MOVE },
        'larm_004': { name: 'レフトハンマー', maxHp: 70, action: '格闘', type: '殴る', trait: 'ハンマー', success: 40, might: 10, role: { ...PartRoles.DAMAGE, actionType: ActionType.MELEE }, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
    	'larm_005': { name: 'レフトスキャン', maxHp: 50, action: '援護', type: '支援', trait: 'スキャン', success: 50, might: 50, role: PartRoles.SUPPORT_SCAN, targetTiming: TargetTiming.PRE_MOVE },
    	'larm_006': { name: 'レフトリペア', maxHp: 50, action: '回復', type: '修復', trait: 'リペア', success: 50, might: 40, role: PartRoles.HEAL, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.MOST_DAMAGED_ALLY },
        'larm_007': { name: 'レフトグリッチ', maxHp: 55, action: '妨害', type: '妨害', trait: 'グリッチ', success: 80, might: 0, role: PartRoles.SUPPORT_GLITCH, targetTiming: TargetTiming.POST_MOVE, postMoveTargeting: PostMoveTargetingStrategyKey.NEAREST_ENEMY },
        'larm_008': { name: 'レフトガード', maxHp: 120, action: '防御', type: '守る', trait: 'ガード', success: 0, might: 30, role: PartRoles.DEFENSE, targetTiming: TargetTiming.POST_MOVE },
    },
    // --- 脚部パーツ ---
    [PartInfo.LEGS.key]: {
        'legs_001': { name: 'ライフルレッグ', maxHp: 60, mobility: 30, armor: 20, propulsion: 25, stability: 25 },
        'legs_002': { name: 'ソードレッグ', maxHp: 70, mobility: 20, armor: 30, propulsion: 20, stability: 30 },
        'legs_003': { name: 'ガトリングレッグ', maxHp: 50, mobility: 40, armor: 15, propulsion: 30, stability: 20 },
        'legs_004': { name: 'ハンマーレッグ', maxHp: 45, mobility: 50, armor: 10, propulsion: 35, stability: 15 },
    	'legs_005': { name: 'スキャンレッグ', maxHp: 50, mobility: 50, armor: 50, propulsion: 50, stability: 50 },
    	'legs_006': { name: 'リペアレッグ', maxHp: 50, mobility: 50, armor: 50, propulsion: 50, stability: 50 },
    	'legs_007': { name: 'グリッチレッグ', maxHp: 50, mobility: 50, armor: 50, propulsion: 50, stability: 50 },
    	'legs_008': { name: 'ガードレッグ', maxHp: 50, mobility: 50, armor: 50, propulsion: 50, stability: 50 },
    }
}