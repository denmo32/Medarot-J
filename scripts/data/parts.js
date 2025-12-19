/**
 * @file パーツマスターデータ
 * @description ゲームに登場するすべてのパーツの性能（数値データ）を定義します。
 * 振る舞い（Action, Role）は typeDefinitions.js に定義されています。
 */

import { PartInfo } from '../common/constants.js';

export const PARTS_DATA = {
    // --- 頭部パーツ ---
    [PartInfo.HEAD.key]: {
        'head_001': { name: 'ヘッドライフル', maxHp: 40, type: '撃つ', trait: 'ライフル', success: 70, might: 15 },
        'head_002': { name: 'ヘッドソード', maxHp: 50, type: '殴る', trait: 'ソード', success: 60, might: 10 },
        'head_003': { name: 'ヘッドガトリング', maxHp: 35, type: '狙い撃ち', trait: 'ガトリング', success: 85, might: 12 },
        'head_004': { name: 'ヘッドハンマー', maxHp: 30, type: '我武者羅', trait: 'ハンマー', success: 50, might: 30 },
        'head_005': { name: 'ヘッドスキャン', maxHp: 50, type: '支援', trait: 'スキャン', success: 50, might: 50 },
        'head_006': { name: 'ヘッドリペア', maxHp: 50, type: '修復', trait: 'リペア', success: 50, might: 40 },
        'head_007': { name: 'ヘッドグリッチ', maxHp: 45, type: '妨害', trait: 'グリッチ', success: 70, might: 0 },
        'head_008': { name: 'ヘッドガード', maxHp: 120, type: '守る', trait: 'ガード', success: 0, might: 30 },
    },
    // --- 右腕パーツ ---
    [PartInfo.RIGHT_ARM.key]: {
        'rarm_001': { name: 'ライトライフル', maxHp: 50, type: '撃つ', trait: 'ライフル', success: 65, might: 25 },
        'rarm_002': { name: 'ライトソード', maxHp: 50, type: '殴る', trait: 'ソード', success: 55, might: 30 },
        'rarm_003': { name: 'ライトガトリング', maxHp: 45, type: '狙い撃ち', trait: 'ガトリング', success: 75, might: 20 },
        'rarm_004': { name: 'ライトハンマー', maxHp: 40, type: '我武者羅', trait: 'ハンマー', success: 80, might: 18 },
		'rarm_005': { name: 'ライトスキャン', maxHp: 50, type: '支援', trait: 'スキャン', success: 50, might: 50 },
		'rarm_006': { name: 'ライトリペア', maxHp: 50, type: '修復', trait: 'リペア', success: 50, might: 40 },
        'rarm_007': { name: 'ライトグリッチ', maxHp: 55, type: '妨害', trait: 'グリッチ', success: 80, might: 0 },
        'rarm_008': { name: 'ライトガード', maxHp: 120, type: '守る', trait: 'ガード', success: 0, might: 30 },
    },
    // --- 左腕パーツ ---
    [PartInfo.LEFT_ARM.key]: {
        'larm_001': { name: 'レフトライフル', maxHp: 50, type: '狙い撃ち', trait: 'ライフル', success: 70, might: 22 },
        'larm_002': { name: 'レフトソード', maxHp: 50, type: '我武者羅', trait: 'ソード', success: 50, might: 35 },
        'larm_003': { name: 'レフトガトリング', maxHp: 45, type: '撃つ', trait: 'ガトリング', success: 60, might: 28 },
        'larm_004': { name: 'レフトハンマー', maxHp: 70, type: '殴る', trait: 'ハンマー', success: 40, might: 10 },
    	'larm_005': { name: 'レフトスキャン', maxHp: 50, type: '支援', trait: 'スキャン', success: 50, might: 50 },
    	'larm_006': { name: 'レフトリペア', maxHp: 50, type: '修復', trait: 'リペア', success: 50, might: 40 },
        'larm_007': { name: 'レフトグリッチ', maxHp: 55, type: '妨害', trait: 'グリッチ', success: 80, might: 0 },
        'larm_008': { name: 'レフトガード', maxHp: 120, type: '守る', trait: 'ガード', success: 0, might: 30 },
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