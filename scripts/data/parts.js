/**
 * @file パーツマスターデータ
 * ゲームに登場するすべてのパーツの性能を定義します。
 */

import { PartInfo } from '../common/constants.js';
import { AttackType, ActionType } from '../battle/common/constants.js';
import { PartRoles } from './partRoles.js';
import { ActionDefinitionKey } from './actionDefinitions.js';

export const PARTS_DATA = {
    // --- 頭部パーツ ---
    [PartInfo.HEAD.key]: {
        'head_001': { name: 'ヘッドライフル', maxHp: 40, action: '射撃', type: AttackType.撃つ, trait: 'ライフル', success: 70, might: 15, role: PartRoles.DAMAGE.key, actionKey: ActionDefinitionKey.SINGLE_SHOT },
        'head_002': { name: 'ヘッドソード', maxHp: 50, action: '格闘', type: AttackType.殴る, trait: 'ソード', success: 60, might: 10, role: { key: PartRoles.DAMAGE.key, actionType: ActionType.MELEE }, actionKey: ActionDefinitionKey.MELEE_STRIKE },
        'head_003': { name: 'ヘッドガトリング', maxHp: 35, action: '射撃', type: AttackType.狙い撃ち, trait: 'ガトリング', success: 85, might: 12, role: PartRoles.DAMAGE.key, actionKey: ActionDefinitionKey.SINGLE_SHOT },
        'head_004': { name: 'ヘッドハンマー', maxHp: 30, action: '格闘', type: AttackType.我武者羅, trait: 'ハンマー', success: 50, might: 30, role: { key: PartRoles.DAMAGE.key, actionType: ActionType.MELEE }, actionKey: ActionDefinitionKey.RECKLESS_STRIKE },
        'head_005': { name: 'ヘッドスキャン', maxHp: 50, action: '介入', type: AttackType.支援, trait: 'スキャン', success: 50, might: 50, role: PartRoles.SUPPORT_SCAN.key, actionKey: ActionDefinitionKey.TEAM_SCAN },
        'head_006': { name: 'ヘッドリペア', maxHp: 50, action: '回復', type: AttackType.修復, trait: 'リペア', success: 50, might: 40, role: PartRoles.HEAL.key, actionKey: ActionDefinitionKey.SINGLE_HEAL },
        'head_007': { name: 'ヘッドグリッチ', maxHp: 45, action: '介入', type: AttackType.妨害, trait: 'グリッチ', success: 70, might: 0, role: PartRoles.SUPPORT_GLITCH.key, actionKey: ActionDefinitionKey.SINGLE_GLITCH },
        'head_008': { name: 'ヘッドガード', maxHp: 120, action: '防御', type: AttackType.守る, trait: 'ガード', success: 0, might: 30, role: PartRoles.DEFENSE.key, actionKey: ActionDefinitionKey.SELF_GUARD },
    },
    // --- 右腕パーツ ---
    [PartInfo.RIGHT_ARM.key]: {
        'rarm_001': { name: 'ライトライフル', maxHp: 50, action: '射撃', type: AttackType.撃つ, trait: 'ライフル', success: 65, might: 25, role: PartRoles.DAMAGE.key, actionKey: ActionDefinitionKey.SINGLE_SHOT },
        'rarm_002': { name: 'ライトソード', maxHp: 50, action: '格闘', type: AttackType.殴る, trait: 'ソード', success: 55, might: 30, role: { key: PartRoles.DAMAGE.key, actionType: ActionType.MELEE }, actionKey: ActionDefinitionKey.MELEE_STRIKE },
        'rarm_003': { name: 'ライトガトリング', maxHp: 45, action: '射撃', type: AttackType.狙い撃ち, trait: 'ガトリング', success: 75, might: 20, role: PartRoles.DAMAGE.key, actionKey: ActionDefinitionKey.SINGLE_SHOT },
        'rarm_004': { name: 'ライトハンマー', maxHp: 40, action: '格闘', type: AttackType.我武者羅, trait: 'ハンマー', success: 80, might: 18, role: { key: PartRoles.DAMAGE.key, actionType: ActionType.MELEE }, actionKey: ActionDefinitionKey.RECKLESS_STRIKE },
		'rarm_005': { name: 'ライトスキャン', maxHp: 50, action: '介入', type: AttackType.支援, trait: 'スキャン', success: 50, might: 50, role: PartRoles.SUPPORT_SCAN.key, actionKey: ActionDefinitionKey.TEAM_SCAN },
		'rarm_006': { name: 'ライトリペア', maxHp: 50, action: '回復', type: AttackType.修復, trait: 'リペア', success: 50, might: 40, role: PartRoles.HEAL.key, actionKey: ActionDefinitionKey.SINGLE_HEAL },
        'rarm_007': { name: 'ライトグリッチ', maxHp: 55, action: '介入', type: AttackType.妨害, trait: 'グリッチ', success: 80, might: 0, role: PartRoles.SUPPORT_GLITCH.key, actionKey: ActionDefinitionKey.SINGLE_GLITCH },
        'rarm_008': { name: 'ライトガード', maxHp: 120, action: '防御', type: AttackType.守る, trait: 'ガード', success: 0, might: 30, role: PartRoles.DEFENSE.key, actionKey: ActionDefinitionKey.SELF_GUARD },
    },
    // --- 左腕パーツ ---
    [PartInfo.LEFT_ARM.key]: {
        'larm_001': { name: 'レフトライフル', maxHp: 50, action: '射撃', type: AttackType.狙い撃ち, trait: 'ライフル', success: 70, might: 22, role: PartRoles.DAMAGE.key, actionKey: ActionDefinitionKey.SINGLE_SHOT },
        'larm_002': { name: 'レフトソード', maxHp: 50, action: '格闘', type: AttackType.我武者羅, trait: 'ソード', success: 50, might: 35, role: { key: PartRoles.DAMAGE.key, actionType: ActionType.MELEE }, actionKey: ActionDefinitionKey.RECKLESS_STRIKE },
        'larm_003': { name: 'レフトガトリング', maxHp: 45, action: '射撃', type: AttackType.撃つ, trait: 'ガトリング', success: 60, might: 28, role: PartRoles.DAMAGE.key, actionKey: ActionDefinitionKey.SINGLE_SHOT },
        'larm_004': { name: 'レフトハンマー', maxHp: 70, action: '格闘', type: AttackType.殴る, trait: 'ハンマー', success: 40, might: 10, role: { key: PartRoles.DAMAGE.key, actionType: ActionType.MELEE }, actionKey: ActionDefinitionKey.MELEE_STRIKE },
    	'larm_005': { name: 'レフトスキャン', maxHp: 50, action: '介入', type: AttackType.支援, trait: 'スキャン', success: 50, might: 50, role: PartRoles.SUPPORT_SCAN.key, actionKey: ActionDefinitionKey.TEAM_SCAN },
    	'larm_006': { name: 'レフトリペア', maxHp: 50, action: '回復', type: AttackType.修復, trait: 'リペア', success: 50, might: 40, role: PartRoles.HEAL.key, actionKey: ActionDefinitionKey.SINGLE_HEAL },
        'larm_007': { name: 'レフトグリッチ', maxHp: 55, action: '介入', type: AttackType.妨害, trait: 'グリッチ', success: 80, might: 0, role: PartRoles.SUPPORT_GLITCH.key, actionKey: ActionDefinitionKey.SINGLE_GLITCH },
        'larm_008': { name: 'レフトガード', maxHp: 120, action: '防御', type: AttackType.守る, trait: 'ガード', success: 0, might: 30, role: PartRoles.DEFENSE.key, actionKey: ActionDefinitionKey.SELF_GUARD },
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