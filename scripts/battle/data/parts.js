/**
 * @file パーツマスターデータ
 * ゲームに登場するすべてのパーツの性能を定義します。
 * パーツIDをキーとしたオブジェクト形式で管理します。
 */

// ★改善: PartInfoを参照することで、パーツに関する定義元を一元化
import { PartInfo } from '../common/constants.js';

export const PARTS_DATA = {
    // --- 頭部パーツ ---
    // ★改善: hp, isBroken を削除し、マスターデータを不変に保つ
    [PartInfo.HEAD.key]: {
        'head_001': { name: 'ヘッドライフル', maxHp: 40, action: '射撃', type: '撃つ', trait: 'ライフル', success: 70, might: 15 },
        'head_002': { name: 'ヘッドソード', maxHp: 50, action: '格闘', type: '殴る', trait: 'ソード', success: 60, might: 10 },
        'head_003': { name: 'ヘッドガトリング', maxHp: 35, action: '射撃', type: '狙い撃ち', trait: 'ガトリング', success: 85, might: 12 },
        'head_004': { name: 'ヘッドハンマー', maxHp: 30, action: '格闘', type: '我武者羅', trait: 'ハンマー', success: 50, might: 30 },
    },
    // --- 右腕パーツ ---
    [PartInfo.RIGHT_ARM.key]: {
        'rarm_001': { name: 'ライトライフル', maxHp: 50, action: '射撃', type: '撃つ', trait: 'ライフル', success: 65, might: 25 },
        'rarm_002': { name: 'ライトソード', maxHp: 50, action: '格闘', type: '殴る', trait: 'ソード', success: 55, might: 30 },
        'rarm_003': { name: 'ライトガトリング', maxHp: 45, action: '射撃', type: '狙い撃ち', trait: 'ガトリング', success: 75, might: 20 },
        'rarm_004': { name: 'ライトハンマー', maxHp: 40, action: '格闘', type: '我武者羅', trait: 'ハンマー', success: 80, might: 18 },
    },
    // --- 左腕パーツ ---
    [PartInfo.LEFT_ARM.key]: {
        'larm_001': { name: 'レフトライフル', maxHp: 50, action: '射撃', type: '狙い撃ち', trait: 'ライフル', success: 70, might: 22 },
        'larm_002': { name: 'レフトソード', maxHp: 50, action: '格闘', type: '我武者羅', trait: 'ソード', success: 50, might: 35 },
        'larm_003': { name: 'レフトガトリング', maxHp: 45, action: '射撃', type: '撃つ', trait: 'ガトリング', success: 60, might: 28 },
        'larm_004': { name: 'レフトハンマー', maxHp: 70, action: '格闘', type: '殴る', trait: 'ハンマー', success: 40, might: 10 },
    },
    // --- 脚部パーツ ---
    [PartInfo.LEGS.key]: {
        'legs_001': { name: 'ライフルレッグ', maxHp: 60, mobility: 30, armor: 20, propulsion: 25, stability: 25 },
        'legs_002': { name: 'ソードレッグ', maxHp: 70, mobility: 20, armor: 30, propulsion: 20, stability: 30 },
        'legs_003': { name: 'ガトリングレッグ', maxHp: 50, mobility: 40, armor: 15, propulsion: 30, stability: 20 },
        'legs_004': { name: 'ハンマーレッグ', maxHp: 45, mobility: 50, armor: 10, propulsion: 35, stability: 15 },
    }
};